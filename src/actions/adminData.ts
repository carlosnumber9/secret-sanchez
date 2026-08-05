import { and, desc, eq, inArray, ne, sql } from "drizzle-orm";
import { db } from "@/db/client";
import {
  assignments,
  drawEditions,
  drawParticipants,
  draws,
  editionIslandConfigs,
  editionParticipants,
  families,
  familyIslands,
  notificationLogs,
  participants
} from "@/db/schema";
import { getActiveFamilyGroupForAdmin, getOwnedFamilyGroup } from "@/db/queries/familyGroups";
import { listFamilyIslands } from "@/db/queries/familyIslands";
import { listParticipants } from "@/db/queries/participants";
import { AppError } from "@/lib/errors";

export async function getAdminAppState(adminId: string) {
  const family = await getActiveFamilyGroupForAdmin(adminId);
  if (!family) return { family: null, group: null, islands: [], participants: [], editions: [] };

  const [islands, people, editions] = await Promise.all([
    listFamilyIslands(family.id),
    listParticipants(family.id),
    db.select().from(drawEditions).where(eq(drawEditions.familyId, family.id))
      .orderBy(desc(drawEditions.year), desc(drawEditions.createdAt))
  ]);
  return { family, group: family, islands, participants: people, editions };
}

export async function createOwnedGroup(adminId: string, input: { name: string }) {
  const slugBase = input.name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase()
    .replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  const [family] = await db.insert(families).values({
    name: input.name,
    slug: `${slugBase || "familia"}-${crypto.randomUUID().slice(0, 6)}`,
    ownerAdminId: adminId
  }).returning();
  return family;
}

export async function createOwnedIsland(adminId: string, input: { familyId: string; name: string; color?: string; description?: string }) {
  const family = await getOwnedFamilyGroup(input.familyId, adminId);
  if (!family) throw new AppError(403, "FAMILY_FORBIDDEN", "No puedes modificar esta familia.");

  return db.transaction(async (tx) => {
    const [island] = await tx.insert(familyIslands).values(input).returning();
    const editions = await tx.select({ id: drawEditions.id }).from(drawEditions).where(eq(drawEditions.familyId, family.id));
    if (editions.length) {
      await tx.insert(editionIslandConfigs).values(editions.map(({ id }) => ({ editionId: id, familyIslandId: island.id, enabled: true })));
    }
    return island;
  });
}

export async function updateOwnedIsland(adminId: string, islandId: string, input: { name?: string; color?: string; description?: string }) {
  const [owned] = await db.select({ island: familyIslands }).from(familyIslands)
    .innerJoin(families, eq(familyIslands.familyId, families.id))
    .where(and(eq(familyIslands.id, islandId), eq(families.ownerAdminId, adminId))).limit(1);
  if (!owned) throw new AppError(404, "ISLAND_NOT_FOUND", "No se ha encontrado el núcleo.");
  const [island] = await db.update(familyIslands).set({ ...input, updatedAt: new Date() })
    .where(eq(familyIslands.id, islandId)).returning();
  return island;
}

export async function createOwnedParticipant(adminId: string, input: {
  familyId: string;
  familyIslandId: string;
  name: string;
  email?: string;
  phone?: string;
  preferredChannel?: "email" | "whatsapp" | "both" | null;
  isBaby: boolean;
}) {
  const [owned] = await db.select({ island: familyIslands }).from(familyIslands)
    .innerJoin(families, eq(familyIslands.familyId, families.id))
    .where(and(eq(familyIslands.id, input.familyIslandId), eq(familyIslands.familyId, input.familyId), eq(families.ownerAdminId, adminId))).limit(1);
  if (!owned) throw new AppError(403, "ISLAND_FORBIDDEN", "No puedes añadir personas a este núcleo.");

  return db.transaction(async (tx) => {
    const [lastPosition] = await tx.select({ value: sql<number>`coalesce(max(${participants.sortOrder}), -1)::int` })
      .from(participants).where(eq(participants.familyIslandId, input.familyIslandId));
    const [participant] = await tx.insert(participants).values({
      ...input,
      email: input.isBaby ? null : input.email || null,
      phone: input.isBaby ? null : input.phone || null,
      preferredChannel: input.isBaby ? null : input.preferredChannel ?? "email",
      sortOrder: lastPosition.value + 1
    }).returning();
    const editions = await tx.select({ id: drawEditions.id }).from(drawEditions).where(eq(drawEditions.familyId, input.familyId));
    if (editions.length) {
      await tx.insert(editionParticipants).values(editions.map(({ id }) => ({
        editionId: id,
        participantId: participant.id,
        enabled: false,
        canGive: !participant.isBaby,
        canReceive: true,
        isBaby: participant.isBaby,
        preferredChannel: participant.isBaby ? null : participant.preferredChannel
      })));
    }
    return participant;
  });
}

