import { previousStatusesFor, type WhatsappDeliveryStatus } from "@/services/notifications/whatsappStatus";
import { canResumePending, notificationLeaseMs } from "@/services/notifications/retry";
import { isEligibleNotification } from "@/services/notifications/eligibility";
import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { db } from "@/db/client";
import { assignments, notificationLogs } from "@/db/schema";

export async function createNotificationLog(input: typeof notificationLogs.$inferInsert) {
  const [log] = await db.insert(notificationLogs).values(input).returning();
  return log;
}

export async function updateNotificationLog(id: string, input: Partial<typeof notificationLogs.$inferInsert>) {
  const condition = input.status && ["pending", "sent", "failed", "delivered", "read"].includes(input.status)
    ? inArray(notificationLogs.status, [...previousStatusesFor(input.status as WhatsappDeliveryStatus | "pending")]) : undefined;
  const [log] = await db.update(notificationLogs).set(input).where(and(eq(notificationLogs.id, id), condition)).returning();
  return log;
}

export async function listNotificationLogs(assignmentId: string) {
  return db
    .select()
    .from(notificationLogs)
    .where(eq(notificationLogs.assignmentId, assignmentId))
    .orderBy(desc(notificationLogs.createdAt));
}

export async function listNotificationLogsForDraw(drawId: string) {
  return db
    .select({ log: notificationLogs })
    .from(notificationLogs)
    .innerJoin(assignments, eq(notificationLogs.assignmentId, assignments.id))
    .where(eq(assignments.drawId, drawId))
    .orderBy(desc(notificationLogs.createdAt));
}

export async function findNotificationByIdempotencyKey(idempotencyKey: string) {
  const [log] = await db
    .select()
    .from(notificationLogs)
    .where(eq(notificationLogs.idempotencyKey, idempotencyKey))
    .limit(1);
  return log ?? null;
}

export async function findNotificationByProviderMessageId(providerMessageId: string) {
  const [log] = await db.select().from(notificationLogs)
    .where(eq(notificationLogs.providerMessageId, providerMessageId)).limit(1);
  return log ?? null;
}

export async function claimNotificationAttempt(input: {
  assignmentId: string;
  channel: "email" | "whatsapp";
  recipient: string;
  idempotencyKey: string;
  mode: "pending" | "failed" | "force";
}) {
  return db.transaction(async (tx) => {
    const [assignment] = await tx.select({ id: assignments.id }).from(assignments)
      .where(eq(assignments.id, input.assignmentId)).for("update").limit(1);
    if (!assignment) return null;
    const [sameAttempt] = await tx.select().from(notificationLogs)
      .where(eq(notificationLogs.idempotencyKey, input.idempotencyKey)).limit(1);
    const [latest] = await tx.select().from(notificationLogs)
      .where(and(eq(notificationLogs.assignmentId, input.assignmentId), eq(notificationLogs.channel, input.channel)))
      .orderBy(desc(notificationLogs.createdAt), desc(notificationLogs.id)).limit(1);
    const pending = sameAttempt ?? latest;
    if (pending?.status === "pending") {
      if (Date.now() - pending.createdAt.getTime() < notificationLeaseMs) return null;
      if (canResumePending(input.channel, pending.createdAt)) return pending;
      if (sameAttempt || input.mode !== "force") return null;
    } else if (sameAttempt || !isEligibleNotification(latest?.status ?? null, input.mode)) return null;
    const [log] = await tx.insert(notificationLogs).values({
      assignmentId: input.assignmentId, channel: input.channel, recipient: input.recipient,
      status: "pending", idempotencyKey: input.idempotencyKey
    }).onConflictDoNothing().returning();
    return log ?? null;
  });
}

export async function applyWhatsappEvent(providerMessageId: string, status: WhatsappDeliveryStatus) {
  const [updated] = await db.update(notificationLogs).set({ status, error: status === "failed" ? "delivery_failed" : null })
    .where(and(eq(notificationLogs.providerMessageId, providerMessageId), eq(notificationLogs.channel, "whatsapp"),
      inArray(notificationLogs.status, [...previousStatusesFor(status)]))).returning({ id: notificationLogs.id });
  if (updated) return true;
  return Boolean(await findNotificationByProviderMessageId(providerMessageId));
}

export async function listCurrentNotificationLogsForDraw(drawId: string) {
  return db.selectDistinctOn([notificationLogs.assignmentId, notificationLogs.channel], { log: notificationLogs })
    .from(notificationLogs).innerJoin(assignments, eq(notificationLogs.assignmentId, assignments.id))
    .where(eq(assignments.drawId, drawId))
    .orderBy(notificationLogs.assignmentId, notificationLogs.channel, desc(notificationLogs.createdAt), desc(notificationLogs.id));
}

export async function getDrawExposure(drawId: string) {
  const [counts] = await db.select({
    notifications: sql<number>`count(*) filter (where ${notificationLogs.channel} in ('email', 'whatsapp'))::int`,
    manual: sql<number>`count(*) filter (where ${notificationLogs.channel} = 'manual')::int`,
    opened: sql<number>`(select count(*)::int from assignments a where a.draw_id = ${drawId} and a.opened_at is not null)`
  }).from(notificationLogs).innerJoin(assignments, eq(notificationLogs.assignmentId, assignments.id))
    .where(eq(assignments.drawId, drawId));
  return counts;
}
