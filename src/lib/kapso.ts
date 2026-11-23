import { observe, logger } from "@/lib/logger";
import { NotificationRateLimitError } from "@/services/notifications/retry";
import { getEnv } from "./env";

type SendWhatsappInput = {
  phone: string;
  name: string;
  revealUrl: string;
};

export async function sendKapsoMessage(input: SendWhatsappInput) {
  return observe("provider.whatsapp", { provider: "kapso" }, async () => {
    const { kapsoApiKey, kapsoPhoneNumberId, kapsoTemplateName, kapsoTemplateLanguage } = getEnv();
    if (!kapsoApiKey || !kapsoPhoneNumberId || !kapsoTemplateName || !kapsoTemplateLanguage) {
      logger.warn("provider.result", { result: "rejected", reason: "configuration_missing" });
      return { ok: false as const, error: "Kapso no está completamente configurado." };
    }
    const response = await fetch(`https://api.kapso.ai/meta/whatsapp/v24.0/${encodeURIComponent(kapsoPhoneNumberId)}/messages`, {
      method: "POST",
      signal: AbortSignal.timeout(20_000),
      headers: { "Content-Type": "application/json", "X-API-Key": kapsoApiKey },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to: input.phone.replace(/^\+/, ""),
        type: "template",
        template: {
          name: kapsoTemplateName,
          language: { code: kapsoTemplateLanguage },
          components: [{
            type: "body",
            parameters: [
              { type: "text", text: input.name },
              { type: "text", text: input.revealUrl }
            ]
          }]
        }
      })
    });
    logger.info("provider.result", { httpStatus: response.status, result: response.status === 429 ? "retry" : response.status >= 500 ? "unknown" : response.ok ? "succeeded" : "rejected" });
    if (response.status === 429) throw new NotificationRateLimitError(response.headers.get("retry-after"));
    if (response.status >= 500) throw new Error("WhatsApp outcome unknown.");
    const payload = await response.json().catch(() => null) as { messages?: Array<{ id?: string }> } | null;
    const providerMessageId = payload?.messages?.[0]?.id;
    if (response.ok && !providerMessageId) {
      logger.warn("provider.result", { reason: "outcome_unknown", result: "unknown" });
      throw new Error("WhatsApp outcome unknown.");
    }
    if (!response.ok || !providerMessageId) return { ok: false as const, error: `Kapso rechazó el envío (${response.status}).` };
    return { ok: true as const, providerMessageId };

  }, r => ({ result: r.ok ? "accepted" : "rejected", providerMessageId: r.providerMessageId }), { provider: true });
}
