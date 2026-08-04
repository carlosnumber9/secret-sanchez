import type { APIRoute } from "astro";
import { z } from "zod";
import { updateEditionIsland } from "@/actions/editionData";
import { handleApiError } from "@/lib/api";

export const PATCH: APIRoute = async ({ locals, params, request }) => {
  try {
    const editionId = z.uuid().parse(params.id);
    const islandId = z.uuid().parse(params.islandId);
    const input = z.object({ enabled: z.boolean().optional(), representativeParticipantId: z.uuid().nullable().optional() }).parse(await request.json().catch(() => null));
    return Response.json({ ok: true, data: await updateEditionIsland(locals.admin.id, editionId, islandId, input) });
  } catch (error) {
    return handleApiError("edition.island_update_failed", error, { adminId: locals.admin.id });
  }
};
