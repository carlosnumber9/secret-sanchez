import { defineMiddleware } from "astro:middleware";
import { logger } from "@/lib/logger";
import { AuthCheckError, requireAdmin } from "@/lib/supabase/auth";

const protectedPagePaths = new Set(["/", "/inicio", "/familia", "/sorteo", "/envios"]);
const protectedPagePrefixes = ["/ediciones"];
const protectedApiPrefixes = ["/api/admin"];

function isProtectedPath(pathname: string) {
  return (
    protectedPagePaths.has(pathname) ||
    protectedPagePrefixes.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)) ||
    protectedApiPrefixes.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`))
  );
}

function isApiPath(pathname: string) {
  return pathname.startsWith("/api/");
}

export const onRequest = defineMiddleware(async (context, next) => {
  const { pathname } = context.url;

  if (!isProtectedPath(pathname)) {
    return next();
  }

  let authorization: Awaited<ReturnType<typeof requireAdmin>>;
  try {
    authorization = await requireAdmin({ cookies: context.cookies, request: context.request });
  } catch (error) {
    const errorId = logger.error("auth.middleware_failed", error, {
      path: pathname,
      authStage: error instanceof AuthCheckError ? error.stage : "unknown"
    });
    if (isApiPath(pathname)) {
      return Response.json(
        { ok: false, message: "No se pudo comprobar la sesión.", errorId },
        { status: 500 }
      );
    }
    return new Response("No se pudo comprobar la sesión.", { status: 500 });
  }

  if (authorization.admin) {
    context.locals.admin = authorization.admin;
    return next();
  }

  logger.warn("auth.access_denied", {
    path: pathname,
    reason: authorization.reason,
    status: authorization.status
  });
  if (isApiPath(pathname)) {
    return Response.json(
      {
        ok: false,
        message:
          authorization.status === 401
            ? "Necesitas iniciar sesión."
            : "Tu cuenta no está autorizada como administradora.",
        code: authorization.status === 401 ? "AUTH_REQUIRED" : "ADMIN_FORBIDDEN"
      },
      { status: authorization.status }
    );
  }

  if (authorization.status === 403) {
    return new Response("Tu cuenta no está autorizada como administradora.", { status: 403 });
  }

  const redirectUrl = new URL("/login", context.url);
  redirectUrl.searchParams.set("next", pathname);
  return context.redirect(redirectUrl.pathname + redirectUrl.search);
});
