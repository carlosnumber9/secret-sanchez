import { observe, logger } from "@/lib/logger";
import { NotificationRateLimitError } from "./retry";
import { getResendClient } from "@/lib/resend";

type Input = {
  to: string;
  name: string;
  revealUrl: string;
  testMode?: boolean;
  idempotencyKey?: string;
};

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (character) => {
    const entities: Record<string, string> = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;"
    };
    return entities[character];
  });
}

export async function sendEmailNotification({ to, name, revealUrl, testMode = false, idempotencyKey }: Input) {
  return observe("provider.email", { provider: "resend" }, async () => {
    const resend = getResendClient();
    if (!resend) {
      logger.warn("provider.result", { result: "rejected", reason: "configuration_missing" });
      return {
        ok: false,
        error: "RESEND_API_KEY no está configurada."
      };
    }

    const result = await resend.emails.send({
      from: "Secret Sánchez <amigo-invisible@secret-sanchez.app>",
      to,
      subject: `${testMode ? "[PRUEBA] " : ""}Tu Amigo Invisible de Reyes ya está listo`,
      text: `${testMode ? `Este email de prueba simula la entrega destinada a ${name}.\n\n` : ""}Ya está listo el Amigo Invisible de Reyes.\n\nHola ${name}, abre tu enlace secreto para descubrir a quién regalas:\n\n${revealUrl}\n\nNo lo compartas.`,
      html: `${testMode ? `<p><strong>PRUEBA:</strong> este mensaje simula la entrega destinada a ${escapeHtml(name)}.</p>` : ""}<p>Ya está listo el Amigo Invisible de Reyes.</p><p>Hola ${escapeHtml(name)}, abre tu enlace secreto para descubrir a quién regalas:</p><p><a href="${escapeHtml(revealUrl)}">${escapeHtml(revealUrl)}</a></p><p>No lo compartas.</p>`
    }, { idempotencyKey, signal: AbortSignal.timeout(20_000) });

    if (result.error) {
      logger.warn("provider.result", { httpStatus: result.error.statusCode, result: result.error.statusCode === 429 ? "retry" : !result.error.statusCode || result.error.statusCode >= 500 ? "unknown" : "rejected", reason: result.error.statusCode === 429 ? "rate_limited" : "provider_rejected" });
      if (result.error.statusCode === 429) throw new NotificationRateLimitError(result.headers?.["retry-after"]);
      if (!result.error.statusCode || result.error.statusCode >= 500) throw new Error("Email outcome unknown.");
      return { ok: false, error: result.error.message };
    }

    if (!result.data?.id) {
      logger.warn("provider.result", { reason: "outcome_unknown", result: "unknown" });
      throw new Error("Email outcome unknown.");
    }
    return { ok: true, providerMessageId: result.data.id };

  }, r => ({ result: r.ok ? "accepted" : "rejected", providerMessageId: r.providerMessageId }), { provider: true });
}
