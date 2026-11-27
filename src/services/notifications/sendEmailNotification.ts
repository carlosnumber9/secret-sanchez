import { randomUUID } from "node:crypto";
import type { SendMailOptions } from "nodemailer/lib/mailer";
import { observe, logger } from "@/lib/logger";
import { smtpCommands } from "@/lib/log-contract";
import { getGmailDelivery } from "@/lib/gmail";
import { NotificationRateLimitError } from "./retry";
import { renderEmail } from "./renderEmail";

type Input = {
  to: string;
  name: string;
  revealUrl: string;
  testMode?: boolean;
};

export type EmailDelivery = {
  sender: string;
  transport: {
    sendMail(message: SendMailOptions): Promise<{ accepted: string[]; rejected: string[]; messageId: string }>;
    close(): void;
  };
};

export async function sendEmailNotification(input: Input, delivery?: EmailDelivery | null) {
  return observe("provider.email", { provider: "gmail" }, async () => {
    const gmail = delivery === undefined ? getGmailDelivery() : delivery;
    if (!gmail) {
      logger.warn("provider.result", { result: "rejected", reason: "configuration_missing" });
      return { ok: false, error: "Configura GMAIL_USER y GMAIL_APP_PASSWORD en el servidor." };
    }
    const messageId = `<${randomUUID()}@gmail.com>`;
    try {
      const rendered = renderEmail(input);
      const result = await gmail.transport.sendMail({
        from: { name: "Secret Sánchez", address: gmail.sender },
        to: { address: input.to },
        envelope: { from: gmail.sender, to: [input.to] },
        messageId,
        ...rendered,
        signal: AbortSignal.timeout(20_000)
      });
      if (!result.accepted.some(address => address.toLowerCase() === input.to.toLowerCase()) || result.rejected.length) {
        logger.warn("provider.result", { result: "rejected", reason: "provider_rejected" });
        return { ok: false, error: "Gmail no aceptó el destinatario del correo." };
      }
      logger.info("provider.result", { result: "accepted", providerMessageId: messageId });
      return { ok: true, providerMessageId: messageId };
    } catch (error) {
      const smtpStatus = error && typeof error === "object" && "responseCode" in error && typeof error.responseCode === "number" ? error.responseCode : undefined;
      const command = error && typeof error === "object" && "command" in error && typeof error.command === "string" ? error.command : undefined;
      const normalizedCommand = command === "AUTH" || command?.startsWith("AUTH ") ? "AUTH" : command;
      const smtpCommand = smtpCommands.find(allowed => allowed === normalizedCommand);
      const diagnostics = { smtpStatus, smtpCommand };
      if (smtpStatus && smtpStatus >= 400 && smtpStatus < 500) {
        logger.warn("provider.result", { ...diagnostics, result: "retry", reason: "rate_limited" });
        throw new NotificationRateLimitError("60");
      }
      if (smtpStatus && smtpStatus >= 500 && smtpStatus < 600) {
        logger.warn("provider.result", { ...diagnostics, result: "rejected", reason: smtpCommand === "AUTH" ? "invalid_credentials" : "provider_rejected" });
        return { ok: false, error: "Gmail rechazó el envío del correo." };
      }
      logger.warn("provider.result", { ...diagnostics, result: "unknown", reason: "outcome_unknown" });
      throw new Error("Email outcome unknown.", { cause: error });
    } finally {
      gmail.transport.close();
    }
  }, result => ({ result: result.ok ? "accepted" : "rejected", providerMessageId: result.providerMessageId }), { provider: true });
}
