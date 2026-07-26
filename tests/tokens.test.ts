import assert from "node:assert/strict";
import test from "node:test";
import { buildRevealUrl, decryptRevealToken, encryptRevealToken } from "../src/lib/tokens";

const key = Buffer.alloc(32, 3).toString("base64");

test("reveal tokens round-trip through authenticated encryption", () => {
  const ciphertext = encryptRevealToken("secret-token", key);
  assert.equal(decryptRevealToken(ciphertext, key), "secret-token");
});

test("tampered reveal ciphertext is rejected", () => {
  const ciphertext = encryptRevealToken("secret-token", key);
  const parts = ciphertext.split(".");
  parts[3] = `${parts[3][0] === "A" ? "B" : "A"}${parts[3].slice(1)}`;
  assert.throws(() => decryptRevealToken(parts.join("."), key));
});

test("reveal URLs keep the token in the fragment", () => {
  assert.equal(buildRevealUrl("https://secret.example/", "abc"), "https://secret.example/r#abc");
});
