import type { APIRoute } from "astro";
import type { getAdminAppState } from "@/actions/adminData";
import { familyView } from "@/lib/admin-view-models";
import { handleApiError } from "@/lib/api";

export function createFamilyReadHandler(read: typeof getAdminAppState = async (...args) => {
  const { getAdminAppState } = await import("@/actions/adminData");
  return getAdminAppState(...args);
}): APIRoute {
  return async ({ locals }) => {
    try {
      return Response.json({ ok: true, data: familyView(await read(locals.admin.id, { editions: false })) });
    } catch (error) { return handleApiError("family.layout_failed", error); }
  };
}

export const GET = createFamilyReadHandler();
