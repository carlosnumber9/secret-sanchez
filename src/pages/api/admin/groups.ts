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
      logger.warn("family.create_failed", { reason: "invalid_input", changedFields: ["name"], status: 400 });
      return Response.json({ ok: false, message: "Revisa el nombre de la familia." }, { status: 400 });
    }
    const family = await createOwnedGroup(locals.admin.id, parsed.data);
    logger.info("family.created", { familyId: family.id });
    return Response.json({ ok: true, data: family }, { status: 201 });
  } catch (error) {
    return handleApiError("family.create_failed", error);
  }
};
