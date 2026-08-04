import type { APIRoute } from "astro";
import { z } from "zod";
import { prepareManualDelivery } from "@/actions/notifications";
import { handleApiError } from "@/lib/api";

const schema = z.object({ assignmentId: z.uuid() });

export const POST: APIRoute = async ({ locals, request }) => {
  try {
    const input = schema.parse(await request.json().catch(() => null));
    const result = await prepareManualDelivery({ ...input, adminId: locals.admin.id });
    return Response.json({ ok: true, data: result });
  } catch (error) {
    return handleApiError("notification.manual_failed", error, { adminId: locals.admin.id });
  }
};
