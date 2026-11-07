import assert from "node:assert/strict";
import test from "node:test";
import { logger } from "../src/lib/logger";

test("error logs include sanitized cause diagnostics", () => {
  const credential = "abcdefghijklmnopqrstuvwxyz0123456789ABCDEFG";
  const cause = Object.assign(
    new Error(
      `Connection failed for postgresql://user:password@example.invalid/database, admin@example.com and ${credential}`
    ),
    { code: "ENOTFOUND" }
  );
  const error = new Error("Authentication failed during session_lookup.", { cause });
  const originalConsoleError = console.error;
  let output = "";

  console.error = (message) => {
    output = String(message);
  };

  try {
    logger.error("auth.middleware_failed", error, {
      path: "/inicio",
      authStage: "session_lookup"
    });
  } finally {
    console.error = originalConsoleError;
  }

  const payload = JSON.parse(output) as Record<string, unknown>;
  assert.equal(payload.errorType, "Error");
  assert.equal(payload.errorMessage, undefined);
  assert.equal(payload.causeType, "Error");
  assert.equal(payload.causeCode, "ENOTFOUND");
  assert.equal(payload.causeMessage, undefined);
  assert.doesNotMatch(output, /password|admin@example\.com|abcdefghijklmnopqrstuvwxyz0123456789ABCDEFG/);
});


test("diagnostics never serialize arbitrary messages, names or credentials", (t) => {
  const capture = t.mock.method(console, "error", () => undefined);
  const secret = "short-pass";
  const error = Object.assign(new Error(`Persona Ficticia +34000000000 ${secret}`), {
    name: "Persona Ficticia", code: secret,
    cause: new Error("SQL parameters contain private contacts")
  });
  logger.error("synthetic.failure", error, { password: secret, authorization: secret });
  const output = String(capture.mock.calls[0].arguments[0]);
  assert.doesNotMatch(output, /Persona|34000000000|short-pass|SQL parameters/);
  assert.equal(JSON.parse(output).errorType, "UnknownError");
});
