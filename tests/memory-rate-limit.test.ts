import assert from "node:assert/strict";
import test from "node:test";
import { createMemoryRateLimiter } from "../src/services/security/memoryRateLimit";

test("rate limits reset by window and never evict active keys to admit new ones", () => {
  const limit = createMemoryRateLimiter(1);
  assert.equal(limit("a", 2, 1000).allowed, true);
  assert.equal(limit("a", 2, 1001).allowed, true);
  assert.equal(limit("a", 2, 1002).allowed, false);
  assert.equal(limit("b", 2, 1003).allowed, false);
  assert.equal(limit("b", 2, 60000).allowed, true);
});
