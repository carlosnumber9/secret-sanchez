import assert from "node:assert/strict";
import test from "node:test";
import { requestReveal, RevealRequestError } from "../src/lib/reveal-client";

test("reveal distinguishes rejected tokens from temporary service failures", async () => {
  await assert.rejects(requestReveal("open", "synthetic-token", undefined, async () => new Response(null, { status: 404 })), (error: unknown) => error instanceof RevealRequestError && error.invalid);
  for (const status of [429, 500, 503]) {
    await assert.rejects(requestReveal("open", "synthetic-token", undefined, async () => new Response(null, { status })), (error: unknown) => error instanceof RevealRequestError && !error.invalid);
  }
  const receiver = await requestReveal("open", "synthetic-token", undefined, async (url, options) => {
    assert.equal(url, "/api/reveal/open");
    assert.equal(options?.method, "POST");
    assert.deepEqual(JSON.parse(String(options?.body)), { token: "synthetic-token" });
    return Response.json({ ok: true, data: { receiverName: "Synthetic receiver" } });
  });
  assert.equal(receiver.receiverName, "Synthetic receiver");
});
