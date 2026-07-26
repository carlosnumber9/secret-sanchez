import { and, eq, isNull } from "drizzle-orm";
import { db } from "@/db/client";
import { assignments, draws, familyGroups, participants } from "@/db/schema";

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
  const [updated] = await db
    .update(assignments)
    .set({ openedAt: new Date() })
    .where(and(eq(assignments.id, assignmentId), isNull(assignments.openedAt)))
    .returning();
  return updated ?? null;
}

export async function listAssignmentsForDraw(drawId: string) {
  return db
    .select({
      assignment: assignments,
      giver: participants
    })
    .from(assignments)
    .innerJoin(participants, eq(assignments.giverId, participants.id))
    .where(eq(assignments.drawId, drawId));
}

export async function getOwnedAssignment(assignmentId: string, adminId: string) {
  const [row] = await db
    .select({
      assignment: assignments,
      giver: participants,
      draw: draws,
      group: familyGroups
    })
    .from(assignments)
    .innerJoin(draws, eq(assignments.drawId, draws.id))
    .innerJoin(familyGroups, eq(draws.groupId, familyGroups.id))
    .innerJoin(participants, eq(assignments.giverId, participants.id))
    .where(and(eq(assignments.id, assignmentId), eq(familyGroups.ownerAdminId, adminId)))
    .limit(1);
  return row ?? null;
}
