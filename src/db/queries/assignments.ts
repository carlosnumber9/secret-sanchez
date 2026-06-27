import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { assignments, participants } from "@/db/schema";

export async function createAssignments(values: (typeof assignments.$inferInsert)[]) {
  return db.insert(assignments).values(values).returning();
}

export async function getAssignmentByTokenHash(tokenHash: string) {
  const [row] = await db
    .select({
      assignment: assignments,
      giver: participants
    })
    .from(assignments)
    .innerJoin(participants, eq(assignments.giverId, participants.id))
    .where(eq(assignments.revealTokenHash, tokenHash))
    .limit(1);

  if (!row) return null;

  const [receiver] = await db
    .select()
    .from(participants)
    .where(eq(participants.id, row.assignment.receiverId))
    .limit(1);

  return {
    assignment: row.assignment,
    giver: row.giver,
    receiver
  };
}

export async function markAssignmentOpened(assignmentId: string) {
  await db.update(assignments).set({ openedAt: new Date() }).where(eq(assignments.id, assignmentId));
}
