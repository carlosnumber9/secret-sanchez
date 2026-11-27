import assert from "node:assert/strict";
import test from "node:test";
import { NotificationRateLimitError, pendingRateLimit } from "../src/services/notifications/retry";

test("temporary refusals bound retry delays and invalid cooldowns stay unknown", () => {
  assert.equal(new NotificationRateLimitError("999").retryAfterSeconds, 60);
  assert.equal(new NotificationRateLimitError("0").retryAfterSeconds, 1);
  assert.equal(new NotificationRateLimitError("invalid").retryAfterSeconds, 2);
  assert.equal(pendingRateLimit("rate_limited:1050", 1000), 50);
  assert.equal(pendingRateLimit("rate_limited:950", 1000), 0);
  assert.equal(pendingRateLimit("rate_limited:invalid", 1000), null);
  assert.equal(pendingRateLimit("outcome_unknown:synthetic", 1000), null);
});
