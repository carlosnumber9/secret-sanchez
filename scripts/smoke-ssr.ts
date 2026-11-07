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
  RESEND_API_KEY: "", RESEND_WEBHOOK_SECRET: "", KAPSO_API_KEY: "", KAPSO_WEBHOOK_SECRET: ""
});
const entry = pathToFileURL(path.resolve(".vercel/output/functions/_render.func/dist/server/entry.mjs"));
const { default: app } = await import(entry.href) as { default: { fetch(request: Request): Promise<Response> } };
const request = (pathname: string, options?: RequestInit) => app.fetch(new Request(`https://app.example.invalid${pathname}`, options));
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
const foreign = await request("/api/auth/login", { method: "POST", headers: { Origin: "https://foreign.example.invalid" }, body: "{}" });
assert.equal(foreign.status, 403);
const oversized = await request("/api/reveal/open", { method: "POST", body: "x".repeat(4097) });
assert.equal(oversized.status, 413);
const invalid = await request("/api/reveal/resolve", { method: "POST", headers: { "Content-Type": "application/json", "x-forwarded-for": "127.0.0.22" }, body: JSON.stringify({ token: "invalid" }) });
assert.equal(invalid.status, 400);
console.log("Smoke SSR verificado: login, revelación, hashes CSP, privacidad, autorización, origen y límite real de cuerpo. Solo entorno sintético.");
