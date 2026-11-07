import assert from "node:assert/strict";
import test from "node:test";
import { isolatedTestDatabase } from "../scripts/test-database";

test("integration database guard refuses external and non-dedicated databases", () => {
  for (const url of [undefined, "postgres://localhost/production", "postgres://external.example/database_test", "https://localhost/database_test"]) {
    assert.throws(() => isolatedTestDatabase(url));
  }
  assert.equal(isolatedTestDatabase("postgres://127.0.0.1/database_test"), "postgres://127.0.0.1/database_test");
});
