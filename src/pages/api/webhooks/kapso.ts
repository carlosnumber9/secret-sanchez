import { createHmac, timingSafeEqual } from "node:crypto";
import type { APIRoute } from "astro";
import { z } from "zod";
import { findNotificationByProviderMessageId, updateNotificationLog } from "@/db/queries/notifications";
import { getEnv } from "@/lib/env";
import { logger } from "@/lib/logger";
import { shouldApplyWhatsappStatus, type WhatsappDeliveryStatus } from "@/services/notifications/whatsappStatus";

const payloadSchema = z.object({
  message: z.object({
    id: z.string().min(1),
    kapso: z.object({ status: z.enum(["sent", "delivered", "read", "failed"]) })
  })
});

function validSignature(rawBody: string, signature: string, secret: string) {
  const expected = createHmac("sha256", secret).update(rawBody).digest("hex");
  const providedBuffer = Buffer.from(signature, "hex");
  const expectedBuffer = Buffer.from(expected, "hex");
  return providedBuffer.length === expectedBuffer.length && timingSafeEqual(providedBuffer, expectedBuffer);
}

export const POST: APIRoute = async ({ request }) => {
  const secret = getEnv().kapsoWebhookSecret;
  if (!secret) return Response.json({ ok: false }, { status: 503 });
  const rawBody = await request.text();
  const signature = request.headers.get("x-webhook-signature") ?? "";
  if (!validSignature(rawBody, signature, secret)) {
    logger.warn("kapso.webhook_rejected", { reason: "invalid_signature" });
    return Response.json({ ok: false }, { status: 401 });
  }
  const parsed = payloadSchema.safeParse(JSON.parse(rawBody));
  if (!parsed.success) return Response.json({ ok: true, ignored: true });
  const status = parsed.data.message.kapso.status as WhatsappDeliveryStatus;
  const log = await findNotificationByProviderMessageId(parsed.data.message.id);
  if (!log || log.channel !== "whatsapp") return Response.json({ ok: true, ignored: true });
  if (shouldApplyWhatsappStatus(log.status, status)) {
    await updateNotificationLog(log.id, { status, error: status === "failed" ? "delivery_failed" : null });
  }
  logger.info("kapso.delivery_updated", { notificationId: log.id, assignmentId: log.assignmentId, status });
  return Response.json({ ok: true });
};
