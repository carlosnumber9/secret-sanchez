import type { APIRoute } from "astro";
import { z } from "zod";
import { createOwnedGroup } from "@/actions/adminData";
import { handleApiError } from "@/lib/api";
import { logger } from "@/lib/logger";

const schema = z.object({
  name: z.string().trim().min(2).max(180),
  year: z.number().int().min(2020).max(2100)
});

export const POST: APIRoute = async ({ locals, request }) => {
  try {
    const parsed = schema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      return Response.json({ ok: false, message: "Revisa el nombre y el año." }, { status: 400 });
    }
    const group = await createOwnedGroup(locals.admin.id, parsed.data);
    logger.info("group.created", { groupId: group.id, adminId: locals.admin.id });
    return Response.json({ ok: true, data: group }, { status: 201 });
  } catch (error) {
    return handleApiError("group.create_failed", error, { adminId: locals.admin.id });
  }
};
