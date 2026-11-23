import type { APIRoute } from "astro";
import { z } from "zod";
import { loginWithPassword } from "@/actions/loginWithPassword";
import { handleApiError } from "@/lib/api";
import { logger, observe, setLogActor } from "@/lib/logger";

const schema = z.object({
  email: z.email(),
  password: z.string().min(1).max(4096)
});

type PasswordLogin = (
  context: Parameters<typeof loginWithPassword>[0],
  email: string,
  password: string
) => Promise<{
  data: { session: unknown | null; user?: { id: string } | null };
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

      const { data, error } = await observe("auth.password", { provider: "supabase" }, () => login(
        { cookies, request },
        parsed.data.email,
        parsed.data.password
      ), (result) => ({ result: result.error || !result.data.session ? "rejected" : "succeeded", httpStatus: result.error?.status }), { provider: true });

      if (error || !data.session) {
        const rateLimited = error?.status === 429;
        logger.warn("auth.password_login_failed", {
          reason: rateLimited ? "rate_limited" : error?.status && error.status >= 500 ? "lookup_failed" : "invalid_credentials",
          httpStatus: error?.status
        });
        if (error?.status && error.status >= 500) logger.error("auth.password_login_exception", error, { stage: "session_lookup", httpStatus: error.status });
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

      if (data.user) setLogActor({ actorType: "authenticated", authUserId: data.user.id });
      else logger.warn("auth.identity_unavailable", { reason: "not_resolved" });
      logger.info("auth.password_login_succeeded");
      return Response.json({ ok: true });
    } catch (error) {
      return handleApiError("auth.password_login_exception", error);
    }
  };
}

export const POST = createPasswordLoginHandler();
