/** Browser diagnostics contain only controlled labels and operational metadata. */
export function browserDebug(event: string, details: Record<string, string | number | boolean | null> = {}) {
  if (typeof window === "undefined") return;
  try { console.debug(`[Secret Sanchez] ${event}`, details); } catch { /* Diagnostics must not interrupt the app. */ }
}

const routes = [
  /^\/$/, /^\/login\/?$/, /^\/familia\/?$/, /^\/r\/?$/,
  /^\/ediciones(?:\/(?:nueva|[\da-f-]+)(?:\/(?:sorteo|envios))?)?\/?$/,
  /^\/api\/auth\/(?:login|logout)$/,
  /^\/api\/reveal\/(?:resolve|open)$/,
  /^\/api\/admin\/(?:groups|islands|participants|editions)$/,
  /^\/api\/admin\/(?:islands|participants)\/[\da-f-]+(?:\/deletion-impact)?$/,
  /^\/api\/admin\/families\/[\da-f-]+\/(?:layout|name)$/,
  /^\/api\/admin\/editions\/[\da-f-]+(?:\/(?:rules|islands\/[\da-f-]+|participants\/[\da-f-]+|draws\/generate|draws\/[\da-f-]+\/revoke|notifications\/send))?$/,
  /^\/api\/admin\/notifications\/(?:send|manual)$/
];

/** Never include arbitrary paths, query strings, fragments, or entity IDs. */
export function debugRoute(pathname: string): string {
  return routes.some(route => route.test(pathname))
    ? pathname.replace(/\/[\da-f-]+(?=\/|$)/gi, "/:id") : "other";
}

let requestSequence = 0;
/** Preserve fetch semantics and response streams; never inspect bodies or credentials. */
export const debugFetch: typeof fetch = async (input, init) => {
  const id = ++requestSequence;
  let route = "other";
  let method = "OTHER";
  try {
    const url = new URL(input instanceof Request ? input.url : String(input), window.location.origin);
    if (url.origin === window.location.origin) route = debugRoute(url.pathname);
    const candidate = (init?.method ?? (input instanceof Request ? input.method : "GET")).toUpperCase();
    if (["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"].includes(candidate)) method = candidate;
  } catch { /* Unknown request metadata stays redacted. */ }
  const started = performance.now();
  browserDebug("request.started", { id, route, method });
  try {
    const response = await fetch(input, init);
    const requestId = response.headers.get("X-Request-Id");
    browserDebug("request.completed", {
      id, route, method, status: response.status, ok: response.ok,
      durationMs: Math.round(performance.now() - started),
      requestId: requestId && /^[\da-f]{8}(?:-[\da-f]{4}){3}-[\da-f]{12}$/i.test(requestId) ? requestId : null
    });
    return response;
  } catch (error) {
    browserDebug("request.failed", {
      id, route, method, durationMs: Math.round(performance.now() - started),
      aborted: error instanceof DOMException && error.name === "AbortError"
    });
    throw error;
  }
};
