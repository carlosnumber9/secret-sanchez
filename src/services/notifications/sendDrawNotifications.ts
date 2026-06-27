import { sendEmailNotification } from "./sendEmailNotification";
import { sendWhatsappNotification } from "./sendWhatsappNotification";

type NotificationParticipant = {
  name: string;
  email?: string | null;
  phone?: string | null;
  preferredChannel: "email" | "whatsapp" | "both" | "manual";
  revealUrl: string;
};

export async function sendDrawNotifications(participants: NotificationParticipant[]) {
  const results = [];

  for (const participant of participants) {
    if ((participant.preferredChannel === "email" || participant.preferredChannel === "both") && participant.email) {
      results.push(await sendEmailNotification({ ...participant, to: participant.email }));
    }

    if (
      (participant.preferredChannel === "whatsapp" || participant.preferredChannel === "both") &&
      participant.phone
    ) {
      results.push(await sendWhatsappNotification({ ...participant, phone: participant.phone }));
    }
  }

  return results;
}