export async function updateOwnedFamilyLayout(adminId: string, familyId: string, layout: Array<{
  id: string;
  familyIslandId: string;
  sortOrder: number;
  isBaby: boolean;
}>) {
  return db.transaction(async (tx) => {
    const [family] = await tx.select({ id: families.id }).from(families)
      .where(and(eq(families.id, familyId), eq(families.ownerAdminId, adminId))).for("update").limit(1);
    if (!family) throw new AppError(404, "FAMILY_NOT_FOUND", "No se ha encontrado la familia.");

    const islandRows = await tx.select({ id: familyIslands.id }).from(familyIslands)
      .where(eq(familyIslands.familyId, familyId));
    const participantRows = await tx.select().from(participants)
      .where(eq(participants.familyId, familyId)).for("update");
    const islandIds = new Set(islandRows.map(({ id }) => id));
    const currentById = new Map(participantRows.map((participant) => [participant.id, participant]));
    if (layout.length !== participantRows.length || layout.some((item) => !currentById.has(item.id))) {
      throw new AppError(409, "FAMILY_LAYOUT_STALE", "La familia ha cambiado. Recarga la página antes de guardar.");
    }
    if (layout.some((item) => !islandIds.has(item.familyIslandId))) {
      throw new AppError(422, "ISLAND_MISMATCH", "Una de las unidades ya no pertenece a esta familia.");
    }

    const changedBabyIds: string[] = [];
    const updated = [];
    for (const item of layout) {
      const current = currentById.get(item.id)!;
      if (current.isBaby !== item.isBaby) changedBabyIds.push(item.id);
      const babyValues = item.isBaby ? { email: null, phone: null, preferredChannel: null } : {};
      const [participant] = await tx.update(participants).set({
        familyIslandId: item.familyIslandId,
        sortOrder: item.sortOrder,
        isBaby: item.isBaby,
        ...babyValues,
        updatedAt: new Date()
      }).where(and(eq(participants.id, item.id), eq(participants.familyId, familyId))).returning();
      updated.push(participant);
    }

    if (changedBabyIds.length) {
      const activeDrawEditions = await tx.select({ editionId: draws.editionId }).from(draws)
        .innerJoin(drawEditions, eq(draws.editionId, drawEditions.id))
        .where(and(eq(drawEditions.familyId, familyId), ne(draws.status, "revoked")));
      const lockedEditionIds = new Set(activeDrawEditions.map(({ editionId }) => editionId));
      const editionRows = await tx.select({ id: drawEditions.id }).from(drawEditions)
        .where(eq(drawEditions.familyId, familyId));
      for (const participantId of changedBabyIds) {
        const participant = updated.find(({ id }) => id === participantId)!;
        for (const edition of editionRows) {
          if (lockedEditionIds.has(edition.id)) continue;
          await tx.update(editionParticipants).set({
            isBaby: participant.isBaby,
            canGive: !participant.isBaby,
            canReceive: true,
            preferredChannel: participant.isBaby ? null : participant.preferredChannel,
            updatedAt: new Date()
          }).where(and(
            eq(editionParticipants.editionId, edition.id),
            eq(editionParticipants.participantId, participantId)
          ));
        }
      }
    }

    return updated;
  });
}

