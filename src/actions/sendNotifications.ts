import { sendDrawNotifications } from "@/services/notifications/sendDrawNotifications";

export async function sendNotifications(
  participants: {
    name: string;
    email?: string | null;
    phone?: string | null;
    preferredChannel: "email" | "whatsapp" | "both" | "manual";
    revealUrl: string;
  }[]
) {
  return sendDrawNotifications(participants);
}
