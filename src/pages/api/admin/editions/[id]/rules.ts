import type { APIRoute } from "astro";
import { z } from "zod";
import { updateEditionRules } from "@/actions/editionRules";
import { handleApiError } from "@/lib/api";

export const PUT: APIRoute = async ({ locals, params, request }) => {
  try {
    const editionId = z.uuid().parse(params.id);
    return Response.json({ ok: true, data: await updateEditionRules(locals.admin.id, editionId, await request.json().catch(() => null)) });
  } catch (error) { return handleApiError("edition.rules_update_failed", error, { adminId: locals.admin.id }); }
};
