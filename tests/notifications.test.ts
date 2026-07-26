import assert from "node:assert/strict";
import test from "node:test";
import { isEligibleNotification } from "../src/services/notifications/eligibility";

test("pending batches only select new or pending attempts", () => {
  assert.equal(isEligibleNotification(null, "pending"), true);
  assert.equal(isEligibleNotification("pending", "pending"), true);
  assert.equal(isEligibleNotification("sent", "pending"), false);
});

test("failed batches only select failed attempts", () => {
  assert.equal(isEligibleNotification("failed", "failed"), true);
  assert.equal(isEligibleNotification("pending", "failed"), false);
});
