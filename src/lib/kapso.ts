import { getEnv } from "./env";

type SendWhatsappInput = {
  phone: string;
  message: string;
};

export async function sendKapsoMessage(_input: SendWhatsappInput) {
  const { kapsoApiKey } = getEnv();
  if (!kapsoApiKey) {
    return {
      ok: false,
      error: "Kapso todavía no está configurado."
    };
  }

  return {
    ok: false,
    error: "La integración de WhatsApp todavía no está disponible."
  };
}
