import { z } from "zod";
import { and, eq } from "drizzle-orm";
import { withEditableEdition } from "@/db/locks";
import { drawRules, exclusionRules, editionParticipants, participants } from "@/db/schema";
import { AppError } from "@/lib/errors";

export const editionRulesSchema = z.object({
  noSameIsland: z.boolean(),
  exclusions: z.array(z.object({ fromParticipantId: z.uuid(), toParticipantId: z.uuid() }).strict()).max(500)
}).strict().superRefine(({ exclusions }, context) => {
  const keys = new Set<string>();
  exclusions.forEach((pair, index) => {
    const key = `${pair.fromParticipantId}:${pair.toParticipantId}`;
    if (pair.fromParticipantId === pair.toParticipantId || keys.has(key)) context.addIssue({ code: "custom", path: ["exclusions", index], message: "Las exclusiones deben ser pares distintos y no repetidos." });
    keys.add(key);
  });
});

export async function updateEditionRules(adminId: string, editionId: string, value: unknown) {
  const input = editionRulesSchema.parse(value);
  return withEditableEdition(adminId, editionId, async (tx, owned) => {
    const members = await tx.select({ id: participants.id, isBaby: editionParticipants.isBaby }).from(editionParticipants)
      .innerJoin(participants, eq(editionParticipants.participantId, participants.id))
      .where(and(eq(editionParticipants.editionId, editionId), eq(participants.familyId, owned.family.id)));
    const adults = new Set(members.filter((p) => !p.isBaby).map((p) => p.id));
    if (input.exclusions.some((pair) => !adults.has(pair.fromParticipantId) || !adults.has(pair.toParticipantId))) throw new AppError(422, "INVALID_EXCLUSION", "Las exclusiones deben unir dos adultos de esta edición.");
    // Only the user-facing rule is replaced; internal counters remain untouched.
    await tx.delete(drawRules).where(and(eq(drawRules.editionId, editionId), eq(drawRules.type, "NO_SAME_ISLAND")));
    await tx.insert(drawRules).values({ editionId, type: "NO_SAME_ISLAND", enabled: input.noSameIsland, config: {} });
    await tx.delete(exclusionRules).where(eq(exclusionRules.editionId, editionId));
    if (input.exclusions.length) await tx.insert(exclusionRules).values(input.exclusions.map((pair) => ({ editionId, ...pair })));
    return input;
  });
}
