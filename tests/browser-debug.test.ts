import assert from "node:assert/strict";
import test from "node:test";
import { browserDebug, debugFetch, debugRoute } from "../src/lib/browser-debug";

test("browser request diagnostics redact secrets and preserve responses and failures", async (t) => {
  const entries: unknown[] = [];
  t.mock.method(console, "debug", (...args: unknown[]) => { entries.push(args); });
  const originalWindow = Object.getOwnPropertyDescriptor(globalThis, "window");
  Object.defineProperty(globalThis, "window", { configurable: true, value: { location: { origin: "https://synthetic.invalid" } } });
  t.after(() => {
    if (originalWindow) Object.defineProperty(globalThis, "window", originalWindow);
    else Reflect.deleteProperty(globalThis, "window");
  });
  const response = Response.json({ token: "response-secret" }, { headers: { "X-Request-Id": "12345678-1234-1234-1234-123456789abc" } });
  const init = { method: "POST", body: "credential-secret" };
  const send = t.mock.method(globalThis, "fetch", async () => response);
  assert.equal(await debugFetch("/api/reveal/open?token=query-secret#fragment-secret", init), response);
  assert.equal(send.mock.calls[0].arguments[1], init);
  assert.equal(await response.text(), '{"token":"response-secret"}');
  const output = JSON.stringify(entries);
  for (const secret of ["query-secret", "fragment-secret", "credential-secret", "response-secret"]) assert.ok(!output.includes(secret));
  assert.match(output, /12345678-1234-1234-1234-123456789abc/);
  assert.match(output, /request.completed/);
  const failure = new DOMException("private-message", "AbortError");
  send.mock.mockImplementation(async () => { throw failure; });
  await assert.rejects(debugFetch("/arbitrary-private-path"), error => error === failure);
  assert.ok(!JSON.stringify(entries).includes("private-message"));
  assert.ok(!JSON.stringify(entries).includes("arbitrary-private-path"));
  assert.match(JSON.stringify(entries), /request.failed/);
  t.mock.method(console, "debug", () => { throw new Error("console unavailable"); });
  assert.doesNotThrow(() => browserDebug("test"));
});

test("route diagnostics omit entity IDs and reject arbitrary paths", () => {
  assert.equal(debugRoute("/api/admin/editions/12345678-1234-1234-1234-123456789abc/draws/generate"), "/api/admin/editions/:id/draws/generate");
  assert.equal(debugRoute("/private-name"), "other");
});
