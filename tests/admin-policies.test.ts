import assert from "node:assert/strict";
import test from "node:test";
import {
  buildNotificationAttemptKey,
  isActiveDrawStatus
} from "../src/services/admin/policies";

test("active draw states block a second draw", () => {
  assert.equal(isActiveDrawStatus("locked"), true);
  assert.equal(isActiveDrawStatus("sent"), true);
  assert.equal(isActiveDrawStatus("draft"), false);
});

test("notification attempt keys are deterministic and assignment-scoped", () => {
  const first = buildNotificationAttemptKey("request-a", "assignment-a", "email");
  assert.equal(first, buildNotificationAttemptKey("request-a", "assignment-a", "email"));
  assert.notEqual(first, buildNotificationAttemptKey("request-a", "assignment-b", "email"));
});
