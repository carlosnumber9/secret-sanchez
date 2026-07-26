import assert from "node:assert/strict";
import test from "node:test";
import { readEnv } from "../src/lib/env";

const valid = {
  PUBLIC_SUPABASE_URL: "https://example.supabase.co",
  PUBLIC_SUPABASE_ANON_KEY: "anon",
  DATABASE_URL: "postgresql://example",
  APP_URL: "https://secret.example",
  REVEAL_TOKEN_ENCRYPTION_KEY: Buffer.alloc(32, 7).toString("base64")
};

test("readEnv accepts the required production configuration", () => {
  assert.equal(readEnv(valid).appUrl, "https://secret.example");
});

test("readEnv rejects missing values and invalid encryption keys", () => {
  assert.throws(() => readEnv({ ...valid, DATABASE_URL: "" }), /DATABASE_URL/);
  assert.throws(
    () => readEnv({ ...valid, REVEAL_TOKEN_ENCRYPTION_KEY: "short" }),
    /exactly 32 bytes/
  );
  assert.throws(
    () => readEnv({ ...valid, APP_URL: "javascript:alert(1)" }),
    /HTTP or HTTPS/
  );
});
