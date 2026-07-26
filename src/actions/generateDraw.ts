import { and, eq, inArray } from "drizzle-orm";
import { db } from "@/db/client";
import { assignments, drawRules, draws, exclusionRules, familyGroups, participants } from "@/db/schema";
import { AppError } from "@/lib/errors";
import { logger } from "@/lib/logger";
import { createRevealToken, encryptRevealToken, hashRevealToken } from "@/lib/tokens";
import { ACTIVE_DRAW_STATUSES } from "@/services/admin/policies";
import { generateDraw as generateDrawAssignments } from "@/services/draw/generateDraw";

export async function generateDraw(input: { groupId: string; generatedByAdminId: string }) {
  const startedAt = performance.now();
  logger.info("draw.generation_started", { groupId: input.groupId, adminId: input.generatedByAdminId });

  const result = await db.transaction(async (tx) => {
    const [group] = await tx
      .select()
      .from(familyGroups)
      .where(
        and(
          eq(familyGroups.id, input.groupId),
          eq(familyGroups.ownerAdminId, input.generatedByAdminId)
        )
      )
      .for("update")
      .limit(1);
    if (!group) throw new AppError(403, "GROUP_FORBIDDEN", "No puedes sortear este grupo.");

    const [existing] = await tx
      .select({ id: draws.id })
      .from(draws)
      .where(
        and(
          eq(draws.groupId, group.id),
          inArray(draws.status, [...ACTIVE_DRAW_STATUSES])
        )
      )
      .limit(1);
    if (existing) {
      throw new AppError(409, "DRAW_ALREADY_EXISTS", "Ya existe un sorteo activo para este grupo.");
    }

    const people = await tx.select().from(participants).where(eq(participants.groupId, group.id));
    const storedRules = await tx.select().from(drawRules).where(eq(drawRules.groupId, group.id));
    const storedExclusions = await tx
      .select()
      .from(exclusionRules)
      .where(eq(exclusionRules.groupId, group.id));

    const invalidChannel = people.find(
      (person) => person.active && (person.preferredChannel === "whatsapp" || person.preferredChannel === "both")
    );
    if (invalidChannel) {
      throw new AppError(
        422,
        "UNAVAILABLE_CHANNEL",
        "Corrige los participantes que todavía tienen WhatsApp como canal."
      );
    }
    const missingEmail = people.find(
      (person) => person.active && person.preferredChannel === "email" && !person.email
    );
    if (missingEmail) {
      throw new AppError(422, "MISSING_EMAIL", "Todas las entregas por email necesitan una dirección.");
    }

    const generated = generateDrawAssignments(people, {
      noSameIsland:
        storedRules.find((rule) => rule.type === "NO_SAME_ISLAND")?.enabled ?? true,
      exclusions: storedExclusions.map((rule) => ({
        fromParticipantId: rule.fromParticipantId,
        toParticipantId: rule.toParticipantId
      }))
    });
    if (!generated.ok) throw new AppError(422, "DRAW_IMPOSSIBLE", generated.message);

    const [draw] = await tx
      .insert(draws)
      .values({
        groupId: group.id,
        year: group.year,
        status: "locked",
        generatedByAdminId: input.generatedByAdminId
      })
      .returning();

    const assignmentValues = generated.assignments.map((assignment) => {
      const token = createRevealToken();
      return {
        ...assignment,
        drawId: draw.id,
        revealTokenHash: hashRevealToken(token),
        revealTokenCiphertext: encryptRevealToken(token)
      };
    });
    await tx.insert(assignments).values(assignmentValues);
    await tx
      .update(familyGroups)
      .set({ status: "drawn", updatedAt: new Date() })
      .where(eq(familyGroups.id, group.id));

    return { draw, assignmentCount: assignmentValues.length };
  });

  logger.info("draw.generation_succeeded", {
    groupId: input.groupId,
    drawId: result.draw.id,
    assignmentCount: result.assignmentCount,
    durationMs: Math.round(performance.now() - startedAt)
  });
  return result;
}
