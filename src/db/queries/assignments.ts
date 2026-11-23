import { registeredAdmin } from "@/db/admin-access";
import { observe } from "@/lib/logger";
import { and, eq, ne, sql } from "drizzle-orm";
import { db } from "@/db/client";
import { assignments, drawEditions, drawIslands, drawParticipants, draws, families } from "@/db/schema";

export async function listAssignmentsForDraw(drawId: string) {
  return observe("db.assignments.list", { drawId }, async () => {
    return db
      .select({ assignment: assignments, giver: drawParticipants, giverIsland: drawIslands })
      .from(assignments)
      .leftJoin(drawParticipants, eq(assignments.giverId, drawParticipants.id))
      .leftJoin(drawIslands, eq(assignments.giverIslandId, drawIslands.id))
      .where(eq(assignments.drawId, drawId));

  }, r => ({ rowCount: r.length }), { debug: true });
}

export async function getOwnedAssignment(assignmentId: string, adminId: string) {
  return observe("db.assignments.owned", { assignmentId }, async () => {
    const [row] = await db
      .select({ assignment: assignments, giver: drawParticipants, giverIsland: drawIslands, draw: draws, edition: drawEditions, family: families })
      .from(assignments)
      .innerJoin(draws, eq(assignments.drawId, draws.id))
      .innerJoin(drawEditions, eq(draws.editionId, drawEditions.id))
      .innerJoin(families, eq(drawEditions.familyId, families.id))
      .leftJoin(drawParticipants, eq(assignments.giverId, drawParticipants.id))
      .leftJoin(drawIslands, eq(assignments.giverIslandId, drawIslands.id))
      .where(and(eq(assignments.id, assignmentId), registeredAdmin(adminId)))
      .limit(1);
    return row ?? null;

  }, undefined, { debug: true });
}

export async function listDeliveryAssignmentsForDraw(drawId: string) {
  return observe("db.assignments.deliveries", { drawId }, async () => {
    return db.select({
      assignment: { id: assignments.id, openedAt: assignments.openedAt, revealTokenCiphertext: sql<boolean>`${assignments.revealTokenCiphertext} is not null` },
      giver: drawParticipants, giverIsland: drawIslands
    }).from(assignments)
      .leftJoin(drawParticipants, eq(assignments.giverId, drawParticipants.id))
      .leftJoin(drawIslands, eq(assignments.giverIslandId, drawIslands.id))
      .where(eq(assignments.drawId, drawId));

  }, r => ({ rowCount: r.length }), { debug: true });
}

export async function getRevealPreparation(tokenHash: string) {
  return observe("db.reveal.prepare", {}, async () => {
    const [row] = await db.select({
      assignmentId: assignments.id,
      giverName: sql<string>`coalesce(${drawParticipants.name}, ${drawIslands.representativeName})`,
      giverKind: sql<"participant" | "familyIsland">`case when ${assignments.giverId} is not null then 'participant' else 'familyIsland' end`,
      giverIslandName: drawIslands.name,
      alreadyOpened: sql<boolean>`${assignments.openedAt} is not null`
    }).from(assignments)
      .leftJoin(drawParticipants, eq(assignments.giverId, drawParticipants.id))
      .leftJoin(drawIslands, eq(assignments.giverIslandId, drawIslands.id))
      .innerJoin(draws, eq(assignments.drawId, draws.id))
      .where(and(eq(assignments.revealTokenHash, tokenHash), ne(draws.status, "revoked"))).limit(1);
    return row ?? null;

  }, undefined, { debug: true });
}

export async function openRevealAssignment(tokenHash: string) {
  return observe("db.reveal.open", {}, async () => {
    const [row] = await db.execute<{ id: string; receiverName: string; firstOpen: boolean }>(sql`
      with locked_draw as materialized (
        select d.id from draws d join assignments a on a.draw_id = d.id
        where a.reveal_token_hash = ${tokenHash} and d.status <> 'revoked'
        for share of d
      ), matched as materialized (
        select a.id, a.opened_at, receiver.name as receiver_name
        from assignments a join locked_draw d on a.draw_id = d.id
        join draw_participants receiver on receiver.id = a.receiver_id
        where a.reveal_token_hash = ${tokenHash}
        for update of a
      )
      update assignments a set opened_at = coalesce(a.opened_at, now())
      from matched m where a.id = m.id
      returning a.id, m.receiver_name as "receiverName", (m.opened_at is null) as "firstOpen"
    `);
    return row ?? null;

  }, undefined, { debug: true });
}
