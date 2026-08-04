import type { APIRoute } from "astro";
import { z } from "zod";
import { updateEditionParticipant } from "@/actions/editionData";
import { handleApiError } from "@/lib/api";

const schema = z.object({
  enabled: z.boolean(),
  canGive: z.boolean(),
  canReceive: z.boolean(),
  preferredChannel: z.enum(["email", "whatsapp", "both"]).nullable()
});
export const PATCH: APIRoute = async ({ locals, params, request }) => {
  try {
    const editionId = z.uuid().parse(params.id);
    const participantId = z.uuid().parse(params.participantId);
    const input = schema.parse(await request.json().catch(() => null));
    return Response.json({ ok: true, data: await updateEditionParticipant(locals.admin.id, editionId, participantId, input) });
  } catch (error) {
    return handleApiError("edition.participant_update_failed", error, { adminId: locals.admin.id });
  }
};
