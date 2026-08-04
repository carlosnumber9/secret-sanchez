import type { APIRoute } from "astro";
import { z } from "zod";
import { updateEditionIsland } from "@/actions/editionData";
import { handleApiError } from "@/lib/api";

export const PATCH: APIRoute = async ({ locals, params, request }) => {
  try {
    const editionId = z.uuid().parse(params.id);
    const islandId = z.uuid().parse(params.islandId);
    const { enabled } = z.object({ enabled: z.boolean() }).parse(await request.json().catch(() => null));
    return Response.json({ ok: true, data: await updateEditionIsland(locals.admin.id, editionId, islandId, enabled) });
  } catch (error) {
    return handleApiError("edition.island_update_failed", error, { adminId: locals.admin.id });
  }
};
