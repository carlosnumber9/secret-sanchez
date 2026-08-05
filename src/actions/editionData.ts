import { and, desc, eq, max, ne } from "drizzle-orm";
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
  families,
  familyIslands,
  participants
} from "@/db/schema";
import { listAssignmentsForDraw } from "@/db/queries/assignments";
import { listNotificationLogsForDraw } from "@/db/queries/notifications";
import { AppError } from "@/lib/errors";
import { getEnv } from "@/lib/env";
import { logger } from "@/lib/logger";
import { createRevealToken, encryptRevealToken, hashRevealToken } from "@/lib/tokens";
import { generateDraw as generateDrawAssignments } from "@/services/draw/generateDraw";
import { generateBabyAssignments } from "@/services/draw/generateBabyAssignments";
import { resolveEditionParticipants, validateEditionRoles } from "@/services/editions/configuration";

export type EditionKind = "test" | "final";
type DeliveryChannel = "email" | "whatsapp" | "both" | null;

function availableDeliveryChannel(channel: DeliveryChannel | "manual", email: string | null, phone: string | null): DeliveryChannel {
  const hasEmail = Boolean(email);
  const hasPhone = Boolean(phone && /^\+[1-9]\d{7,14}$/.test(phone));
  if (channel === "both") return hasEmail ? (hasPhone ? "both" : "email") : (hasPhone ? "whatsapp" : null);
  if (channel === "email") return hasEmail ? "email" : null;
  if (channel === "whatsapp") return hasPhone ? "whatsapp" : null;
  return null;
}

async function getOwnedEdition(editionId: string, adminId: string) {
  const [row] = await db.select({ edition: drawEditions, family: families }).from(drawEditions)
    .innerJoin(families, eq(drawEditions.familyId, families.id))
    .where(and(eq(drawEditions.id, editionId), eq(families.ownerAdminId, adminId))).limit(1);
  return row ?? null;
}

export async function listOwnedEditions(adminId: string) {
  return db.select({ edition: drawEditions, family: families }).from(drawEditions)
    .innerJoin(families, eq(drawEditions.familyId, families.id))
    .where(eq(families.ownerAdminId, adminId))
    .orderBy(desc(drawEditions.year), desc(drawEditions.createdAt));
}

export async function createOwnedEdition(adminId: string, input: { familyId: string; name: string; year: number; kind: EditionKind }) {
  const [family] = await db.select().from(families)
    .where(and(eq(families.id, input.familyId), eq(families.ownerAdminId, adminId))).limit(1);
  if (!family) throw new AppError(403, "FAMILY_FORBIDDEN", "No puedes crear ediciones para esta familia.");
  if (input.kind === "final") {
    const [existing] = await db.select({ id: drawEditions.id }).from(drawEditions)
      .where(and(eq(drawEditions.familyId, input.familyId), eq(drawEditions.year, input.year), eq(drawEditions.kind, "final"), ne(drawEditions.status, "archived"))).limit(1);
    if (existing) throw new AppError(409, "FINAL_EDITION_EXISTS", "Ya existe una edición definitiva para este año.");
  }

  return db.transaction(async (tx) => {
    const [edition] = await tx.insert(drawEditions).values({ ...input, status: "ready", createdByAdminId: adminId }).returning();
    const [islands, people] = await Promise.all([
      tx.select({ id: familyIslands.id }).from(familyIslands).where(eq(familyIslands.familyId, input.familyId)),
      tx.select({
        id: participants.id,
        isBaby: participants.isBaby,
        preferredChannel: participants.preferredChannel,
        email: participants.email,
        phone: participants.phone
      }).from(participants).where(eq(participants.familyId, input.familyId))
    ]);
    if (islands.length) await tx.insert(editionIslandConfigs).values(islands.map(({ id }) => ({ editionId: edition.id, familyIslandId: id, enabled: true })));
    if (people.length) await tx.insert(editionParticipants).values(people.map((person) => ({
      editionId: edition.id,
      participantId: person.id,
      enabled: true,
      canGive: !person.isBaby,
      canReceive: true,
      isBaby: person.isBaby,
      preferredChannel: person.isBaby ? null : availableDeliveryChannel(person.preferredChannel, person.email, person.phone)
    })));
    await tx.insert(drawRules).values({ editionId: edition.id, type: "NO_SAME_ISLAND", enabled: true, config: {} });
    return edition;
  });
}

