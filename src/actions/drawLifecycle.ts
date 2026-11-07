import { participantPhoneIsValid } from "@/lib/contact";
import { recordAuditEvent } from "@/services/audit/recordEvent";
import { lockOwnedEdition } from "@/db/locks";
import { and, eq, max, ne } from "drizzle-orm";
import { db } from "@/db/client";
import {
  assignments,
  drawEditions,
  drawIslands,
  drawParticipants,
  drawRules,
  draws,
  editionIslandConfigs,
  editionParticipants,
  exclusionRules,
  familyIslands,
  participants
} from "@/db/schema";
import { AppError } from "@/lib/errors";
import { getEnv } from "@/lib/env";
import { logger } from "@/lib/logger";
import { createRevealToken, encryptRevealToken, hashRevealToken } from "@/lib/tokens";
import { generateDraw as generateDrawAssignments } from "@/services/draw/generateDraw";
import { generateBabyAssignments } from "@/services/draw/generateBabyAssignments";
import { nextAttemptNumber, resolveEditionParticipants, validateEditionRoles } from "@/services/editions/configuration";

export async function generateEditionDraw(input: { editionId: string; generatedByAdminId: string }) {
  const startedAt = performance.now();
  return db.transaction(async (tx) => {
    const owned = await lockOwnedEdition(tx, input.generatedByAdminId, input.editionId);
    const [existing] = await tx.select({ id: draws.id }).from(draws)
      .where(and(eq(draws.editionId, input.editionId), ne(draws.status, "revoked"))).limit(1);
    if (existing) throw new AppError(409, "DRAW_ALREADY_EXISTS", "Ya existe un reparto vigente para esta edición.");

    const rows = await tx.select({ participant: participants, config: editionParticipants, island: familyIslands, islandConfig: editionIslandConfigs })
      .from(editionParticipants)
      .innerJoin(participants, eq(editionParticipants.participantId, participants.id))
      .innerJoin(familyIslands, eq(participants.familyIslandId, familyIslands.id))
      .innerJoin(editionIslandConfigs, and(eq(editionIslandConfigs.editionId, input.editionId), eq(editionIslandConfigs.familyIslandId, familyIslands.id)))
      .where(eq(editionParticipants.editionId, input.editionId));
    const configuredRows = rows.map((row) => ({
      ...row,
      id: row.participant.id,
      familyIslandId: row.participant.familyIslandId,
      enabled: row.config.enabled,
      islandEnabled: row.islandConfig.enabled,
      canGive: row.config.canGive,
      canReceive: row.config.canReceive,
      isBaby: row.config.isBaby
    }));
    const roleError = validateEditionRoles(configuredRows);
    if (roleError) throw new AppError(422, "INVALID_EDITION_ROLES", roleError);
    const enabled = resolveEditionParticipants(configuredRows);
    const adults = enabled.filter(({ config }) => !config.isBaby);
    const babies = enabled.filter(({ config }) => config.isBaby);
    const adultGivers = adults.filter(({ config }) => config.canGive);
    const invalidAdultDelivery = adultGivers.find(({ participant, config }) => {
      const channel = config.preferredChannel;
      return !channel || ((channel === "email" || channel === "both") && !participant.email)
        || ((channel === "whatsapp" || channel === "both") && (!participant.phone || !participantPhoneIsValid(participant.phone)));
    });
    if (invalidAdultDelivery) throw new AppError(422, "MISSING_DELIVERY_CONTACT", `Revisa los canales y contactos de ${invalidAdultDelivery.participant.name}.`);

    const enabledIslandRows = [...new Map(enabled.map(({ island, islandConfig }) => [island.id, { island, islandConfig }])).values()];
    const preparedIslands = enabledIslandRows.map(({ island, islandConfig }) => ({
      island,
      islandConfig,
      representative: adults.find(({ participant }) => participant.id === islandConfig.representativeParticipantId && participant.familyIslandId === island.id)
    }));
    if (babies.length && preparedIslands.some(({ representative }) => !representative)) {
      throw new AppError(422, "MISSING_ISLAND_REPRESENTATIVE", "Todas las unidades activas necesitan un representante adulto activo para repartir a bebés.");
    }
    const invalidRepresentative = preparedIslands.find(({ representative }) => {
      if (!representative) return false;
      const channel = representative.config.preferredChannel;
      return !channel || ((channel === "email" || channel === "both") && !representative.participant.email)
        || ((channel === "whatsapp" || channel === "both") && (!representative.participant.phone || !participantPhoneIsValid(representative.participant.phone)));
    });
    if (babies.length && invalidRepresentative) throw new AppError(422, "INVALID_REPRESENTATIVE_CONTACT", `Revisa los canales y contactos del representante de ${invalidRepresentative.island.name}.`);
    const usesWhatsapp = adultGivers.some(({ config }) => config.preferredChannel === "whatsapp" || config.preferredChannel === "both")
      || (babies.length > 0 && preparedIslands.some(({ representative }) => representative?.config.preferredChannel === "whatsapp" || representative?.config.preferredChannel === "both"));
    if (usesWhatsapp) {
      const env = getEnv();
      if (!env.kapsoApiKey || !env.kapsoPhoneNumberId || !env.kapsoTemplateName || !env.kapsoTemplateLanguage || !env.kapsoWebhookSecret) {
        throw new AppError(422, "WHATSAPP_NOT_CONFIGURED", "WhatsApp no está completamente configurado en el servidor.");
      }
      if (owned.edition.kind === "test" && !env.kapsoTestRecipientPhone) {
        throw new AppError(422, "WHATSAPP_TEST_CONTACT_MISSING", "Configura el teléfono seguro de pruebas antes de generar esta edición.");
      }
    }

    const [rules, exclusions, attempt] = await Promise.all([
      tx.select().from(drawRules).where(eq(drawRules.editionId, input.editionId)),
      tx.select().from(exclusionRules).where(eq(exclusionRules.editionId, input.editionId)),
      tx.select({ value: max(draws.attemptNumber) }).from(draws).where(eq(draws.editionId, input.editionId))
    ]);
    const domainPeople = adults.map(({ participant, config }) => ({
      id: participant.id,
      name: participant.name,
      familyIslandId: participant.familyIslandId,
      active: true,
      canGive: config.canGive,
      canReceive: config.canReceive
    }));
    const generatedAdults = generateDrawAssignments(domainPeople, {
      noSameIsland: rules.find((rule) => rule.type === "NO_SAME_ISLAND")?.enabled ?? true,
      exclusions: exclusions.map((rule) => ({ fromParticipantId: rule.fromParticipantId, toParticipantId: rule.toParticipantId }))
    });
    if (!generatedAdults.ok) throw new AppError(422, "DRAW_IMPOSSIBLE", generatedAdults.message);
    const generatedBabies = generateBabyAssignments(
      babies.map(({ participant }) => ({ id: participant.id, familyIslandId: participant.familyIslandId })),
      preparedIslands.filter(({ representative }) => representative).map(({ island }) => ({ id: island.id }))
    );
    if (!generatedBabies.ok) throw new AppError(422, "BABY_DRAW_IMPOSSIBLE", generatedBabies.message);

    const persistedCounter = rules.filter((rule) => rule.type === "ATTEMPT_COUNTER").reduce((highest, rule) => {
      const value = (rule.config as { lastUsed?: unknown })?.lastUsed;
      return typeof value === "number" && Number.isSafeInteger(value) && value >= 0 ? Math.max(highest, value) : highest;
    }, 0);
    const attemptNumber = nextAttemptNumber([attempt[0]?.value ?? 0], persistedCounter);
    const [draw] = await tx.insert(draws).values({
      editionId: input.editionId,
      attemptNumber,
      status: "locked",
      generatedByAdminId: input.generatedByAdminId
    }).returning();
    const snapshots = await tx.insert(drawParticipants).values(enabled.map(({ participant, config, island }) => ({
      drawId: draw.id,
      sourceParticipantId: participant.id,
      sourceFamilyIslandId: island.id,
      name: participant.name,
      email: participant.email,
      phone: participant.phone,
      preferredChannel: config.preferredChannel,
      isBaby: config.isBaby,
      familyIslandName: island.name,
      canGive: config.canGive,
      canReceive: config.canReceive
    }))).returning();
    const snapshotBySource = new Map(snapshots.map((snapshot) => [snapshot.sourceParticipantId, snapshot.id]));
    const islandSnapshots = babies.length ? await tx.insert(drawIslands).values(preparedIslands.map(({ island, representative }) => ({
      drawId: draw.id,
      sourceFamilyIslandId: island.id,
      name: island.name,
      representativeSourceParticipantId: representative!.participant.id,
      representativeName: representative!.participant.name,
      representativeEmail: representative!.participant.email,
      representativePhone: representative!.participant.phone,
      preferredChannel: representative!.config.preferredChannel!
    }))).returning() : [];
    const islandSnapshotBySource = new Map(islandSnapshots.map((snapshot) => [snapshot.sourceFamilyIslandId, snapshot.id]));
    const encryptionKey = getEnv().revealTokenEncryptionKey;
    const personalValues = generatedAdults.assignments.map((assignment) => {
      const token = createRevealToken();
      return {
        drawId: draw.id,
        giverId: snapshotBySource.get(assignment.giverId)!,
        receiverId: snapshotBySource.get(assignment.receiverId)!,
        revealTokenHash: hashRevealToken(token),
        revealTokenCiphertext: encryptRevealToken(token, encryptionKey)
      };
    });
    const babyValues = generatedBabies.assignments.map((assignment) => {
      const token = createRevealToken();
      return {
        drawId: draw.id,
        giverId: null,
        giverIslandId: islandSnapshotBySource.get(assignment.giverIslandId)!,
        receiverId: snapshotBySource.get(assignment.receiverId)!,
        revealTokenHash: hashRevealToken(token),
        revealTokenCiphertext: encryptRevealToken(token, encryptionKey)
      };
    });
    await tx.insert(assignments).values([...personalValues, ...babyValues]);
    await tx.update(drawEditions).set({ status: "drawn", updatedAt: new Date() }).where(eq(drawEditions.id, input.editionId));
    if (rules.some((rule) => rule.type === "ATTEMPT_COUNTER")) {
      await tx.update(drawRules).set({ config: { lastUsed: attemptNumber } })
        .where(and(eq(drawRules.editionId, input.editionId), eq(drawRules.type, "ATTEMPT_COUNTER")));
    } else {
      await tx.insert(drawRules).values({ editionId: input.editionId, type: "ATTEMPT_COUNTER", config: { lastUsed: attemptNumber } });
    }
    await recordAuditEvent({ event: "draw.generated", actorAdminId: input.generatedByAdminId, editionId: input.editionId, drawId: draw.id }, tx);
    logger.info("draw.generation_succeeded", { editionId: input.editionId, drawId: draw.id, assignmentCount: personalValues.length + babyValues.length, babyAssignmentCount: babyValues.length, durationMs: Math.round(performance.now() - startedAt) });
    return { draw, assignmentCount: personalValues.length + babyValues.length, adultAssignmentCount: personalValues.length, babyAssignmentCount: babyValues.length };
  });
}

