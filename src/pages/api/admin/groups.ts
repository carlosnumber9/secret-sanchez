import type { APIRoute } from "astro";
import { z } from "zod";
import { createOwnedGroup } from "@/actions/adminData";
import { handleApiError } from "@/lib/api";
import { logger } from "@/lib/logger";

const schema = z.object({
  name: z.string().trim().min(2).max(180)
});

export const POST: APIRoute = async ({ locals, request }) => {
  try {
    const parsed = schema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      return Response.json({ ok: false, message: "Revisa el nombre de la familia." }, { status: 400 });
    }
    const family = await createOwnedGroup(locals.admin.id, parsed.data);
    logger.info("family.created", { familyId: family.id, adminId: locals.admin.id });
    return Response.json({ ok: true, data: family }, { status: 201 });
  } catch (error) {
    return handleApiError("group.create_failed", error, { adminId: locals.admin.id });
  }
};
