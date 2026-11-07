import { bodyFits, bodyLimitFor, isSameOrigin, privateResponse } from "@/lib/request-security";
import { checkRateLimit, type RateBucket } from "@/services/security/rateLimit";
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

  const sensitive = isProtectedPath(pathname) || pathname === "/login" || pathname === "/r" || pathname.startsWith("/api/");
  const execute = async () => {
    if (["POST", "PUT", "PATCH", "DELETE"].includes(context.request.method)) {
      if (!pathname.startsWith("/api/webhooks/") && !isSameOrigin(context.request)) return Response.json({ ok: false, message: "Origen no permitido." }, { status: 403 });
      if (!await bodyFits(context.request, bodyLimitFor(pathname))) return Response.json({ ok: false, message: "El cuerpo de la petición es demasiado grande." }, { status: 413 });
      const bucket: RateBucket | null = pathname === "/api/auth/login" ? "login" : pathname === "/api/auth/logout" ? "logout" : pathname.startsWith("/api/reveal/") ? "reveal" : pathname.startsWith("/api/admin/") ? "admin" : null;
      if (bucket) {
        let subject = "unknown";
        try { subject = context.clientAddress || subject; } catch { /* Some local adapters do not expose an address. */ }
        try {
          const limit = await checkRateLimit(bucket, subject);
          if (!limit.allowed) return Response.json({ ok: false, message: "Demasiados intentos. Espera un momento y vuelve a intentarlo." }, { status: 429, headers: { "Retry-After": String(limit.retryAfter) } });
        } catch (error) {
          const errorId = logger.error("security.rate_limit_failed", error);
          return Response.json({ ok: false, message: "No se pudo comprobar la petición.", errorId }, { status: 503 });
        }
      }
    }
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
  };
  const response = await execute();
  return sensitive ? privateResponse(response) : response;
});
