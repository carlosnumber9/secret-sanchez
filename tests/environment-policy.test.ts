import assert from "node:assert/strict";
import test from "node:test";
import { environmentPolicy } from "../src/lib/environment-policy";

const separate = {
  APP_ENV: "development", PUBLIC_SUPABASE_URL: "https://development.supabase.co", PRODUCTION_SUPABASE_URL: "https://production.supabase.co",
  DATABASE_URL: "postgresql://postgres.development:synthetic@aws-0-region.pooler.supabase.com:6543/postgres",
  APP_URL: "http://localhost:4321", PRODUCTION_APP_URL: "https://app.example.invalid"
};

test("separate environments require matching Auth and database projects", () => {
  assert.equal(environmentPolicy(separate), "development");
  assert.equal(environmentPolicy({ ...separate, DATABASE_URL: "postgresql://postgres:synthetic@db.development.supabase.co/postgres" }), "development");
  assert.throws(() => environmentPolicy({ ...separate, PUBLIC_SUPABASE_URL: separate.PRODUCTION_SUPABASE_URL }), /separate Supabase/);
  assert.throws(() => environmentPolicy({ ...separate, DATABASE_URL: separate.DATABASE_URL.replace("postgres.development", "postgres.production") }), /non-production Supabase/);
  assert.throws(() => environmentPolicy({ ...separate, DATABASE_URL: "postgresql://postgres.development@attacker.example.invalid/postgres" }), /non-production Supabase/);
  assert.throws(() => environmentPolicy({ ...separate, APP_URL: separate.PRODUCTION_APP_URL }), /differ from Production/);
  assert.throws(() => environmentPolicy({ ...separate, PRODUCTION_SUPABASE_URL: "" }), /reference/);
});

test("Vercel deployment identity cannot be overridden by APP_ENV", () => {
  assert.equal(environmentPolicy({ ...separate, VERCEL_ENV: "preview", APP_ENV: "production" }), "preview");
  assert.throws(() => environmentPolicy({ ...separate, VERCEL_ENV: "preview", APP_ENV: "production", PUBLIC_SUPABASE_URL: separate.PRODUCTION_SUPABASE_URL }), /separate Supabase/);
  assert.equal(environmentPolicy({ APP_ENV: "production", DATABASE_URL: "postgresql://example" }), "production");
});

test("test mode cannot bypass isolation for real data", () => {
  const isolated = { APP_ENV: "test", DATABASE_URL: "postgresql://localhost/app_test", PUBLIC_SUPABASE_URL: "https://auth.example.invalid" };
  assert.equal(environmentPolicy(isolated), "test");
  assert.throws(() => environmentPolicy({ ...isolated, PUBLIC_SUPABASE_URL: "https://production.supabase.co" }), /synthetic Supabase/);
  assert.throws(() => environmentPolicy({ ...isolated, DATABASE_URL: "postgresql://remote.example.invalid/app_test" }), /local _test/);
  assert.throws(() => environmentPolicy({ ...isolated, DATABASE_URL: "postgresql://localhost/production" }), /local _test/);
  const sensitive = "invalid database synthetic-secret";
  assert.throws(() => environmentPolicy({ ...isolated, DATABASE_URL: sensitive }), (error) => !JSON.stringify(error).includes(sensitive));
});
