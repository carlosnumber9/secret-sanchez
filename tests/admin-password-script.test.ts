import assert from "node:assert/strict";
import test from "node:test";
import {
  getPasswordUpdateErrorMessage,
  parseUserId,
  validatePasswordConfirmation
} from "../scripts/set-admin-password";

const validUserId = "6aa5d0d4-2a9f-4483-b6c8-0cf4c6c98ac4";

test("the password command requires a valid Supabase user UUID", () => {
  assert.equal(parseUserId(["--user-id", validUserId]), validUserId);
  assert.throws(() => parseUserId(["--user-id", "not-a-uuid"]), /Uso:/);
  assert.throws(() => parseUserId([]), /Uso:/);
});

test("the password command rejects passwords passed through command arguments", () => {
  assert.throws(
    () => parseUserId(["--user-id", validUserId, "--password", "visible-secret"]),
    /no se admite como argumento/
  );
  assert.throws(
    () => parseUserId(["--user-id", validUserId, "--password=visible-secret"]),
    /no se admite como argumento/
  );
});

test("password confirmation must be present and match", () => {
  assert.equal(validatePasswordConfirmation("secret-a", "secret-a"), "secret-a");
  assert.throws(() => validatePasswordConfirmation("", ""), /vacía/);
  assert.throws(() => validatePasswordConfirmation("secret-a", "secret-b"), /no coinciden/);
});

test("provider errors expose only a safe code and never the provider message", () => {
  const providerMessage = "Password visible-secret was rejected for juan@example.com";
  const message = getPasswordUpdateErrorMessage({ code: "weak_password", status: 422 });

  assert.equal(message, "Supabase no pudo actualizar la contraseña (weak_password).");
  assert.equal(message.includes(providerMessage), false);
  assert.equal(message.includes("visible-secret"), false);
});
