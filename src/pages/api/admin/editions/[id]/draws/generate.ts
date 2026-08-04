import type { APIRoute } from "astro";
import { z } from "zod";
import { generateEditionDraw } from "@/actions/editionData";
import { handleApiError } from "@/lib/api";

export const POST: APIRoute = async ({ locals, params, request }) => {
  try {
    const editionId = z.uuid().parse(params.id);
    z.object({ confirmed: z.literal(true) }).parse(await request.json().catch(() => null));
    const result = await generateEditionDraw({ editionId, generatedByAdminId: locals.admin.id });
    return Response.json({ ok: true, message: "Reparto generado.", data: result });
  } catch (error) {
    return handleApiError("draw.generation_failed", error, { adminId: locals.admin.id });
  }
};
