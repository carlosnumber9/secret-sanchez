import assert from "node:assert/strict";
import test from "node:test";
import { canResumePending } from "../src/services/notifications/retry";

test("pending recovery stays inside provider deduplication guarantees", () => {
  const now = Date.now();
  assert.equal(canResumePending("email", new Date(now - 30_000), now), false);
  assert.equal(canResumePending("email", new Date(now - 61_000), now), true);
  assert.equal(canResumePending("email", new Date(now - 24 * 60 * 60_000), now), false);
  assert.equal(canResumePending("whatsapp", new Date(now - 61_000), now), false);
});
