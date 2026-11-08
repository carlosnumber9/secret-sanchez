export type DeliveryChannel = "email" | "whatsapp" | "both" | null;
export const phonePattern = /^\+[1-9]\d{7,14}$/;
export const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export const participantEmailIsValid = (email: string) => emailPattern.test(email);
export const participantPhoneIsValid = (phone: string) => phonePattern.test(phone);

export function availableDeliveryChannel(channel: DeliveryChannel | "manual", hasEmail: boolean, hasPhone: boolean): DeliveryChannel {
  if (channel === "both") return hasEmail ? (hasPhone ? "both" : "email") : (hasPhone ? "whatsapp" : null);
  if (channel === "email") return hasEmail ? "email" : null;
  if (channel === "whatsapp") return hasPhone ? "whatsapp" : null;
  return null;
}

export function normalizePhone(value: string) {
  return value.trim().replace(/[\s().-]/g, "").replace(/^00/, "+");
}
