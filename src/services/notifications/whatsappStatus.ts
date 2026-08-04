export type WhatsappDeliveryStatus = "sent" | "delivered" | "read" | "failed";

export function shouldApplyWhatsappStatus(current: string, next: WhatsappDeliveryStatus) {
  if (next === "failed") return current === "pending" || current === "sent" || current === "failed";
  const rank: Record<string, number> = { pending: 0, failed: 0, sent: 1, delivered: 2, read: 3 };
  return (rank[next] ?? 0) >= (rank[current] ?? 0);
}
