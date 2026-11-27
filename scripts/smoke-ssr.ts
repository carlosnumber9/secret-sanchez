import assert from "node:assert/strict";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { createHash } from "node:crypto";
import { isolatedTestDatabase } from "./test-database";

// Use only isolated runtime values, even if the build was made with another context.
Object.assign(process.env, {
  APP_ENV: "test", VERCEL_ENV: "", DATABASE_URL: isolatedTestDatabase(process.env.TEST_DATABASE_URL),
  PUBLIC_SUPABASE_URL: "https://project.example.invalid", PUBLIC_SUPABASE_ANON_KEY: "synthetic-smoke",
  APP_URL: "https://app.example.invalid", REVEAL_TOKEN_ENCRYPTION_KEY: Buffer.alloc(32, 1).toString("base64"),
  GMAIL_USER: "", GMAIL_APP_PASSWORD: "", RESEND_WEBHOOK_SECRET: "", KAPSO_API_KEY: "", KAPSO_WEBHOOK_SECRET: ""
});
const entry = pathToFileURL(path.resolve(".vercel/output/functions/_render.func/dist/server/entry.mjs"));
const { default: app } = await import(entry.href) as { default: { fetch(request: Request): Promise<Response> } };
const events: Array<Record<string, unknown>> = [];
const originalConsole = { log: console.log, warn: console.warn, error: console.error };
for (const method of ["log", "warn", "error"] as const) console[method] = (line: unknown, ...rest: unknown[]) => {
  try {
    const event = JSON.parse(String(line));
    if (event.schemaVersion === 1) { events.push(event); return; }
  } catch { /* Forward non-application diagnostics. */ }
  originalConsole[method](line, ...rest);
};
const request = async (pathname: string, options?: RequestInit) => {
  const response = await app.fetch(new Request(`https://app.example.invalid${pathname}`, options));
  const requestId = response.headers.get("X-Request-Id");
  assert.ok(requestId, `Missing correlation header: ${pathname}`);
  const completed = events.filter((event) => event.requestId === requestId && event.event === "request.completed");
  assert.equal(completed.length, 1);
  assert.equal(completed[0].status, response.status);
  return response;
};
for (const pathname of ["/login", "/r"]) {
  const response = await request(pathname);
  assert.equal(response.status, 200, pathname);
  assert.match(response.headers.get("Cache-Control")!, /no-store/);
  assert.equal(response.headers.get("Referrer-Policy"), "no-referrer");
  assert.match(response.headers.get("Content-Security-Policy")!, /frame-ancestors 'none'/);
  const html = await response.text();
  const meta = [...html.matchAll(/<meta\b[^>]+>/gi)].map(([tag]) => tag).find((tag) => /http-equiv="content-security-policy"/i.test(tag));
  const csp = response.headers.get("Content-Security-Policy") || (meta && /content="([^"]+)"/.exec(meta)?.[1]);
  assert.ok(csp, `CSP ausente en ${pathname}`);
  assert.match(csp, /style-src-attr[^;]*unsafe-inline/);
  assert.doesNotMatch(csp, /script-src[^;]*unsafe-inline/);
  for (const [, attributes, content] of html.matchAll(/<script([^>]*)>([\s\S]*?)<\/script>/g)) {
    if (/\bsrc=|type="application\/(?:json|ld\+json)"/.test(attributes) || !content.trim()) continue;
    assert.ok(["sha256", "sha384", "sha512"].some((algorithm) => csp.includes(`${algorithm}-${createHash(algorithm).update(content).digest("base64")}`)), `Script inline sin hash permitido en ${pathname}`);
  }
}
const protectedPage = await request("/");
assert.equal(protectedPage.status, 302);
assert.match(protectedPage.headers.get("location")!, /^\/login/);
const unauthorized = await request("/api/admin/editions", { method: "POST", headers: { "Content-Type": "application/json", "x-forwarded-for": "127.0.0.22" }, body: "{}" });
assert.equal(unauthorized.status, 401);
// Astro's built-in form-origin check precedes application middleware.
const nativeForeign = await app.fetch(new Request("https://app.example.invalid/api/auth/login", { method: "POST", headers: { Origin: "https://foreign.example.invalid" }, body: "{}" }));
assert.equal(nativeForeign.status, 403);
assert.equal(nativeForeign.headers.get("X-Request-Id"), null);
const foreign = await request("/api/auth/login", { method: "POST", headers: { Origin: "https://foreign.example.invalid", "Content-Type": "application/json" }, body: "{}" });
assert.equal(foreign.status, 403);
const oversized = await request("/api/reveal/open", { method: "POST", body: "x".repeat(4097) });
assert.equal(oversized.status, 413);
const invalid = await request("/api/reveal/resolve", { method: "POST", headers: { "Content-Type": "application/json", "x-forwarded-for": "127.0.0.22" }, body: JSON.stringify({ token: "invalid" }) });
assert.equal(invalid.status, 400);
for (let attempt = 0; attempt < 11; attempt++) {
  const limited = await request("/api/auth/login", { method: "POST", headers: { "Content-Type": "application/json", "x-forwarded-for": "127.0.0.99" }, body: "{}" });
  if (attempt === 10) { assert.equal(limited.status, 429); assert.ok(limited.headers.get("Retry-After")); }
}
const encryptionKey = process.env.REVEAL_TOKEN_ENCRYPTION_KEY;
try {
  process.env.REVEAL_TOKEN_ENCRYPTION_KEY = "";
  const unhealthy = await request("/api/health");
  assert.equal(unhealthy.status, 503);
  assert.match(unhealthy.headers.get("Cache-Control")!, /no-store/);
  const { errorId } = await unhealthy.json();
  assert.ok(events.some((event) => event.event === "health.failed" && event.errorId === errorId));
} finally { process.env.REVEAL_TOKEN_ENCRYPTION_KEY = encryptionKey; }
const { db } = await import("../src/db/client");
const { adminUsers } = await import("../src/db/schema");
const { eq } = await import("drizzle-orm");
const authUserId = crypto.randomUUID();
const [admin] = await db.insert(adminUsers).values({ email: "smoke-admin@example.invalid", name: "Synthetic", authUserId }).returning();
const originalFetch = globalThis.fetch;
try {
  let verifiedUserId = authUserId;
  globalThis.fetch = async (input) => {
    assert.match(String(input), /^https:\/\/project\.example\.invalid\/auth\/v1\/user/);
    return Response.json({ id: verifiedUserId, aud: "authenticated", email: "smoke-admin@example.invalid" });
  };
  const accessToken = `${Buffer.from('{}').toString('base64url')}.${Buffer.from(JSON.stringify({ exp: Math.floor(Date.now() / 1000) + 3600 })).toString('base64url')}.synthetic`;
  const session = { access_token: accessToken, refresh_token: "synthetic-refresh", expires_at: Math.floor(Date.now() / 1000) + 3600, expires_in: 3600, token_type: "bearer", user: { id: authUserId, aud: "authenticated" } };
  const cookie = `sb-project-auth-token=base64-${Buffer.from(JSON.stringify(session)).toString('base64url')}`;
  for (const pathname of ["/", "/familia", "/api/admin/editions"]) {
    const authorized = await request(pathname, { headers: { Cookie: cookie } });
    assert.equal(authorized.status, 200);
    await authorized.text();
    const completed = events.find((event) => event.event === "request.completed" && event.requestId === authorized.headers.get("X-Request-Id"));
    assert.equal(completed?.adminId, admin.id);
    assert.equal(completed?.authUserId, authUserId);
  }
  verifiedUserId = crypto.randomUUID();
  const forbidden = await request("/api/admin/editions", { headers: { Cookie: cookie } });
  assert.equal(forbidden.status, 403);
  const denied = events.find((event) => event.event === "auth.access_denied" && event.requestId === forbidden.headers.get("X-Request-Id"));
  assert.equal(denied?.authUserId, verifiedUserId);
  assert.equal(denied?.adminId, undefined);
} finally {
  globalThis.fetch = originalFetch;
  await db.delete(adminUsers).where(eq(adminUsers.id, admin.id));
  await db.$client.end();
}
assert.doesNotMatch(JSON.stringify(events), /smoke-admin@example\.invalid|synthetic-refresh|access_token|revealToken|Bearer/);
Object.assign(console, originalConsole);
console.log("Smoke SSR verificado: login, revelación, hashes CSP, privacidad, autorización, origen, cuerpo, límites, identidad y correlación JSON. Solo entorno sintético.");
