import assert from "node:assert/strict";
import test from "node:test";
import { isEligibleNotification } from "../src/services/notifications/eligibility";
import { shouldApplyWhatsappStatus } from "../src/services/notifications/whatsappStatus";

test("pending batches only select new or pending attempts", () => {
  assert.equal(isEligibleNotification(null, "pending"), true);
  assert.equal(isEligibleNotification("pending", "pending"), true);
  assert.equal(isEligibleNotification("sent", "pending"), false);
});

test("forced batches can create an explicit resend", () => {
  assert.equal(isEligibleNotification("read", "force"), true);
});

test("WhatsApp delivery statuses progress without late-event degradation", () => {
  assert.equal(shouldApplyWhatsappStatus("sent", "delivered"), true);
  assert.equal(shouldApplyWhatsappStatus("delivered", "read"), true);
  assert.equal(shouldApplyWhatsappStatus("read", "failed"), false);
  assert.equal(shouldApplyWhatsappStatus("failed", "delivered"), true);
});

test("failed batches only select failed attempts", () => {
  assert.equal(isEligibleNotification("failed", "failed"), true);
  assert.equal(isEligibleNotification("pending", "failed"), false);
});