export async function updateOwnedEdition(adminId: string, editionId: string, input: { name?: string; year?: number }) {
  const owned = await getOwnedEdition(editionId, adminId);
  if (!owned) throw new AppError(404, "EDITION_NOT_FOUND", "No se ha encontrado la edición.");
  const [current] = await db.select({ id: draws.id }).from(draws).where(and(eq(draws.editionId, editionId), ne(draws.status, "revoked"))).limit(1);
  if (current) throw new AppError(409, "EDITION_LOCKED", "Revoca el reparto antes de editar la edición.");
  const [edition] = await db.update(drawEditions).set({ ...input, updatedAt: new Date() }).where(eq(drawEditions.id, editionId)).returning();
  return edition;
}

async function assertEditionEditable(adminId: string, editionId: string) {
  const owned = await getOwnedEdition(editionId, adminId);
  if (!owned) throw new AppError(404, "EDITION_NOT_FOUND", "No se ha encontrado la edición.");
  const [current] = await db.select({ id: draws.id }).from(draws).where(and(eq(draws.editionId, editionId), ne(draws.status, "revoked"))).limit(1);
  if (current) throw new AppError(409, "EDITION_LOCKED", "Revoca el reparto antes de cambiar participantes.");
  return owned;
}

export async function updateEditionIsland(adminId: string, editionId: string, islandId: string, input: { enabled?: boolean; representativeParticipantId?: string | null }) {
  const owned = await assertEditionEditable(adminId, editionId);
  const [island] = await db.select({ id: familyIslands.id }).from(familyIslands)
    .where(and(eq(familyIslands.id, islandId), eq(familyIslands.familyId, owned.family.id))).limit(1);
  if (!island) throw new AppError(404, "ISLAND_NOT_FOUND", "El núcleo no pertenece a esta edición.");
  if (input.representativeParticipantId) {
    const [representative] = await db.select({ id: participants.id }).from(participants)
      .innerJoin(editionParticipants, and(eq(editionParticipants.participantId, participants.id), eq(editionParticipants.editionId, editionId)))
      .where(and(
        eq(participants.id, input.representativeParticipantId),
        eq(participants.familyIslandId, islandId),
        eq(participants.isBaby, false),
        eq(editionParticipants.enabled, true)
      )).limit(1);
    if (!representative) throw new AppError(422, "INVALID_ISLAND_REPRESENTATIVE", "El representante debe ser un adulto activo de la unidad.");
  }
  const [config] = await db.update(editionIslandConfigs).set({ ...input, updatedAt: new Date() })
    .where(and(eq(editionIslandConfigs.editionId, editionId), eq(editionIslandConfigs.familyIslandId, islandId))).returning();
  if (!config) throw new AppError(404, "ISLAND_CONFIG_NOT_FOUND", "No se ha encontrado la configuración del núcleo.");
  return config;
}

