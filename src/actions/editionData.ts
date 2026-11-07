import { availableDeliveryChannel, participantPhoneIsValid, type DeliveryChannel } from "@/lib/contact";
import { lockOwnedFamily, withEditableEdition } from "@/db/locks";
import { and, desc, eq, ne } from "drizzle-orm";
import { db } from "@/db/client";
import {
  drawEditions,
  drawRules,
  draws,
  editionIslandConfigs,
  editionParticipants,
  exclusionRules,
  families,
  familyIslands,
  participants
} from "@/db/schema";
import { listDeliveryAssignmentsForDraw } from "@/db/queries/assignments";
import { getDrawExposure, listCurrentNotificationLogsForDraw } from "@/db/queries/notifications";
import { AppError } from "@/lib/errors";

export type EditionKind = "test" | "final";
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
  return db.transaction(async (tx) => {
    await lockOwnedFamily(tx, adminId, input.familyId);
    if (input.kind === "final") {
      const [existing] = await tx.select({ id: drawEditions.id }).from(drawEditions)
        .where(and(eq(drawEditions.familyId, input.familyId), eq(drawEditions.year, input.year), eq(drawEditions.kind, "final"), ne(drawEditions.status, "archived"))).limit(1);
      if (existing) throw new AppError(409, "FINAL_EDITION_EXISTS", "Ya existe una edición definitiva para este año.");
    }
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
      preferredChannel: person.isBaby ? null : availableDeliveryChannel(person.preferredChannel, Boolean(person.email), participantPhoneIsValid(person.phone ?? ""))
    })));
    await tx.insert(drawRules).values({ editionId: edition.id, type: "NO_SAME_ISLAND", enabled: true, config: {} });
    return edition;
  });
}

export async function updateOwnedEdition(adminId: string, editionId: string, input: { name?: string; year?: number }) {
  return withEditableEdition(adminId, editionId, async (tx) => {
    const [edition] = await tx.update(drawEditions).set({ ...input, updatedAt: new Date() }).where(eq(drawEditions.id, editionId)).returning();
    return edition;
  });
}

export async function updateEditionIsland(adminId: string, editionId: string, islandId: string, input: { enabled?: boolean; representativeParticipantId?: string | null }) {
  return withEditableEdition(adminId, editionId, async (tx, owned) => {
    const [island] = await tx.select({ id: familyIslands.id }).from(familyIslands)
      .where(and(eq(familyIslands.id, islandId), eq(familyIslands.familyId, owned.family.id))).limit(1);
    if (!island) throw new AppError(404, "ISLAND_NOT_FOUND", "El núcleo no pertenece a esta edición.");
    if (input.representativeParticipantId) {
      const [representative] = await tx.select({ id: participants.id }).from(participants)
        .innerJoin(editionParticipants, and(eq(editionParticipants.participantId, participants.id), eq(editionParticipants.editionId, editionId)))
        .where(and(
          eq(participants.id, input.representativeParticipantId),
          eq(participants.familyIslandId, islandId),
          eq(participants.isBaby, false),
          eq(editionParticipants.enabled, true)
        )).limit(1);
      if (!representative) throw new AppError(422, "INVALID_ISLAND_REPRESENTATIVE", "El representante debe ser un adulto activo de la unidad.");
    }
    const [config] = await tx.update(editionIslandConfigs).set({ ...input, updatedAt: new Date() })
      .where(and(eq(editionIslandConfigs.editionId, editionId), eq(editionIslandConfigs.familyIslandId, islandId))).returning();
    if (!config) throw new AppError(404, "ISLAND_CONFIG_NOT_FOUND", "No se ha encontrado la configuración del núcleo.");
    return config;
  });
}

