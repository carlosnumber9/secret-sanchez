import type { APIRoute } from "astro";
import type { EmailOtpType } from "@supabase/supabase-js";
import { z } from "zod";
import { handleApiError } from "@/lib/api";
import { logger } from "@/lib/logger";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const schema = z
  .object({
    accessToken: z.string().optional(),
    refreshToken: z.string().optional(),
    code: z.string().optional(),
    tokenHash: z.string().optional(),
    type: z.string().optional()
  })
  .refine((value) => Boolean(value.code || value.tokenHash || (value.accessToken && value.refreshToken)), {
    message: "Faltan credenciales de Supabase."
  });

export const POST: APIRoute = async ({ cookies, request }) => {
  try {
    const body = await request.json().catch(() => null);
    const parsed = schema.safeParse(body);

    if (!parsed.success) {
      logger.warn("auth.callback_rejected", { reason: "invalid_credentials_shape" });
      return Response.json({ ok: false, message: "El enlace de acceso no es válido." }, { status: 400 });
    }

    const supabase = createSupabaseServerClient({ cookies, request });
    const { data, error } = parsed.data.code
      ? await supabase.auth.exchangeCodeForSession(parsed.data.code)
      : parsed.data.tokenHash
        ? await supabase.auth.verifyOtp({
            token_hash: parsed.data.tokenHash,
            type: (parsed.data.type ?? "magiclink") as EmailOtpType
          })
        : await supabase.auth.setSession({
            access_token: parsed.data.accessToken ?? "",
            refresh_token: parsed.data.refreshToken ?? ""
          });

    if (error || !data.session) {
      logger.warn("auth.callback_failed", { reason: "provider_rejected" });
      return Response.json({ ok: false, message: "No he podido confirmar la sesión." }, { status: 400 });
    }

    logger.info("auth.callback_succeeded");
    return Response.json({ ok: true });
  } catch (error) {
    return handleApiError("auth.callback_exception", error);
  }
};
