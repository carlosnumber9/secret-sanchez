import type { APIRoute } from "astro";
import { z } from "zod";
import { sendAdminNotifications } from "@/actions/notifications";
import { handleApiError } from "@/lib/api";

const schema = z.object({
  mode: z.enum(["pending", "failed", "force"]),
  scope: z.enum(["all", "selected"]),
  assignmentIds: z.array(z.uuid()).max(500).optional(),
  cursor: z.number().int().min(0).max(1000).optional(),
  drawId: z.uuid().optional(),
  idempotencyKey: z.uuid(),
  confirmed: z.literal(true)
});
export const POST: APIRoute = async ({ locals, params, request }) => {
  try {
    const editionId = z.uuid().parse(params.id);
    const input = schema.parse(await request.json().catch(() => null));
    return Response.json({
      ok: true,
      data: await sendAdminNotifications({
        ...input,
        editionId,
        admin: { id: locals.admin.id, email: locals.admin.email }
      })
    });
  } catch (error) {
    return handleApiError("notification.batch_failed", error, { adminId: locals.admin.id });
  }
};
