export const emailEvents = ["email.sent", "email.delivered", "email.delivery_delayed", "email.bounced", "email.failed", "email.complained", "email.suppressed"] as const;
export type EmailEvent = typeof emailEvents[number];
export const suppressedEmailErrors = ["email_bounced", "email_complained", "email_suppressed"] as const;

export function emailTransition(event: EmailEvent) {
  if (event === "email.sent") return { status: "sent" as const, error: null, previous: ["pending", "sent"] };
  if (event === "email.delivered") return { status: "delivered" as const, error: null, previous: ["pending", "sent", "delivered"] };
  if (event === "email.delivery_delayed") return { status: "sent" as const, error: "email_delivery_delayed", previous: ["pending", "sent"] };
  return { status: "failed" as const, error: event.replace(".", "_"), previous: ["pending", "sent", "delivered", "failed"] };
}
