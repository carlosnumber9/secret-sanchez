import { getEnv } from "./env";

type SendWhatsappInput = {
  phone: string;
  name: string;
  revealUrl: string;
};

export async function sendKapsoMessage(input: SendWhatsappInput) {
  const { kapsoApiKey, kapsoPhoneNumberId, kapsoTemplateName, kapsoTemplateLanguage } = getEnv();
  if (!kapsoApiKey || !kapsoPhoneNumberId || !kapsoTemplateName || !kapsoTemplateLanguage) {
    return { ok: false as const, error: "Kapso no está completamente configurado." };
  }
  const response = await fetch(`https://api.kapso.ai/meta/whatsapp/v24.0/${encodeURIComponent(kapsoPhoneNumberId)}/messages`, {
    method: "POST",
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
  const payload = await response.json().catch(() => null) as { messages?: Array<{ id?: string }> } | null;
  const providerMessageId = payload?.messages?.[0]?.id;
  if (!response.ok || !providerMessageId) return { ok: false as const, error: `Kapso rechazó el envío (${response.status}).` };
  return { ok: true as const, providerMessageId };
}
