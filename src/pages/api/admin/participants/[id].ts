import type { APIRoute } from "astro";
import { z } from "zod";
import { updateOwnedParticipant } from "@/actions/adminData";
import { handleApiError } from "@/lib/api";
import { logger } from "@/lib/logger";

const schema = z.object({
  name: z.string().trim().min(1).max(180).optional(),
  email: z.union([z.email(), z.literal(""), z.null()]).optional(),
  phone: z.union([z.string().trim().max(48), z.null()]).optional(),
  active: z.boolean().optional(),
  preferredChannel: z.enum(["email", "manual"]).optional()
});

export const PATCH: APIRoute = async ({ locals, params, request }) => {
  try {
    const id = z.uuid().parse(params.id);
    const parsed = schema.parse(await request.json().catch(() => null));
    const input = { ...parsed, email: parsed.email === "" ? null : parsed.email };
    const participant = await updateOwnedParticipant(locals.admin.id, id, input);
    logger.info("participant.updated", {
      groupId: participant.groupId,
      participantId: participant.id,
      active: participant.active
    });
    return Response.json({ ok: true, data: participant });
  } catch (error) {
    return handleApiError("participant.update_failed", error, { adminId: locals.admin.id });
  }
};
