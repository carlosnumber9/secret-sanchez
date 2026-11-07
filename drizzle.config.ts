import "./scripts/load-env";
import { defineConfig } from "drizzle-kit";

const databaseUrl = process.env.DATABASE_URL?.trim();
if (!databaseUrl) throw new Error("DATABASE_URL is required for Drizzle commands.");
if (!/^postgres(?:ql)?:\/\//.test(databaseUrl)) throw new Error("DATABASE_URL must use a PostgreSQL URL.");

export default defineConfig({
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  casing: "snake_case",
  dbCredentials: {
    url: databaseUrl
  }
});