export async function updateEditionParticipant(adminId: string, editionId: string, participantId: string, input: { enabled: boolean; canGive: boolean; canReceive: boolean; preferredChannel: "email" | "whatsapp" | "both" | null }) {
  return withEditableEdition(adminId, editionId, async (tx, owned) => {
    const [person] = await tx.select({
      isBaby: participants.isBaby,
      email: participants.email,
      phone: participants.phone
    }).from(participants)
      .where(and(eq(participants.id, participantId), eq(participants.familyId, owned.family.id))).limit(1);
    if (!person) throw new AppError(404, "PARTICIPANT_NOT_FOUND", "No se ha encontrado la persona.");
    if (person.isBaby && (input.canGive || !input.canReceive || input.preferredChannel !== null)) {
      throw new AppError(422, "INVALID_BABY_CONFIGURATION", "Un bebé activo recibe, no regala y no tiene canal de contacto.");
    }
    if (input.preferredChannel !== availableDeliveryChannel(input.preferredChannel, Boolean(person.email), participantPhoneIsValid(person.phone ?? ""))) {
      throw new AppError(422, "MISSING_DELIVERY_CONTACT", "Ese canal no está disponible hasta que añadas el contacto en Familia.");
    }
    if (input.enabled && !input.canGive && !input.canReceive) throw new AppError(422, "PARTICIPANT_WITHOUT_ROLE", "Una persona activa debe regalar, recibir o ambas cosas.");
    const [config] = await tx.update(editionParticipants).set({ ...input, updatedAt: new Date() })
      .where(and(eq(editionParticipants.editionId, editionId), eq(editionParticipants.participantId, participantId))).returning();
    if (!config) throw new AppError(404, "PARTICIPANT_CONFIG_NOT_FOUND", "La persona no pertenece a esta edición.");
    return config;
  });
}

export async function getEditionAppState(adminId: string, editionId: string, view: "configuration" | "draw" | "deliveries" = "configuration") {
  const owned = await getOwnedEdition(editionId, adminId);
  if (!owned) throw new AppError(404, "EDITION_NOT_FOUND", "No se ha encontrado la edición.");
  const [islandRows, participantRows, attempts, rules, exclusions] = await Promise.all([
    view === "deliveries" ? Promise.resolve([]) : db.select({ island: familyIslands, config: editionIslandConfigs }).from(editionIslandConfigs)
      .innerJoin(familyIslands, eq(editionIslandConfigs.familyIslandId, familyIslands.id))
      .where(eq(editionIslandConfigs.editionId, editionId)),
    view === "deliveries" ? Promise.resolve([]) : db.select({ participant: participants, config: editionParticipants }).from(editionParticipants)
      .innerJoin(participants, eq(editionParticipants.participantId, participants.id))
      .where(eq(editionParticipants.editionId, editionId)),
    db.select().from(draws).where(and(eq(draws.editionId, editionId), view === "configuration" ? undefined : ne(draws.status, "revoked"))).orderBy(desc(draws.attemptNumber)),
    view !== "configuration" ? Promise.resolve([]) : db.select().from(drawRules).where(eq(drawRules.editionId, editionId)),
    view !== "configuration" ? Promise.resolve([]) : db.select().from(exclusionRules).where(eq(exclusionRules.editionId, editionId))
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
  let exposure: { notifications: number; manual: number | null; opened: number } = { notifications: 0, manual: null, opened: 0 };
  if (currentDraw && view === "configuration") exposure = await getDrawExposure(currentDraw.id);
  if (currentDraw && view === "deliveries") {
    const [assignmentRows, logRows] = await Promise.all([listDeliveryAssignmentsForDraw(currentDraw.id), listCurrentNotificationLogsForDraw(currentDraw.id)]);
    const logs = new Map(logRows.map(({ log }) => [`${log.assignmentId}:${log.channel}`, log]));
    deliveries = assignmentRows.map(({ assignment, giver, giverIsland }) => {
      const latestFor = (channel: "email" | "whatsapp") => {
        const status = logs.get(`${assignment.id}:${channel}`)?.status;
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
  }
  return { ...owned, islands: islandRows, participants: participantRows, attempts, currentDraw, rules, exclusions, deliveries, exposure };
}

export { generateEditionDraw, revokeEditionDraw } from "./drawLifecycle";
