import { createHmac, timingSafeEqual } from "node:crypto";
import type { APIRoute } from "astro";
import { z } from "zod";
import { applyWhatsappEvent } from "@/db/queries/notifications";
import { getEnv } from "@/lib/env";
import { handleApiError } from "@/lib/api";
import { logger, setLogActor } from "@/lib/logger";
import { type WhatsappDeliveryStatus } from "@/services/notifications/whatsappStatus";

const payloadSchema = z.object({
  message: z.object({
    id: z.string().min(1),
    kapso: z.object({ status: z.enum(["sent", "delivered", "read", "failed"]) })
  })
});

function validSignature(rawBody: string, signature: string, secret: string) {
  if (!/^[a-fA-F0-9]{64}$/.test(signature)) return false;
  const expected = createHmac("sha256", secret).update(rawBody).digest("hex");
  const providedBuffer = Buffer.from(signature, "hex");
  const expectedBuffer = Buffer.from(expected, "hex");
  return providedBuffer.length === expectedBuffer.length && timingSafeEqual(providedBuffer, expectedBuffer);
}

export const POST: APIRoute = async ({ request }) => {
  const secret = getEnv().kapsoWebhookSecret;
  if (!secret) {
    logger.warn("kapso.webhook_rejected", { reason: "configuration_missing", status: 503 });
    return Response.json({ ok: false }, { status: 503 });
  }
  const rawBody = await request.text();
  const signature = request.headers.get("x-webhook-signature") ?? "";
  if (!validSignature(rawBody, signature, secret)) {
    logger.warn("kapso.webhook_rejected", { reason: "invalid_signature" });
    return Response.json({ ok: false }, { status: 401 });
  }
  setLogActor({ actorType: "provider", provider: "kapso" });
  let body: unknown;
  try { body = JSON.parse(rawBody); }
  catch {
    logger.warn("kapso.webhook_rejected", { reason: "invalid_json", status: 400 });
    return Response.json({ ok: false }, { status: 400 });
  }
  const parsed = payloadSchema.safeParse(body);
  if (!parsed.success) {
    logger.info("kapso.webhook_ignored", { reason: "unsupported_event", result: "ignored" });
    return Response.json({ ok: true, ignored: true });
  }
  try {
    const applied = await applyWhatsappEvent(parsed.data.message.id, parsed.data.message.kapso.status as WhatsappDeliveryStatus);
    if (!applied.found) {
      logger.warn("kapso.delivery_updated", { providerMessageId: parsed.data.message.id, reason: "message_unknown", result: "retry" });
      return Response.json({ ok: false, retry: true }, { status: 503, headers: { "Retry-After": "2" } });
    }
    logger.info("kapso.delivery_updated", { providerMessageId: parsed.data.message.id, notificationId: applied.notificationId, assignmentId: applied.assignmentId, nextStatus: applied.nextStatus, result: applied.applied ? "applied" : "ignored", reason: applied.applied ? "applied" : "unchanged" });
    return Response.json({ ok: true });
  } catch (error) {
    return handleApiError("kapso.webhook_failed", error);
  }
};
