import { and, eq, isNull, ne } from "drizzle-orm";
import { db } from "@/db/client";
import { assignments, drawEditions, drawParticipants, draws, families } from "@/db/schema";

export async function createAssignments(values: (typeof assignments.$inferInsert)[]) {
  return db.insert(assignments).values(values).returning();
}

export async function getAssignmentByTokenHash(tokenHash: string) {
  const [row] = await db
    .select({ assignment: assignments, giver: drawParticipants, draw: draws })
    .from(assignments)
    .innerJoin(drawParticipants, eq(assignments.giverId, drawParticipants.id))
    .innerJoin(draws, eq(assignments.drawId, draws.id))
    .where(and(eq(assignments.revealTokenHash, tokenHash), ne(draws.status, "revoked")))
    .limit(1);
  if (!row) return null;

  const [receiver] = await db.select().from(drawParticipants).where(eq(drawParticipants.id, row.assignment.receiverId)).limit(1);
  return { ...row, receiver: receiver ?? null };
}

export async function markAssignmentOpened(assignmentId: string) {
  const [updated] = await db
    .update(assignments)
    .set({ openedAt: new Date() })
    .where(and(eq(assignments.id, assignmentId), isNull(assignments.openedAt)))
    .returning();
  return updated ?? null;
}

export async function listAssignmentsForDraw(drawId: string) {
  return db
    .select({ assignment: assignments, giver: drawParticipants })
    .from(assignments)
    .innerJoin(drawParticipants, eq(assignments.giverId, drawParticipants.id))
    .where(eq(assignments.drawId, drawId));
}

export async function getOwnedAssignment(assignmentId: string, adminId: string) {
  const [row] = await db
    .select({ assignment: assignments, giver: drawParticipants, draw: draws, edition: drawEditions, family: families })
    .from(assignments)
    .innerJoin(draws, eq(assignments.drawId, draws.id))
    .innerJoin(drawEditions, eq(draws.editionId, drawEditions.id))
    .innerJoin(families, eq(drawEditions.familyId, families.id))
    .innerJoin(drawParticipants, eq(assignments.giverId, drawParticipants.id))
    .where(and(eq(assignments.id, assignmentId), eq(families.ownerAdminId, adminId)))
    .limit(1);
  return row ?? null;
}
