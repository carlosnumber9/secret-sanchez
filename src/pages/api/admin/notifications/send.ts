import type { APIRoute } from "astro";
import { z } from "zod";
import { sendAdminNotifications } from "@/actions/notifications";
import { handleApiError } from "@/lib/api";
import { logger } from "@/lib/logger";

const schema = z.object({
  mode: z.enum(["pending", "failed"]),
  idempotencyKey: z.uuid(),
  confirmed: z.literal(true)
});

export const POST: APIRoute = async ({ locals, request }) => {
  try {
    const input = schema.parse(await request.json().catch(() => null));
    const result = await sendAdminNotifications({ ...input, adminId: locals.admin.id });
    logger.info("notification.batch_completed", {
      adminId: locals.admin.id,
      sentCount: result.sent,
      failedCount: result.failed,
      skippedCount: result.skipped
    });
    return Response.json({ ok: true, data: result });
  } catch (error) {
    return handleApiError("notification.batch_failed", error, { adminId: locals.admin.id });
  }
};