export async function updateEditionParticipant(adminId: string, editionId: string, participantId: string, input: { enabled: boolean; canGive: boolean; canReceive: boolean; preferredChannel: "email" | "whatsapp" | "both" | null }) {
  await assertEditionEditable(adminId, editionId);
  const [person] = await db.select({
    isBaby: participants.isBaby,
    email: participants.email,
    phone: participants.phone
  }).from(participants)
    .where(eq(participants.id, participantId)).limit(1);
  if (!person) throw new AppError(404, "PARTICIPANT_NOT_FOUND", "No se ha encontrado la persona.");
  if (person.isBaby && (input.canGive || !input.canReceive || input.preferredChannel !== null)) {
    throw new AppError(422, "INVALID_BABY_CONFIGURATION", "Un bebé activo recibe, no regala y no tiene canal de contacto.");
  }
  if (input.preferredChannel !== availableDeliveryChannel(input.preferredChannel, person.email, person.phone)) {
    throw new AppError(422, "MISSING_DELIVERY_CONTACT", "Ese canal no está disponible hasta que añadas el contacto en Familia.");
  }
  if (input.enabled && !input.canGive && !input.canReceive) throw new AppError(422, "PARTICIPANT_WITHOUT_ROLE", "Una persona activa debe regalar, recibir o ambas cosas.");
  const [config] = await db.update(editionParticipants).set({ ...input, updatedAt: new Date() })
    .where(and(eq(editionParticipants.editionId, editionId), eq(editionParticipants.participantId, participantId))).returning();
  if (!config) throw new AppError(404, "PARTICIPANT_CONFIG_NOT_FOUND", "La persona no pertenece a esta edición.");
  return config;
}

export async function getEditionAppState(adminId: string, editionId: string) {
  const owned = await getOwnedEdition(editionId, adminId);
  if (!owned) throw new AppError(404, "EDITION_NOT_FOUND", "No se ha encontrado la edición.");
  const [islandRows, participantRows, attempts, rules, exclusions] = await Promise.all([
    db.select({ island: familyIslands, config: editionIslandConfigs }).from(editionIslandConfigs)
      .innerJoin(familyIslands, eq(editionIslandConfigs.familyIslandId, familyIslands.id))
      .where(eq(editionIslandConfigs.editionId, editionId)),
    db.select({ participant: participants, config: editionParticipants }).from(editionParticipants)
      .innerJoin(participants, eq(editionParticipants.participantId, participants.id))
      .where(eq(editionParticipants.editionId, editionId)),
    db.select().from(draws).where(eq(draws.editionId, editionId)).orderBy(desc(draws.attemptNumber)),
    db.select().from(drawRules).where(eq(drawRules.editionId, editionId)),
    db.select().from(exclusionRules).where(eq(exclusionRules.editionId, editionId))
  ]);
  const currentDraw = attempts.find((attempt) => attempt.status !== "revoked") ?? null;
  let deliveries: Array<{
    id: string;
    name: string;
    giverKind: "participant" | "familyIsland";
    preferredChannel: "email" | "whatsapp" | "both" | null;
    emailStatus: "skipped" | "pending" | "missing" | "sent" | "delivered" | "failed" | "read";
    whatsappStatus: "skipped" | "pending" | "missing" | "sent" | "delivered" | "failed" | "read";
    legacyToken: boolean;
    opened: boolean;
  }> = [];
  let exposure = { notifications: 0, manual: 0, opened: 0 };
  if (currentDraw) {
    const [assignmentRows, logRows] = await Promise.all([listAssignmentsForDraw(currentDraw.id), listNotificationLogsForDraw(currentDraw.id)]);
    const logs = logRows.map(({ log }) => log);
    deliveries = assignmentRows.map(({ assignment, giver, giverIsland }) => {
      const assignmentLogs = logs.filter((log) => log.assignmentId === assignment.id);
      const latestFor = (channel: "email" | "whatsapp") => {
        const status = assignmentLogs.find((log) => log.channel === channel)?.status;
        return status === "sent" || status === "pending" || status === "delivered" || status === "failed" || status === "read" ? status : null;
      };
      const rawChannel = giver?.preferredChannel ?? giverIsland?.preferredChannel ?? null;
      const channel = rawChannel === "manual" ? null : rawChannel;
      const email = giver?.email ?? giverIsland?.representativeEmail ?? null;
      const phone = giver?.phone ?? giverIsland?.representativePhone ?? null;
      const usesEmail = channel === "email" || channel === "both";
      const usesWhatsapp = channel === "whatsapp" || channel === "both";
      return {
        id: assignment.id,
        name: giver?.name ?? `${giverIsland!.name} · ${giverIsland!.representativeName}`,
        giverKind: giver ? "participant" as const : "familyIsland" as const,
        preferredChannel: channel,
        emailStatus: usesEmail ? (email ? latestFor("email") ?? "pending" as const : "missing" as const) : "skipped" as const,
        whatsappStatus: usesWhatsapp ? (phone ? latestFor("whatsapp") ?? "pending" as const : "missing" as const) : "skipped" as const,
        legacyToken: !assignment.revealTokenCiphertext,
        opened: Boolean(assignment.openedAt)
      };
    });
    exposure = {
      notifications: logs.filter((log) => log.channel === "email" || log.channel === "whatsapp").length,
      manual: logs.filter((log) => log.channel === "manual").length,
      opened: assignmentRows.filter(({ assignment }) => assignment.openedAt).length
    };
  }
  return { ...owned, islands: islandRows, participants: participantRows, attempts, currentDraw, rules, exclusions, deliveries, exposure };
}

