import type { APIRoute } from "astro";
import { z } from "zod";
import { loginWithPassword } from "@/actions/loginWithPassword";
import { handleApiError } from "@/lib/api";
import { logger } from "@/lib/logger";

const schema = z.object({
  email: z.email(),
  password: z.string().min(1).max(4096)
});

type PasswordLogin = (
  context: Parameters<typeof loginWithPassword>[0],
  email: string,
  password: string
) => Promise<{
  data: { session: unknown | null };
  error: { status?: number } | null;
}>;

export function createPasswordLoginHandler(login: PasswordLogin = loginWithPassword): APIRoute {
  return async ({ cookies, request }) => {
    try {
      const body = await request.json().catch(() => null);
      const parsed = schema.safeParse(body);

      if (!parsed.success) {
        logger.warn("auth.password_login_rejected", { reason: "invalid_input" });
        return Response.json(
          { ok: false, message: "Escribe un email y una contraseña válidos." },
          { status: 400 }
        );
      }

      const { data, error } = await login(
        { cookies, request },
        parsed.data.email,
        parsed.data.password
      );

      if (error || !data.session) {
        const rateLimited = error?.status === 429;
        logger.warn("auth.password_login_failed", {
          reason: rateLimited ? "rate_limited" : "invalid_credentials"
        });
        return Response.json(
          {
            ok: false,
            message: rateLimited
              ? "Demasiados intentos. Espera un momento y vuelve a intentarlo."
              : "El email o la contraseña no son correctos."
          },
          { status: rateLimited ? 429 : 401 }
        );
      }

      logger.info("auth.password_login_succeeded");
      return Response.json({ ok: true });
    } catch (error) {
      return handleApiError("auth.password_login_exception", error);
    }
  };
}

export const POST = createPasswordLoginHandler();
