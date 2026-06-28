import { defineMiddleware } from "astro:middleware";
import { requireAdmin } from "@/lib/supabase/auth";

const protectedPagePaths = new Set(["/inicio", "/familia", "/sorteo", "/envios"]);
const protectedApiPrefixes = ["/api/draw"];

function isProtectedPath(pathname: string) {
  return protectedPagePaths.has(pathname) || protectedApiPrefixes.some((prefix) => pathname.startsWith(prefix));
}

function isApiPath(pathname: string) {
  return pathname.startsWith("/api/");
}

export const onRequest = defineMiddleware(async (context, next) => {
  const { pathname } = context.url;

  if (!isProtectedPath(pathname)) {
    return next();
  }

  const { admin } = await requireAdmin({ cookies: context.cookies });

  if (admin) {
    return next();
  }

  if (isApiPath(pathname)) {
    return Response.json({ ok: false, message: "Necesitas iniciar sesión." }, { status: 401 });
  }

  const redirectUrl = new URL("/login", context.url);
  redirectUrl.searchParams.set("next", pathname);
  return context.redirect(redirectUrl.pathname + redirectUrl.search);
});