export async function updateOwnedParticipant(adminId: string, participantId: string, input: Partial<{
  name: string;
  email: string | null;
  phone: string | null;
  familyIslandId: string;
  preferredChannel: "email" | "whatsapp" | "both" | null;
  isBaby: boolean;
}>) {
  const [owned] = await db.select({ participant: participants }).from(participants)
    .innerJoin(families, eq(participants.familyId, families.id))
    .where(and(eq(participants.id, participantId), eq(families.ownerAdminId, adminId))).limit(1);
  if (!owned) throw new AppError(404, "PARTICIPANT_NOT_FOUND", "No se ha encontrado la persona.");
  if (input.familyIslandId) {
    const [target] = await db.select({ id: familyIslands.id }).from(familyIslands)
      .where(and(eq(familyIslands.id, input.familyIslandId), eq(familyIslands.familyId, owned.participant.familyId))).limit(1);
    if (!target) throw new AppError(422, "ISLAND_MISMATCH", "El núcleo no pertenece a esta familia.");
  }
  return db.transaction(async (tx) => {
    const effectiveBaby = input.isBaby ?? owned.participant.isBaby;
    const values = effectiveBaby
      ? { ...input, email: null, phone: null, preferredChannel: null, updatedAt: new Date() }
      : { ...input, updatedAt: new Date() };
    const [participant] = await tx.update(participants).set(values)
      .where(eq(participants.id, participantId)).returning();

    if (input.isBaby !== undefined) {
      const editionRows = await tx.select({ id: drawEditions.id }).from(drawEditions)
        .where(eq(drawEditions.familyId, participant.familyId));
      const currentDrawRows = await tx.select({ editionId: draws.editionId }).from(draws)
        .where(ne(draws.status, "revoked"));
      const lockedEditionIds = new Set(currentDrawRows.map(({ editionId }) => editionId));
      for (const edition of editionRows) {
        if (lockedEditionIds.has(edition.id)) continue;
        await tx.update(editionParticipants).set({
          isBaby: participant.isBaby,
          canGive: participant.isBaby ? false : true,
          canReceive: true,
          preferredChannel: participant.isBaby ? null : participant.preferredChannel,
          updatedAt: new Date()
        }).where(and(eq(editionParticipants.editionId, edition.id), eq(editionParticipants.participantId, participant.id)));
      }
    }
    return participant;
  });
}

export async function getParticipantDeletionImpact(adminId: string, participantId: string) {
  const [owned] = await db.select({ participant: participants }).from(participants)
    .innerJoin(families, eq(participants.familyId, families.id))
    .where(and(eq(participants.id, participantId), eq(families.ownerAdminId, adminId))).limit(1);
  if (!owned) throw new AppError(404, "PARTICIPANT_NOT_FOUND", "No se ha encontrado la persona.");

  const [stats] = await db.select({
    editions: sql<number>`count(distinct ${editionParticipants.editionId})::int`,
    draws: sql<number>`count(distinct ${drawParticipants.drawId})::int`,
    assignments: sql<number>`count(distinct ${assignments.id})::int`,
    notifications: sql<number>`count(distinct ${notificationLogs.id})::int`,
    opened: sql<number>`count(distinct case when ${assignments.openedAt} is not null then ${assignments.id} end)::int`
  }).from(editionParticipants)
    .leftJoin(drawParticipants, eq(drawParticipants.sourceParticipantId, editionParticipants.participantId))
    .leftJoin(assignments, eq(assignments.drawId, drawParticipants.drawId))
    .leftJoin(notificationLogs, eq(notificationLogs.assignmentId, assignments.id))
    .where(eq(editionParticipants.participantId, participantId));
  return { participant: owned.participant, ...stats };
}

async function deleteDrawsForParticipants(tx: Parameters<Parameters<typeof db.transaction>[0]>[0], participantIds: string[]) {
  if (!participantIds.length) return [] as string[];
  const impacted = await tx.selectDistinct({ drawId: drawParticipants.drawId, editionId: draws.editionId })
    .from(drawParticipants).innerJoin(draws, eq(drawParticipants.drawId, draws.id))
    .where(inArray(drawParticipants.sourceParticipantId, participantIds));
  const drawIds = impacted.map(({ drawId }) => drawId);
  if (drawIds.length) await tx.delete(draws).where(inArray(draws.id, drawIds));
  const editionIds = [...new Set(impacted.map(({ editionId }) => editionId))];
  for (const editionId of editionIds) {
    const [current] = await tx.select({ status: draws.status }).from(draws)
      .where(and(eq(draws.editionId, editionId), ne(draws.status, "revoked"))).limit(1);
    await tx.update(drawEditions).set({
      status: current ? (current.status === "sent" ? "sent" : "drawn") : "ready",
      updatedAt: new Date()
    }).where(eq(drawEditions.id, editionId));
  }
  return editionIds;
}

async function lockFamilyEditions(tx: Parameters<Parameters<typeof db.transaction>[0]>[0], familyId: string) {
  await tx.select({ id: drawEditions.id }).from(drawEditions)
    .where(eq(drawEditions.familyId, familyId)).for("update");
}

