import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { getEnv } from "@/lib/env";
import * as schema from "./schema";

const env = getEnv();

if (!env.databaseUrl && import.meta.env.PROD) {
  throw new Error("DATABASE_URL is required in production.");
}

const queryClient = postgres(env.databaseUrl || "postgres://user:pass@localhost:5432/placeholder", {
  prepare: false,
  max: 1,
  idle_timeout: 20,
  connect_timeout: 10
});

export const db = drizzle(queryClient, { schema });
