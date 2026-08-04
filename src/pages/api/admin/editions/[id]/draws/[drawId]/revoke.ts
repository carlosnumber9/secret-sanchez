import type { APIRoute } from "astro";
import { z } from "zod";
import { revokeEditionDraw } from "@/actions/editionData";
import { handleApiError } from "@/lib/api";

const schema = z.object({ confirmation: z.literal("ANULAR REPARTO"), reason: z.string().trim().max(1000).optional() });
export const POST: APIRoute = async ({ locals, params, request }) => {
  try {
    const editionId = z.uuid().parse(params.id);
    const drawId = z.uuid().parse(params.drawId);
    const input = schema.parse(await request.json().catch(() => null));
    return Response.json({ ok: true, data: await revokeEditionDraw({ adminId: locals.admin.id, editionId, drawId, ...input }) });
  } catch (error) {
    return handleApiError("draw.revoke_failed", error, { adminId: locals.admin.id });
  }
};
