import assert from "node:assert/strict";
import test from "node:test";
import { getSafeRedirectPath } from "../src/lib/auth-redirect";

test("local login redirects preserve their path, query and fragment", () => {
  assert.equal(getSafeRedirectPath("/familia?tab=activos#lista"), "/familia?tab=activos#lista");
});

test("external and malformed login redirects use the editions home fallback", () => {
  assert.equal(getSafeRedirectPath("https://example.com"), "/");
  assert.equal(getSafeRedirectPath("//example.com"), "/");
  assert.equal(getSafeRedirectPath("/\\example.com"), "/");
  assert.equal(getSafeRedirectPath(null), "/");
});