export async function deleteOwnedParticipant(adminId: string, participantId: string, confirmation: string) {
  if (confirmation !== "ELIMINAR PERSONA") throw new AppError(400, "CONFIRMATION_REQUIRED", "Escribe ELIMINAR PERSONA para confirmar.");
  return db.transaction(async (tx) => {
    const [owned] = await tx.select({ participant: participants }).from(participants)
      .innerJoin(families, eq(participants.familyId, families.id))
      .where(and(eq(participants.id, participantId), eq(families.ownerAdminId, adminId))).for("update").limit(1);
    if (!owned) throw new AppError(404, "PARTICIPANT_NOT_FOUND", "No se ha encontrado la persona.");
    await lockFamilyEditions(tx, owned.participant.familyId);
    const affectedEditionIds = await deleteDrawsForParticipants(tx, [participantId]);
    await tx.delete(participants).where(eq(participants.id, participantId));
    return { deletedParticipantId: participantId, affectedEditionIds };
  });
}

export async function getIslandDeletionImpact(adminId: string, islandId: string) {
  const [owned] = await db.select({ island: familyIslands }).from(familyIslands)
    .innerJoin(families, eq(familyIslands.familyId, families.id))
    .where(and(eq(familyIslands.id, islandId), eq(families.ownerAdminId, adminId))).limit(1);
  if (!owned) throw new AppError(404, "ISLAND_NOT_FOUND", "No se ha encontrado el núcleo.");
  const people = await db.select({ id: participants.id }).from(participants).where(eq(participants.familyIslandId, islandId));
  const participantIds = people.map(({ id }) => id);
  if (!participantIds.length) return { island: owned.island, participants: 0, draws: 0, notifications: 0, opened: 0 };
  const [stats] = await db.select({
    draws: sql<number>`count(distinct ${drawParticipants.drawId})::int`,
    notifications: sql<number>`count(distinct ${notificationLogs.id})::int`,
    opened: sql<number>`count(distinct case when ${assignments.openedAt} is not null then ${assignments.id} end)::int`
  }).from(drawParticipants)
    .leftJoin(assignments, eq(assignments.drawId, drawParticipants.drawId))
    .leftJoin(notificationLogs, eq(notificationLogs.assignmentId, assignments.id))
    .where(inArray(drawParticipants.sourceParticipantId, participantIds));
  return { island: owned.island, participants: participantIds.length, ...stats };
}

export async function deleteOwnedIsland(adminId: string, islandId: string, input: {
  strategy: "move" | "cascade";
  targetIslandId?: string;
  confirmation?: string;
}) {
  return db.transaction(async (tx) => {
    const [owned] = await tx.select({ island: familyIslands }).from(familyIslands)
      .innerJoin(families, eq(familyIslands.familyId, families.id))
      .where(and(eq(familyIslands.id, islandId), eq(families.ownerAdminId, adminId))).for("update").limit(1);
    if (!owned) throw new AppError(404, "ISLAND_NOT_FOUND", "No se ha encontrado el núcleo.");
    const people = await tx.select({ id: participants.id, sortOrder: participants.sortOrder }).from(participants)
      .where(eq(participants.familyIslandId, islandId)).orderBy(participants.sortOrder, participants.createdAt);

    if (input.strategy === "move") {
      if (!input.targetIslandId || input.targetIslandId === islandId) throw new AppError(422, "TARGET_ISLAND_REQUIRED", "Elige otro núcleo de destino.");
      const [target] = await tx.select({ id: familyIslands.id }).from(familyIslands)
        .where(and(eq(familyIslands.id, input.targetIslandId), eq(familyIslands.familyId, owned.island.familyId))).limit(1);
      if (!target) throw new AppError(422, "TARGET_ISLAND_INVALID", "El núcleo de destino no pertenece a esta familia.");
      const [lastPosition] = await tx.select({ value: sql<number>`coalesce(max(${participants.sortOrder}), -1)::int` })
        .from(participants).where(eq(participants.familyIslandId, target.id));
      for (const [index, person] of people.entries()) {
        await tx.update(participants).set({
          familyIslandId: target.id,
          sortOrder: lastPosition.value + index + 1,
          updatedAt: new Date()
        }).where(eq(participants.id, person.id));
      }
    } else {
      if (people.length && input.confirmation !== "ELIMINAR UNIDAD") throw new AppError(400, "CONFIRMATION_REQUIRED", "Escribe ELIMINAR UNIDAD para confirmar.");
      await lockFamilyEditions(tx, owned.island.familyId);
      await deleteDrawsForParticipants(tx, people.map(({ id }) => id));
      if (people.length) await tx.delete(participants).where(inArray(participants.id, people.map(({ id }) => id)));
    }
    await tx.delete(familyIslands).where(eq(familyIslands.id, islandId));
    return { deletedIslandId: islandId, affectedParticipants: people.length };
  });
}
