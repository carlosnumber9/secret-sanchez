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
  assert.equal(payload.errorMessage, "Authentication failed during session_lookup.");
  assert.equal(payload.causeType, "Error");
  assert.equal(payload.causeCode, "ENOTFOUND");
  assert.match(String(payload.causeMessage), /\[redacted-url\]/);
  assert.match(String(payload.causeMessage), /\[redacted-email\]/);
  assert.match(String(payload.causeMessage), /\[redacted-credential\]/);
  assert.doesNotMatch(output, /password|admin@example\.com|abcdefghijklmnopqrstuvwxyz0123456789ABCDEFG/);
});
