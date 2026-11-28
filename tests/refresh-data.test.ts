import assert from "node:assert/strict";
import test from "node:test";
import { refreshData } from "../src/lib/refresh-data";

test("refresh reads uncached server state and never posts or retries a mutation", async t => {
  const calls: RequestInit[] = [];
  t.mock.method(globalThis, "fetch", async (_url: unknown, options: RequestInit) => {
    calls.push(options);
    return Response.json({ ok: true, data: { deliveries: [{ emailStatus: "sent" }] } });
  });
  assert.deepEqual(await refreshData("/api/admin/editions/synthetic/deliveries"), { deliveries: [{ emailStatus: "sent" }] });
  assert.deepEqual(calls, [{ cache: "no-store" }]);
});

test("refresh rejects expired sessions, forbidden reads, server errors and malformed results without retry", async t => {
  const responses = [
    Response.json({ ok: false, message: "Necesitas iniciar sesión." }, { status: 401 }),
    Response.json({ ok: false }, { status: 403 }),
    Response.json({ ok: false }, { status: 500 }),
    Response.json({ ok: true }), new Response("invalid JSON")
  ];
  const send = t.mock.method(globalThis, "fetch", async () => responses.shift()!);
  for (let i = 0; i < 5; i++) await assert.rejects(refreshData("/api/admin/family"));
  assert.equal(send.mock.callCount(), 5);
});
