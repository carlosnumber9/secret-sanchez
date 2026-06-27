import { getResendClient } from "@/lib/resend";

type Input = {
  to: string;
  name: string;
  revealUrl: string;
};

export async function sendEmailNotification({ to, name, revealUrl }: Input) {
  const resend = getResendClient();
  if (!resend) {
    return {
      ok: false,
      error: "RESEND_API_KEY no está configurada."
    };
  }

  const result = await resend.emails.send({
    from: "Secret Sánchez <amigo-invisible@secret-sanchez.app>",
    to,
    subject: "Tu Amigo Invisible de Reyes ya está listo",
    text: `Ya está listo el Amigo Invisible de Reyes.\n\nHola ${name}, abre tu enlace secreto para descubrir a quién regalas:\n\n${revealUrl}\n\nNo lo compartas.`,
    html: `<p>Ya está listo el Amigo Invisible de Reyes.</p><p>Hola ${name}, abre tu enlace secreto para descubrir a quién regalas:</p><p><a href="${revealUrl}">${revealUrl}</a></p><p>No lo compartas.</p>`
  });

  if (result.error) {
    return { ok: false, error: result.error.message };
  }

  return { ok: true, providerMessageId: result.data?.id };
}