export async function generateEditionDraw(input: { editionId: string; generatedByAdminId: string }) {
  const startedAt = performance.now();
  return db.transaction(async (tx) => {
    const [owned] = await tx.select({ edition: drawEditions, family: families }).from(drawEditions)
      .innerJoin(families, eq(drawEditions.familyId, families.id))
      .where(and(eq(drawEditions.id, input.editionId), eq(families.ownerAdminId, input.generatedByAdminId))).for("update").limit(1);
    if (!owned) throw new AppError(403, "EDITION_FORBIDDEN", "No puedes sortear esta edición.");
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
        || ((channel === "whatsapp" || channel === "both") && (!participant.phone || !/^\+[1-9]\d{7,14}$/.test(participant.phone)));
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
        || ((channel === "whatsapp" || channel === "both") && (!representative.participant.phone || !/^\+[1-9]\d{7,14}$/.test(representative.participant.phone)));
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

    const [draw] = await tx.insert(draws).values({
      editionId: input.editionId,
      attemptNumber: (attempt[0]?.value ?? 0) + 1,
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
    const personalValues = generatedAdults.assignments.map((assignment) => {
      const token = createRevealToken();
      return {
        drawId: draw.id,
        giverId: snapshotBySource.get(assignment.giverId)!,
        receiverId: snapshotBySource.get(assignment.receiverId)!,
        revealTokenHash: hashRevealToken(token),
        revealTokenCiphertext: encryptRevealToken(token)
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
        revealTokenCiphertext: encryptRevealToken(token)
      };
    });
    await tx.insert(assignments).values([...personalValues, ...babyValues]);
    await tx.update(drawEditions).set({ status: "drawn", updatedAt: new Date() }).where(eq(drawEditions.id, input.editionId));
    logger.info("draw.generation_succeeded", { editionId: input.editionId, drawId: draw.id, assignmentCount: personalValues.length + babyValues.length, babyAssignmentCount: babyValues.length, durationMs: Math.round(performance.now() - startedAt) });
    return { draw, assignmentCount: personalValues.length + babyValues.length, adultAssignmentCount: personalValues.length, babyAssignmentCount: babyValues.length };
  });
}

export async function revokeEditionDraw(input: { adminId: string; editionId: string; drawId: string; confirmation: string; reason?: string }) {
  if (input.confirmation !== "ANULAR REPARTO") throw new AppError(400, "CONFIRMATION_REQUIRED", "Escribe ANULAR REPARTO para confirmar.");
  return db.transaction(async (tx) => {
    const [owned] = await tx.select({ draw: draws }).from(draws)
      .innerJoin(drawEditions, eq(draws.editionId, drawEditions.id))
      .innerJoin(families, eq(drawEditions.familyId, families.id))
      .where(and(eq(draws.id, input.drawId), eq(draws.editionId, input.editionId), eq(families.ownerAdminId, input.adminId))).for("update").limit(1);
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
    return draw;
  });
}
