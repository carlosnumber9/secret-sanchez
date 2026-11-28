import { editionView } from "@/lib/admin-view-models";
import type { APIRoute } from "astro";
import { z } from "zod";
import { getEditionAppState, updateOwnedEdition } from "@/actions/editionData";
import { handleApiError } from "@/lib/api";

const schema = z.object({ name: z.string().trim().min(2).max(180).optional(), year: z.number().int().min(2020).max(2100).optional() });
export const PATCH: APIRoute = async ({ locals, params, request }) => {
  try {
    const id = z.uuid().parse(params.id);
    const input = schema.parse(await request.json().catch(() => null));
    return Response.json({ ok: true, data: await updateOwnedEdition(locals.admin.id, id, input) });
  } catch (error) {
    return handleApiError("edition.update_failed", error);
  }
};

export const GET: APIRoute = async ({ locals, params }) => {
  try {
    return Response.json({ ok: true, data: editionView(await getEditionAppState(locals.admin.id, z.uuid().parse(params.id))) });
  } catch (error) { return handleApiError("edition.state.failed", error); }
};
