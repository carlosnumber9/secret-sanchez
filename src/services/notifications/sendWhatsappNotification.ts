import { sendKapsoMessage } from "@/lib/kapso";

type Input = {
  phone: string;
  name: string;
  revealUrl: string;
};

export async function sendWhatsappNotification({ phone, name, revealUrl }: Input) {
  return sendKapsoMessage({
    phone,
    name,
    revealUrl
  });
}
