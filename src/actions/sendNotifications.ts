import { sendDrawNotifications } from "@/services/notifications/sendDrawNotifications";

export async function sendNotifications(
  participants: {
    name: string;
    email?: string | null;
    phone?: string | null;
    preferredChannel: "email" | "whatsapp" | "both" | null;
    revealUrl: string;
  }[]
) {
  return sendDrawNotifications(participants);
}
