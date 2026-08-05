import type { APIRoute } from "astro";
import { z } from "zod";
import { updateOwnedFamilyLayout } from "@/actions/adminData";
import { handleApiError } from "@/lib/api";
import { logger } from "@/lib/logger";

const participantSchema = z.object({
  id: z.uuid(),
  familyIslandId: z.uuid(),
  sortOrder: z.number().int().nonnegative(),
  isBaby: z.boolean()
});

const schema = z.object({
  participants: z.array(participantSchema).max(500)
}).superRefine(({ participants }, context) => {
  if (new Set(participants.map(({ id }) => id)).size !== participants.length) {
    context.addIssue({ code: "custom", message: "Hay personas duplicadas en la disposición." });
  }
  const positions = participants.map(({ familyIslandId, sortOrder }) => `${familyIslandId}:${sortOrder}`);
  if (new Set(positions).size !== positions.length) {
    context.addIssue({ code: "custom", message: "Hay posiciones duplicadas en una unidad." });
  }
});

export const PATCH: APIRoute = async ({ locals, params, request }) => {
  try {
    const familyId = z.uuid().parse(params.id);
    const parsed = schema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      return Response.json({ ok: false, message: "La disposición de la familia no es válida." }, { status: 400 });
    }
    const participants = await updateOwnedFamilyLayout(locals.admin.id, familyId, parsed.data.participants);
    logger.info("family.layout_updated", { familyId, participantCount: participants.length });
    return Response.json({ ok: true, data: participants });
  } catch (error) {
    return handleApiError("family.layout_update_failed", error, { adminId: locals.admin.id });
  }
};
