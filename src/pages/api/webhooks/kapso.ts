import { createHmac, timingSafeEqual } from "node:crypto";
import type { APIRoute } from "astro";
import { z } from "zod";
import { applyWhatsappEvent } from "@/db/queries/notifications";
import { getEnv } from "@/lib/env";
import { handleApiError } from "@/lib/api";
import { logger } from "@/lib/logger";
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
  if (!secret) return Response.json({ ok: false }, { status: 503 });
  const rawBody = await request.text();
  const signature = request.headers.get("x-webhook-signature") ?? "";
  if (!validSignature(rawBody, signature, secret)) {
    logger.warn("kapso.webhook_rejected", { reason: "invalid_signature" });
    return Response.json({ ok: false }, { status: 401 });
  }
  let body: unknown;
  try { body = JSON.parse(rawBody); }
  catch { return Response.json({ ok: false }, { status: 400 }); }
  const parsed = payloadSchema.safeParse(body);
  if (!parsed.success) return Response.json({ ok: true, ignored: true });
  try {
    const applied = await applyWhatsappEvent(parsed.data.message.id, parsed.data.message.kapso.status as WhatsappDeliveryStatus);
    if (!applied) return Response.json({ ok: false, retry: true }, { status: 503, headers: { "Retry-After": "2" } });
    logger.info("kapso.delivery_updated", { status: parsed.data.message.kapso.status });
    return Response.json({ ok: true });
  } catch (error) {
    return handleApiError("kapso.webhook_failed", error);
  }
};
