import { inArray, sql } from "drizzle-orm";
import { db } from "@/db/client";
import { assignments, drawParticipants, editionParticipants, notificationLogs } from "@/db/schema";

type Impact = { editions: number; draws: number; assignments: number; notifications: number; opened: number };

export async function getDeletionImpact(participantIds: string[]): Promise<Impact> {
  if (!participantIds.length) return { editions: 0, draws: 0, assignments: 0, notifications: 0, opened: 0 };
  const affected = db.selectDistinct({ drawId: drawParticipants.drawId }).from(drawParticipants)
    .where(inArray(drawParticipants.sourceParticipantId, participantIds));
  const [stats] = await db.execute<Impact>(sql`
    with impacted as (${affected})
    select
      (select count(distinct ${editionParticipants.editionId})::int from ${editionParticipants}
        where ${inArray(editionParticipants.participantId, participantIds)}) as editions,
      (select count(*)::int from impacted) as draws,
      (select count(*)::int from ${assignments} where ${assignments.drawId} in (select draw_id from impacted)) as assignments,
      (select count(*)::int from ${notificationLogs} join ${assignments} on ${notificationLogs.assignmentId} = ${assignments.id}
        where ${assignments.drawId} in (select draw_id from impacted)) as notifications,
      (select count(*)::int from ${assignments} where ${assignments.drawId} in (select draw_id from impacted) and ${assignments.openedAt} is not null) as opened
  `);
  return stats;
}
