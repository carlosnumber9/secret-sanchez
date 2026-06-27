import { getEnv } from "./env";

type SendWhatsappInput = {
  phone: string;
  message: string;
};

export async function sendKapsoMessage(input: SendWhatsappInput) {
  const { kapsoApiKey } = getEnv();
  if (!kapsoApiKey) {
    return {
      ok: false,
      error: "Kapso todavía no está configurado."
    };
  }

  return {
    ok: false,
    error: `Integración pendiente para ${input.phone}. Mensaje preparado: ${input.message}`
  };
}
