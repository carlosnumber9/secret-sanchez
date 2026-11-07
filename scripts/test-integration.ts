import { isolatedTestDatabase } from "./test-database";
import { execFileSync } from "node:child_process";
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";

const databaseUrl = isolatedTestDatabase(process.env.TEST_DATABASE_URL);
const client = postgres(databaseUrl, { prepare: false, max: 1 });
try {
  await client.unsafe("DO $$ BEGIN IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname='anon') THEN CREATE ROLE anon NOLOGIN; END IF; IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname='authenticated') THEN CREATE ROLE authenticated NOLOGIN; END IF; END $$;");
  await migrate(drizzle(client), { migrationsFolder: "drizzle" });
} finally { await client.end(); }
execFileSync(process.execPath, ["--import", import.meta.resolve("tsx"), "--test", "tests/integration/application.test.ts"], {
  stdio: "inherit",
  env: {
    ...process.env, APP_ENV: "test", VERCEL_ENV: "", NOTIFICATION_TEST_EMAIL: "safe@example.invalid", DATABASE_URL: databaseUrl, PUBLIC_SUPABASE_URL: "https://project.example.invalid",
    PUBLIC_SUPABASE_ANON_KEY: "isolated-test", APP_URL: "https://app.example.invalid",
    REVEAL_TOKEN_ENCRYPTION_KEY: Buffer.alloc(32, 1).toString("base64"),
    RESEND_API_KEY: "", KAPSO_API_KEY: "", KAPSO_PHONE_NUMBER_ID: "", KAPSO_WEBHOOK_SECRET: ""
  }
});
