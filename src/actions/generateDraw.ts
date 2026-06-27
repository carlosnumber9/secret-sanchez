import { createAssignments } from "@/db/queries/assignments";
import { createDraw } from "@/db/queries/draws";
import { listParticipants } from "@/db/queries/participants";
import { getEnv } from "@/lib/env";
import { buildRevealUrl, createRevealToken, hashRevealToken } from "@/lib/tokens";
import { generateDraw as generateDrawAssignments } from "@/services/draw/generateDraw";

export async function generateDraw(input: { groupId: string; year: number; generatedByAdminId?: string }) {
  const people = await listParticipants(input.groupId);
  const result = generateDrawAssignments(people, {
    noSameIsland: true,
    exclusions: []
  });

  if (!result.ok) return result;

  const draw = await createDraw({
    groupId: input.groupId,
    year: input.year,
    status: "generated",
    generatedByAdminId: input.generatedByAdminId
  });

  const env = getEnv();
  const assignmentsWithTokens = result.assignments.map((assignment) => {
    const token = createRevealToken();
    return {
      ...assignment,
      drawId: draw.id,
      revealTokenHash: hashRevealToken(token),
      revealUrl: buildRevealUrl(env.appUrl, token)
    };
  });

  await createAssignments(assignmentsWithTokens.map(({ revealUrl: _revealUrl, ...assignment }) => assignment));

  return {
    ok: true as const,
    draw,
    assignments: assignmentsWithTokens
  };
}
