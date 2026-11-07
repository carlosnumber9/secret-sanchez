import assert from "node:assert/strict";
import test from "node:test";
import type { APIRoute } from "astro";
import { createLogoutHandler } from "../src/pages/api/auth/logout";

test("logout passes the SSR cookie context and redirects without caching", async (t) => {
  t.mock.method(console, "log", () => undefined);
  const cookies = { marker: "SSR cookies" };
  const handler = createLogoutHandler(async (context) => { assert.equal(context.cookies, cookies); return { error: null }; });
  const response = await handler({ cookies, request: new Request("https://app.example.invalid/api/auth/logout", { method: "POST" }) } as unknown as Parameters<APIRoute>[0]) as Response;
  assert.equal(response.status, 303);
  assert.equal(response.headers.get("Location"), "/login");
  assert.match(response.headers.get("Cache-Control")!, /no-store/);
});

test("logout rejects a foreign origin before touching the session", async () => {
  let called = false;
  const handler = createLogoutHandler(async () => { called = true; return { error: null }; });
  const response = await handler({ request: new Request("https://app.example.invalid/api/auth/logout", { method: "POST", headers: { Origin: "https://foreign.example.invalid" } }) } as Parameters<APIRoute>[0]) as Response;
  assert.equal(response.status, 403);
  assert.equal(called, false);
});
