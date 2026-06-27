import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { notificationLogs } from "@/db/schema";

export async function createNotificationLog(input: typeof notificationLogs.$inferInsert) {
  const [log] = await db.insert(notificationLogs).values(input).returning();
  return log;
}

export async function updateNotificationLog(id: string, input: Partial<typeof notificationLogs.$inferInsert>) {
  const [log] = await db.update(notificationLogs).set(input).where(eq(notificationLogs.id, id)).returning();
  return log;
}

export async function listNotificationLogs(assignmentId: string) {
  return db.select().from(notificationLogs).where(eq(notificationLogs.assignmentId, assignmentId));
}
