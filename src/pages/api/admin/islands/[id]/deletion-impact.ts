import type { APIRoute } from "astro";
import { z } from "zod";
import { getIslandDeletionImpact } from "@/actions/adminData";
import { handleApiError } from "@/lib/api";

export const GET: APIRoute = async ({ locals, params }) => {
  try {
    const id = z.uuid().parse(params.id);
    return Response.json({ ok: true, data: await getIslandDeletionImpact(locals.admin.id, id) });
  } catch (error) {
    return handleApiError("island.deletion_impact_failed", error, { adminId: locals.admin.id });
  }
};
