import type { APIRoute } from "astro";
import { z } from "zod";
import { saveOwnedFamilyDraft } from "@/actions/adminData";
import { handleApiError } from "@/lib/api";
import { logger } from "@/lib/logger";

const islandSchema = z.object({
  clientId: z.string().trim().min(1).max(100),
  id: z.uuid().nullable(),
  name: z.string().trim().min(1).max(180),
  color: z.string().trim().max(32)
});

const participantSchema = z.object({
  clientId: z.string().trim().min(1).max(100),
  id: z.uuid().nullable(),
  familyIslandClientId: z.string().trim().min(1).max(100),
  name: z.string().trim().min(1).max(180),
  email: z.union([z.email(), z.literal("")]),
  phone: z.union([z.string().trim().regex(/^\+[1-9]\d{7,14}$/), z.literal("")]),
  preferredChannel: z.enum(["email", "whatsapp", "both"]).nullable(),
  sortOrder: z.number().int().nonnegative(),
  isBaby: z.boolean()
});

const schema = z.object({
  islands: z.array(islandSchema).max(100),
  participants: z.array(participantSchema).max(500),
  confirmedParticipantDeletionIds: z.array(z.uuid()).max(500),
  confirmedIslandDeletionIds: z.array(z.uuid()).max(100)
}).superRefine(({ islands, participants }, context) => {
  const islandClientIds = islands.map(({ clientId }) => clientId);
  if (new Set(islandClientIds).size !== islandClientIds.length) {
    context.addIssue({ code: "custom", message: "Hay unidades duplicadas." });
  }
  const persistedIslandIds = islands.flatMap(({ id }) => id ? [id] : []);
  if (new Set(persistedIslandIds).size !== persistedIslandIds.length) {
    context.addIssue({ code: "custom", message: "Hay unidades persistidas duplicadas." });
  }
  const participantClientIds = participants.map(({ clientId }) => clientId);
  if (new Set(participantClientIds).size !== participantClientIds.length) {
    context.addIssue({ code: "custom", message: "Hay personas duplicadas en la disposición." });
  }
  const persistedParticipantIds = participants.flatMap(({ id }) => id ? [id] : []);
  if (new Set(persistedParticipantIds).size !== persistedParticipantIds.length) {
    context.addIssue({ code: "custom", message: "Hay personas persistidas duplicadas." });
  }
  if (participants.some(({ familyIslandClientId }) => !islandClientIds.includes(familyIslandClientId))) {
    context.addIssue({ code: "custom", message: "Una persona apunta a una unidad inexistente." });
  }
  for (const participant of participants) {
    if (participant.isBaby) continue;
    if ((participant.preferredChannel === "email" || participant.preferredChannel === "both") && !participant.email) {
      context.addIssue({ code: "custom", message: `${participant.name} no tiene email para el canal elegido.` });
    }
    if ((participant.preferredChannel === "whatsapp" || participant.preferredChannel === "both") && !participant.phone) {
      context.addIssue({ code: "custom", message: `${participant.name} no tiene teléfono para el canal elegido.` });
    }
  }
  const positions = participants.map(({ familyIslandClientId, sortOrder }) => `${familyIslandClientId}:${sortOrder}`);
  if (new Set(positions).size !== positions.length) {
    context.addIssue({ code: "custom", message: "Hay posiciones duplicadas en una unidad." });
  }
});

export const PATCH: APIRoute = async ({ locals, params, request }) => {
  try {
    const familyId = z.uuid().parse(params.id);
    const parsed = schema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      return Response.json({ ok: false, message: "El borrador de la familia no es válido." }, { status: 400 });
    }
    const draft = await saveOwnedFamilyDraft(locals.admin.id, familyId, parsed.data);
    logger.info("family.draft_saved", {
      familyId,
      islandCount: draft.islands.length,
      participantCount: draft.islands.reduce((count, island) => count + island.participants.length, 0)
    });
    return Response.json({ ok: true, data: draft });
  } catch (error) {
    return handleApiError("family.layout_update_failed", error, { adminId: locals.admin.id });
  }
};
