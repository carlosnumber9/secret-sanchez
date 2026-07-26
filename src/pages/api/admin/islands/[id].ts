import type { APIRoute } from "astro";
import { z } from "zod";
import { updateOwnedIsland } from "@/actions/adminData";
import { handleApiError } from "@/lib/api";
import { logger } from "@/lib/logger";

const schema = z.object({
  name: z.string().trim().min(1).max(180).optional(),
  color: z.string().trim().max(32).optional(),
  description: z.string().trim().max(1000).optional()
});

export const PATCH: APIRoute = async ({ locals, params, request }) => {
  try {
    const id = z.uuid().parse(params.id);
    const input = schema.parse(await request.json().catch(() => null));
    const island = await updateOwnedIsland(locals.admin.id, id, input);
    logger.info("island.updated", { groupId: island.groupId, islandId: island.id });
    return Response.json({ ok: true, data: island });
  } catch (error) {
    return handleApiError("island.update_failed", error, { adminId: locals.admin.id });
  }
};
