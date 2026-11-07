import type { APIRoute } from "astro";
import { z } from "zod";
import type { renameOwnedFamilyMember } from "@/actions/familyNames";
import { handleApiError } from "@/lib/api";
import { logger } from "@/lib/logger";

const schema = z.object({
  revision: z.string().regex(/^[a-f0-9]{64}$/),
  kind: z.enum(["island", "participant"]),
  id: z.uuid(),
  name: z.string().trim().min(1).max(180)
}).strict();

type Rename = typeof renameOwnedFamilyMember;

export function createFamilyNameHandler(rename: Rename = async (...args) => {
  const { renameOwnedFamilyMember } = await import("@/actions/familyNames");
  return renameOwnedFamilyMember(...args);
}): APIRoute {
  return async ({ locals, params, request }) => {
    try {
      const familyId = z.uuid().parse(params.id);
      const input = schema.parse(await request.json().catch(() => null));
      const result = await rename(locals.admin.id, familyId, input);
      logger.info("family.name_updated", { familyId, kind: input.kind, entityId: input.id });
      return Response.json({ ok: true, data: result });
    } catch (error) {
      return handleApiError("family.name_update_failed", error, { adminId: locals.admin.id });
    }
  };
}

export const PATCH = createFamilyNameHandler();