export async function revokeEditionDraw(input: { adminId: string; editionId: string; drawId: string; confirmation: string; reason?: string }) {
  if (input.confirmation !== "ANULAR REPARTO") throw new AppError(400, "CONFIRMATION_REQUIRED", "Escribe ANULAR REPARTO para confirmar.");
  return db.transaction(async (tx) => {
    await lockOwnedEdition(tx, input.adminId, input.editionId);
    const [owned] = await tx.select({ draw: draws }).from(draws)
      .where(and(eq(draws.id, input.drawId), eq(draws.editionId, input.editionId))).for("update").limit(1);
    if (!owned) throw new AppError(404, "DRAW_NOT_FOUND", "No se ha encontrado el reparto.");
    if (owned.draw.status === "revoked") return owned.draw;
    const [draw] = await tx.update(draws).set({ status: "revoked", revokedAt: new Date(), revokedByAdminId: input.adminId, revokeReason: input.reason || null })
      .where(eq(draws.id, input.drawId)).returning();
    const editionPeople = await tx.select({ participant: participants, config: editionParticipants }).from(editionParticipants)
      .innerJoin(participants, eq(editionParticipants.participantId, participants.id))
      .where(eq(editionParticipants.editionId, input.editionId));
    for (const { participant, config } of editionPeople) {
      if (participant.isBaby === config.isBaby) continue;
      await tx.update(editionParticipants).set({
        isBaby: participant.isBaby,
        canGive: !participant.isBaby,
        canReceive: true,
        preferredChannel: participant.isBaby || participant.preferredChannel === "manual" ? null : participant.preferredChannel,
        updatedAt: new Date()
      }).where(eq(editionParticipants.id, config.id));
    }
    await tx.update(drawEditions).set({ status: "ready", updatedAt: new Date() }).where(eq(drawEditions.id, input.editionId));
    await recordAuditEvent({ event: "draw.revoked", actorAdminId: input.adminId, editionId: input.editionId, drawId: draw.id }, tx);
    return draw;
  });
}
