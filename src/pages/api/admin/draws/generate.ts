import type { APIRoute } from "astro";
import { z } from "zod";
import { generateDraw } from "@/actions/generateDraw";
import { handleApiError } from "@/lib/api";

const schema = z.object({ groupId: z.uuid(), confirmed: z.literal(true) });

export const POST: APIRoute = async ({ locals, request }) => {
  try {
    const input = schema.parse(await request.json().catch(() => null));
    const result = await generateDraw({
      groupId: input.groupId,
      generatedByAdminId: locals.admin.id
    });
    return Response.json({
      ok: true,
      message: "Sorteo realizado. Revisa los envíos antes de contactar con la familia.",
      data: result
    });
  } catch (error) {
    return handleApiError("draw.generation_failed", error, { adminId: locals.admin.id });
  }
};
