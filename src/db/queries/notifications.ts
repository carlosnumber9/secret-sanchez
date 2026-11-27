import { observe, logCommitted } from "@/lib/logger";
import { emailTransition, suppressedEmailErrors, type EmailEvent } from "@/services/notifications/emailStatus";
import { hasOptionalTable } from "@/db/capabilities";
import { previousStatusesFor, type WhatsappDeliveryStatus } from "@/services/notifications/whatsappStatus";
import { notificationLeaseMs, pendingRateLimit } from "@/services/notifications/retry";
import { isEligibleNotification } from "@/services/notifications/eligibility";
import { and, desc, eq, inArray, ne, or, sql } from "drizzle-orm";
import { db, tracedTransaction } from "@/db/client";
import { auditEvents, assignments, notificationLogs } from "@/db/schema";

export async function updateNotificationLog(id: string, input: Partial<typeof notificationLogs.$inferInsert>) {
  return observe("db.notifications.update", { notificationId: id, nextStatus: input.status }, async () => {
    const condition = input.status && ["pending", "sent", "failed", "delivered", "read"].includes(input.status)
      ? inArray(notificationLogs.status, [...previousStatusesFor(input.status as WhatsappDeliveryStatus | "pending")]) : undefined;
    const [log] = await db.update(notificationLogs).set(input).where(and(eq(notificationLogs.id, id), condition, sql`(${notificationLogs.channel} <> 'email' or ${notificationLogs.error} is null or ${notificationLogs.error} not in ('email_bounced', 'email_complained', 'email_suppressed'))`)).returning();
    return log;

  }, r => ({ rowCount: r ? 1 : 0, nextStatus: r?.status, result: r ? "applied" : "ignored" }), { debug: true });
}

export async function findNotificationByProviderMessageId(providerMessageId: string) {
  return observe("db.notifications.find", { providerMessageId }, async () => {
    const [log] = await db.select().from(notificationLogs)
      .where(eq(notificationLogs.providerMessageId, providerMessageId)).limit(1);
    return log ?? null;

  }, undefined, { debug: true });
}

export async function claimNotificationAttempt(input: {
  assignmentId: string;
  channel: "email" | "whatsapp";
  recipient: string;
  idempotencyKey: string;
  mode: "pending" | "failed" | "force";
}) {
  return observe("db.notifications.claim", { assignmentId: input.assignmentId, channel: input.channel, mode: input.mode }, async () => {
    return tracedTransaction(async (tx) => {
      const [assignment] = await tx.select({ id: assignments.id }).from(assignments)
        .where(eq(assignments.id, input.assignmentId)).for("update").limit(1);
      if (!assignment) {
        logCommitted("notification.attempt", { result: "skipped", reason: "not_found" });
        return null;
      }
      const [sameAttempt] = await tx.select().from(notificationLogs)
        .where(eq(notificationLogs.idempotencyKey, input.idempotencyKey)).limit(1);
      const [latest] = await tx.select().from(notificationLogs)
        .where(and(eq(notificationLogs.assignmentId, input.assignmentId), eq(notificationLogs.channel, input.channel)))
        .orderBy(desc(notificationLogs.createdAt), desc(notificationLogs.id)).limit(1);
      if (input.channel === "email" && latest?.recipient === input.recipient && suppressedEmailErrors.includes(latest.error as typeof suppressedEmailErrors[number])) {
        logCommitted("notification.attempt", { result: "skipped", reason: "suppressed_contact", notificationId: latest.id });
        return null;
      }
      const pending = sameAttempt ?? latest;
      if (pending?.status === "pending") {
        const cooldown = pendingRateLimit(pending.error);
        if (cooldown !== null) {
          if (cooldown > 0) {
            logCommitted("notification.attempt", { result: "skipped", reason: "cooldown", notificationId: pending.id });
            return null;
          }
          const [resumed] = await tx.update(notificationLogs).set({ error: null }).where(eq(notificationLogs.id, pending.id)).returning();
          logCommitted("notification.attempt", { reason: "resumed", notificationId: resumed.id });
          return resumed;
        }
        if (Date.now() - pending.createdAt.getTime() < notificationLeaseMs) {
          logCommitted("notification.attempt", { result: "skipped", reason: "lease_active", notificationId: pending.id });
          return null;
        }
        if (sameAttempt || input.mode !== "force") {
          logCommitted("notification.attempt", { result: "skipped", reason: "outcome_unknown", notificationId: pending.id });
          return null;
        }
      } else if (sameAttempt || !isEligibleNotification(latest?.status ?? null, input.mode)) {
        logCommitted("notification.attempt", { result: "skipped", reason: sameAttempt ? "deduplicated" : "ineligible", notificationId: latest?.id });
        return null;
      }
      const [log] = await tx.insert(notificationLogs).values({
        assignmentId: input.assignmentId, channel: input.channel, recipient: input.recipient,
        status: "pending", idempotencyKey: input.idempotencyKey
      }).onConflictDoNothing().returning();
      logCommitted("notification.attempt", { reason: log ? "claimed" : "deduplicated", notificationId: log?.id, result: log ? "succeeded" : "skipped" });
      return log ?? null;
    });

  }, undefined, { debug: true });
}

