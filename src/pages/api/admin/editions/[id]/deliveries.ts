import type { APIRoute } from "astro";
import { z } from "zod";
import type { getEditionAppState } from "@/actions/editionData";
import { handleApiError } from "@/lib/api";

export function createDeliveriesReadHandler(read: typeof getEditionAppState = async (...args) => {
  const { getEditionAppState } = await import("@/actions/editionData");
  return getEditionAppState(...args);
}): APIRoute {
  return async ({ locals, params }) => {
    try {
      const state = await read(locals.admin.id, z.uuid().parse(params.id), "deliveries");
      return Response.json({ ok: true, data: { deliveries: state.deliveries, drawId: state.currentDraw?.id ?? null } });
    } catch (error) { return handleApiError("edition.state.failed", error); }
  };
}

export const GET = createDeliveriesReadHandler();
