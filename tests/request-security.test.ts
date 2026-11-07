import assert from "node:assert/strict";
import test from "node:test";
import { bodyFits, bodyLimitFor, isSameOrigin, privateResponse } from "../src/lib/request-security";

test("body limits enforce actual bytes without consuming valid payloads", async () => {
  const valid = new Request("https://app.example.invalid/api/reveal/open", { method: "POST", body: "small" });
  assert.equal(await bodyFits(valid, 10), true);
  assert.equal(await valid.text(), "small");
  const forged = new Request("https://app.example.invalid/api/reveal/open", { method: "POST", headers: { "Content-Length": "1" }, body: "too long" });
  assert.equal(await bodyFits(forged, 3), false);
  assert.ok(bodyLimitFor("/api/admin/families/id/layout") > bodyLimitFor("/api/reveal/open"));
});

test("private response headers preserve cookies and reject foreign origins", () => {
  const headers = new Headers();
  headers.append("Set-Cookie", "one=value; Path=/");
  headers.append("Set-Cookie", "two=value; Path=/");
  const response = privateResponse(new Response(null, { status: 303, headers }));
  assert.equal(response.headers.getSetCookie().length, 2);
  assert.match(response.headers.get("Cache-Control")!, /no-store/);
  assert.equal(isSameOrigin(new Request("https://app.example.invalid", { headers: { Origin: "https://foreign.example.invalid" } })), false);
  assert.equal(isSameOrigin(new Request("https://app.example.invalid", { headers: { Origin: "https://app.example.invalid" } })), true);
});