export async function applyWhatsappEvent(providerMessageId: string, status: WhatsappDeliveryStatus) {
  return observe("db.webhook.whatsapp", { providerMessageId, channel: "whatsapp", nextStatus: status }, async () => {
    const [updated] = await db.update(notificationLogs).set({ status, error: status === "failed" ? "delivery_failed" : null })
      .where(and(eq(notificationLogs.providerMessageId, providerMessageId), eq(notificationLogs.channel, "whatsapp"),
        inArray(notificationLogs.status, [...previousStatusesFor(status)]),
        or(ne(notificationLogs.status, status), sql`${notificationLogs.error} is distinct from ${status === "failed" ? "delivery_failed" : null}`))).returning({ notificationId: notificationLogs.id, assignmentId: notificationLogs.assignmentId });
    if (updated) return { found: true, applied: true, ...updated, nextStatus: status };
    const existing = await findNotificationByProviderMessageId(providerMessageId);
    return { found: Boolean(existing), applied: false, notificationId: existing?.id, assignmentId: existing?.assignmentId, nextStatus: existing?.status };

  }, undefined, { debug: true });
}

export async function listCurrentNotificationLogsForDraw(drawId: string) {
  return observe("db.notifications.list", { drawId }, async () => {
    return db.selectDistinctOn([notificationLogs.assignmentId, notificationLogs.channel], { log: notificationLogs })
      .from(notificationLogs).innerJoin(assignments, eq(notificationLogs.assignmentId, assignments.id))
      .where(eq(assignments.drawId, drawId))
      .orderBy(notificationLogs.assignmentId, notificationLogs.channel, desc(notificationLogs.createdAt), desc(notificationLogs.id));

  }, r => ({ rowCount: r.length }), { debug: true });
}

export async function getDrawExposure(drawId: string) {
  return observe("db.notifications.exposure", { drawId }, async () => {
    const [counts] = await db.select({
      notifications: sql<number>`count(*) filter (where ${notificationLogs.channel} in ('email', 'whatsapp'))::int`,
      manual: sql<number>`count(*) filter (where ${notificationLogs.channel} = 'manual')::int`,
      opened: sql<number>`(select count(*)::int from assignments a where a.draw_id = ${drawId} and a.opened_at is not null)`
    }).from(notificationLogs).innerJoin(assignments, eq(notificationLogs.assignmentId, assignments.id))
      .where(eq(assignments.drawId, drawId));
    if (!await hasOptionalTable("audit_events")) return { ...counts, manual: null };
    const [audit] = await db.select({ count: sql<number>`count(*)::int` }).from(auditEvents)
      .where(and(eq(auditEvents.drawId, drawId), eq(auditEvents.event, "assignment.link_copied")));
    return { ...counts, manual: counts.manual + audit.count };

  }, undefined, { debug: true });
}

export async function applyEmailEvent(providerMessageId: string, event: EmailEvent) {
  return observe("db.webhook.email", { providerMessageId, channel: "email" }, async () => {
    const transition = emailTransition(event);
    const [updated] = await db.update(notificationLogs).set({ status: transition.status, error: transition.error })
      .where(and(eq(notificationLogs.providerMessageId, providerMessageId), eq(notificationLogs.channel, "email"),
        inArray(notificationLogs.status, transition.previous as Array<(typeof notificationLogs.$inferSelect)["status"]>),
        or(ne(notificationLogs.status, transition.status), sql`${notificationLogs.error} is distinct from ${transition.error}`),
        sql`(${notificationLogs.error} is null or ${notificationLogs.error} not in ('email_bounced', 'email_complained', 'email_suppressed'))`))
      .returning({ notificationId: notificationLogs.id, assignmentId: notificationLogs.assignmentId });
    if (updated) return { found: true, applied: true, ...updated, nextStatus: transition.status };
    const existing = await findNotificationByProviderMessageId(providerMessageId);
    return { found: existing?.channel === "email", applied: false, notificationId: existing?.id, assignmentId: existing?.assignmentId, nextStatus: existing?.status };

  }, undefined, { debug: true });
}
