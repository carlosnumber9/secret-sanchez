import { asc, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { participants } from "@/db/schema";

export async function listParticipants(groupId: string) {
  return db.select().from(participants).where(eq(participants.groupId, groupId)).orderBy(asc(participants.createdAt));
}

export async function createParticipant(input: typeof participants.$inferInsert) {
  const [participant] = await db.insert(participants).values(input).returning();
  return participant;
}

export async function updateParticipant(id: string, input: Partial<typeof participants.$inferInsert>) {
  const [participant] = await db
    .update(participants)
    .set({ ...input, updatedAt: new Date() })
    .where(eq(participants.id, id))
    .returning();
  return participant;
}
