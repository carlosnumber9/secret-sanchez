import type { APIRoute } from "astro";
import { Resend } from "resend";
import { z } from "zod";
import { applyEmailEvent } from "@/db/queries/notifications";
import { getEnv } from "@/lib/env";
import { handleApiError } from "@/lib/api";
import { emailEvents } from "@/services/notifications/emailStatus";

const schema = z.object({ type: z.enum(emailEvents), data: z.object({ email_id: z.string().min(1).max(200) }) });
export const POST: APIRoute = async ({ request }) => {
  const { resendWebhookSecret } = getEnv();
  if (!resendWebhookSecret) return Response.json({ ok: false }, { status: 503 });
  let verified: unknown;
  try {
    verified = new Resend("webhook-verification-only").webhooks.verify({
      payload: await request.text(), webhookSecret: resendWebhookSecret,
      headers: { id: request.headers.get("svix-id") ?? "", timestamp: request.headers.get("svix-timestamp") ?? "", signature: request.headers.get("svix-signature") ?? "" }
    });
  } catch { return Response.json({ ok: false }, { status: 401 }); }
  const parsed = schema.safeParse(verified);
  if (!parsed.success) return Response.json({ ok: true, ignored: true });
  try {
    if (!await applyEmailEvent(parsed.data.data.email_id, parsed.data.type)) return Response.json({ ok: false, retry: true }, { status: 503, headers: { "Retry-After": "2" } });
    return Response.json({ ok: true });
  } catch (error) { return handleApiError("resend.webhook_failed", error); }
};
