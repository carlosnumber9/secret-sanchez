export function bodyLimitFor(pathname: string) {
  if (/^\/api\/admin\/families\/[^/]+\/layout$/.test(pathname)) return 1024 * 1024;
  if (pathname.startsWith("/api/webhooks/")) return 256 * 1024;
  if (pathname.startsWith("/api/auth/")) return 16 * 1024;
  if (pathname.startsWith("/api/reveal/")) return 4 * 1024;
  return 64 * 1024;
}

export function isSameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  return !origin || origin === new URL(request.url).origin;
}

export async function bodyFits(request: Request, limit: number) {
  const declared = request.headers.get("content-length");
  if (declared && /^\d+$/.test(declared) && Number(declared) > limit) {
    await request.body?.cancel();
    return false;
  }
  const reader = request.clone().body?.getReader();
  if (!reader) return true;
  let size = 0;
  try {
    for (;;) {
      const { value, done } = await reader.read();
      if (done) return true;
      size += value.byteLength;
      if (size > limit) {
        await Promise.all([reader.cancel(), request.body?.cancel()]);
        return false;
      }
    }
  } finally { reader.releaseLock(); }
}

export function privateResponse(response: Response) {
  const headers = new Headers(response.headers);
  headers.set("Cache-Control", "private, no-store");
  headers.set("CDN-Cache-Control", "no-store");
  headers.set("Vercel-CDN-Cache-Control", "no-store");
  headers.set("Referrer-Policy", "no-referrer");
  headers.set("X-Content-Type-Options", "nosniff");
  headers.set("X-Frame-Options", "DENY");
  headers.set("Content-Security-Policy", "frame-ancestors 'none'");
  headers.set("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  headers.set("X-Robots-Tag", "noindex, nofollow");
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
}
