import type { APIRoute } from "astro";
import { z } from "zod";
import { createOwnedIsland } from "@/actions/adminData";
import { handleApiError } from "@/lib/api";
import { logger } from "@/lib/logger";

const schema = z.object({
  groupId: z.uuid(),
  name: z.string().trim().min(1).max(180),
  color: z.string().trim().max(32).optional(),
  description: z.string().trim().max(1000).optional()
});

export const POST: APIRoute = async ({ locals, request }) => {
  try {
    const parsed = schema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return Response.json({ ok: false, message: "Datos del núcleo no válidos." }, { status: 400 });
    const island = await createOwnedIsland(locals.admin.id, parsed.data);
    logger.info("island.created", { groupId: island.groupId, islandId: island.id });
    return Response.json({ ok: true, data: island }, { status: 201 });
  } catch (error) {
    return handleApiError("island.create_failed", error, { adminId: locals.admin.id });
  }
};
