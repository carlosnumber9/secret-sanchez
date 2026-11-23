import type { APIRoute } from "astro";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { logger, setLogActor } from "@/lib/logger";

type Logout = (context: Parameters<typeof createSupabaseServerClient>[0]) => Promise<{ error: unknown | null }>;

async function logoutWithIdentity(context: Parameters<Logout>[0]) {
  // Identity lookup cannot hold the client's auth lock while sign-out runs.
  const identityClient = createSupabaseServerClient(context, { signal: AbortSignal.timeout(750) });
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const result = await Promise.race([
      identityClient.auth.getUser(),
      new Promise<null>((resolve) => { timer = setTimeout(() => resolve(null), 750); })
    ]);
    if (result?.data.user && !result.error) setLogActor({ actorType: "authenticated", authUserId: result.data.user.id });
    else logger.warn("auth.identity_unavailable", { reason: "enrichment_failed" });
  } catch {
    logger.warn("auth.identity_unavailable", { reason: "enrichment_failed" });
  } finally { clearTimeout(timer); }
  return createSupabaseServerClient(context).auth.signOut({ scope: "local" });
}

export function createLogoutHandler(signOut: Logout = logoutWithIdentity): APIRoute {
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
