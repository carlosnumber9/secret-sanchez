import type { APIRoute } from "astro";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { logger } from "@/lib/logger";

type Logout = (context: Parameters<typeof createSupabaseServerClient>[0]) => Promise<{ error: unknown | null }>;

export function createLogoutHandler(signOut: Logout = (context) => createSupabaseServerClient(context).auth.signOut({ scope: "local" })): APIRoute {
  return async ({ cookies, request }) => {
    const headers = { "Cache-Control": "private, no-store" };
    const origin = request.headers.get("origin");
    if (origin && origin !== new URL(request.url).origin) return new Response("Origen no permitido.", { status: 403, headers });
    try {
      const { error } = await signOut({ cookies, request });
      if (error) throw error;
      logger.info("auth.logout_succeeded");
      return new Response(null, { status: 303, headers: { ...headers, Location: "/login" } });
    } catch (error) {
      logger.error("auth.logout_failed", error);
      return new Response("No se pudo cerrar la sesión. Vuelve atrás y reinténtalo.", { status: 503, headers });
    }
  };
}

export const POST = createLogoutHandler();
