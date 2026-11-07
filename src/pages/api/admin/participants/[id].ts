import { phonePattern } from "@/lib/contact";
import type { APIRoute } from "astro";
import { z } from "zod";
import { deleteOwnedParticipant, updateOwnedParticipant } from "@/actions/adminData";
import { handleApiError } from "@/lib/api";
import { logger } from "@/lib/logger";

const schema = z.object({
  name: z.string().trim().min(1).max(180).optional(),
  email: z.union([z.email(), z.literal(""), z.null()]).optional(),
  phone: z.union([z.string().trim().regex(phonePattern), z.literal(""), z.null()]).optional(),
  familyIslandId: z.uuid().optional(),
  preferredChannel: z.enum(["email", "whatsapp", "both"]).nullable().optional(),
  isBaby: z.boolean().optional()
});

export const PATCH: APIRoute = async ({ locals, params, request }) => {
  try {
    const id = z.uuid().parse(params.id);
    const parsed = schema.parse(await request.json().catch(() => null));
    const input = { ...parsed, email: parsed.email === "" ? null : parsed.email, phone: parsed.phone === "" ? null : parsed.phone };
    const participant = await updateOwnedParticipant(locals.admin.id, id, input);
    logger.info("participant.updated", {
      familyId: participant.familyId,
      participantId: participant.id
    });
    return Response.json({ ok: true, data: participant });
  } catch (error) {
    return handleApiError("participant.update_failed", error, { adminId: locals.admin.id });
  }
};

const deleteSchema = z.object({ confirmation: z.literal("ELIMINAR PERSONA") });

export const DELETE: APIRoute = async ({ locals, params, request }) => {
  try {
    const id = z.uuid().parse(params.id);
    const input = deleteSchema.parse(await request.json().catch(() => null));
    const result = await deleteOwnedParticipant(locals.admin.id, id, input.confirmation);
    return Response.json({ ok: true, data: result });
  } catch (error) {
    return handleApiError("participant.delete_failed", error, { adminId: locals.admin.id });
  }
};
