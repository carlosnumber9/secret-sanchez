import assert from "node:assert/strict";
import test from "node:test";
import { availableDeliveryChannel, participantEmailIsValid, participantPhoneIsValid } from "../src/lib/contact";

test("contact policy narrows selected channels to available destinations", () => {
  assert.equal(availableDeliveryChannel("both", true, false), "email");
  assert.equal(availableDeliveryChannel("both", false, true), "whatsapp");
  assert.equal(availableDeliveryChannel("email", false, true), null);
  assert.equal(availableDeliveryChannel("manual", true, true), null);
  assert.equal(participantEmailIsValid("person@example.invalid"), true);
  assert.equal(participantEmailIsValid("missing-domain@"), false);
  assert.equal(participantPhoneIsValid("+34000000000"), true);
  assert.equal(participantPhoneIsValid("0034000000000"), false);
});
