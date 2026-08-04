import type { APIRoute } from "astro";

export const POST: APIRoute = async () => Response.json({
  ok: false,
  code: "EDITION_REQUIRED",
  message: "Elige una edición antes de enviar notificaciones."
}, { status: 410 });
