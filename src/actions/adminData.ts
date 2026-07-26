import { and, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { drawRules, familyGroups, familyIslands, participants } from "@/db/schema";
import { getActiveFamilyGroupForAdmin, getOwnedFamilyGroup } from "@/db/queries/familyGroups";
import { listFamilyIslands } from "@/db/queries/familyIslands";
import { getLatestOwnedDraw } from "@/db/queries/draws";
import { listParticipants } from "@/db/queries/participants";
import { listAssignmentsForDraw } from "@/db/queries/assignments";
import { listNotificationLogsForDraw } from "@/db/queries/notifications";
import { listDrawRules, listExclusionRules } from "@/db/queries/drawRules";
import { AppError } from "@/lib/errors";
import { isOwnedByAdmin } from "@/services/admin/policies";

export async function getAdminAppState(adminId: string) {
  const group = await getActiveFamilyGroupForAdmin(adminId);
  if (!group) {
    return {
      group: null,
      islands: [],
      participants: [],
      rules: [],
      exclusions: [],
      draw: null,
      deliveries: []
    };
  }

  const [islands, people, rules, exclusions, draw] = await Promise.all([
    listFamilyIslands(group.id),
    listParticipants(group.id),
    listDrawRules(group.id),
    listExclusionRules(group.id),
    getLatestOwnedDraw(group.id)
  ]);

  if (!draw) {
    return { group, islands, participants: people, rules, exclusions, draw: null, deliveries: [] };
  }

  const [assignmentRows, logRows] = await Promise.all([
    listAssignmentsForDraw(draw.id),
    listNotificationLogsForDraw(draw.id)
  ]);
  const logs = logRows.map(({ log }) => log);

  const deliveries = assignmentRows.map(({ assignment, giver }) => {
    const assignmentLogs = logs.filter((log) => log.assignmentId === assignment.id);
    const latestFor = (channel: "email" | "whatsapp" | "manual") =>
      assignmentLogs.find((log) => log.channel === channel)?.status ?? null;

    return {
      id: assignment.id,
      name: giver.name,
      preferredChannel: giver.preferredChannel,
      emailStatus:
        giver.preferredChannel === "manual"
          ? ("skipped" as const)
          : giver.email
            ? latestFor("email") ?? ("pending" as const)
            : ("missing" as const),
      manualStatus: latestFor("manual") ?? ("pending" as const),
      legacyToken: !assignment.revealTokenCiphertext,
      opened: Boolean(assignment.openedAt)
    };
  });

  return { group, islands, participants: people, rules, exclusions, draw, deliveries };
}

export async function createOwnedGroup(adminId: string, input: { name: string; year: number }) {
  const slugBase = input.name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  const slug = `${slugBase || "familia"}-${input.year}-${crypto.randomUUID().slice(0, 6)}`;

  return db.transaction(async (tx) => {
    const [group] = await tx
      .insert(familyGroups)
      .values({ name: input.name, year: input.year, slug, ownerAdminId: adminId })
      .returning();
    await tx.insert(drawRules).values({ groupId: group.id, type: "NO_SAME_ISLAND", enabled: true, config: {} });
    return group;
  });
}

export async function createOwnedIsland(
  adminId: string,
  input: { groupId: string; name: string; color?: string; description?: string }
) {
  const group = await getOwnedFamilyGroup(input.groupId, adminId);
  if (!group || !isOwnedByAdmin(group.ownerAdminId, adminId)) {
    throw new AppError(403, "GROUP_FORBIDDEN", "No puedes modificar este grupo.");
  }
  const [island] = await db.insert(familyIslands).values(input).returning();
  return island;
}

export async function updateOwnedIsland(
  adminId: string,
  islandId: string,
  input: { name?: string; color?: string; description?: string }
) {
  const [owned] = await db
    .select({ island: familyIslands })
    .from(familyIslands)
    .innerJoin(familyGroups, eq(familyIslands.groupId, familyGroups.id))
    .where(and(eq(familyIslands.id, islandId), eq(familyGroups.ownerAdminId, adminId)))
    .limit(1);
  if (!owned) throw new AppError(404, "ISLAND_NOT_FOUND", "No se ha encontrado el núcleo.");

  const [island] = await db
    .update(familyIslands)
    .set({ ...input, updatedAt: new Date() })
    .where(eq(familyIslands.id, islandId))
    .returning();
  return island;
}

export async function createOwnedParticipant(
  adminId: string,
  input: {
    groupId: string;
    familyIslandId: string;
    name: string;
    email?: string;
    phone?: string;
    preferredChannel: "email" | "manual";
  }
) {
  const [owned] = await db
    .select({ island: familyIslands })
    .from(familyIslands)
    .innerJoin(familyGroups, eq(familyIslands.groupId, familyGroups.id))
    .where(
      and(
        eq(familyIslands.id, input.familyIslandId),
        eq(familyIslands.groupId, input.groupId),
        eq(familyGroups.ownerAdminId, adminId)
      )
    )
    .limit(1);
  if (!owned) throw new AppError(403, "ISLAND_FORBIDDEN", "No puedes añadir personas a este núcleo.");

  const [participant] = await db
    .insert(participants)
    .values({
      ...input,
      email: input.email || null,
      phone: input.phone || null
    })
    .returning();
  return participant;
}

export async function updateOwnedParticipant(
  adminId: string,
  participantId: string,
  input: Partial<{
    name: string;
    email: string | null;
    phone: string | null;
    active: boolean;
    preferredChannel: "email" | "manual";
  }>
) {
  const [owned] = await db
    .select({ participant: participants })
    .from(participants)
    .innerJoin(familyGroups, eq(participants.groupId, familyGroups.id))
    .where(and(eq(participants.id, participantId), eq(familyGroups.ownerAdminId, adminId)))
    .limit(1);
  if (!owned) throw new AppError(404, "PARTICIPANT_NOT_FOUND", "No se ha encontrado la persona.");

  const [participant] = await db
    .update(participants)
    .set({ ...input, updatedAt: new Date() })
    .where(eq(participants.id, participantId))
    .returning();
  return participant;
}
