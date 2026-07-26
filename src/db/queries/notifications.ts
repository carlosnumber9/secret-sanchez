import { desc, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { assignments, notificationLogs } from "@/db/schema";

export async function createNotificationLog(input: typeof notificationLogs.$inferInsert) {
  const [log] = await db.insert(notificationLogs).values(input).returning();
  return log;
}

export async function updateNotificationLog(id: string, input: Partial<typeof notificationLogs.$inferInsert>) {
  const [log] = await db.update(notificationLogs).set(input).where(eq(notificationLogs.id, id)).returning();
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
