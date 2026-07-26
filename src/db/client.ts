import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { getEnv } from "@/lib/env";
import * as schema from "./schema";

const env = getEnv();
const queryClient = postgres(env.databaseUrl, {
  prepare: false,
  max: 1,
  idle_timeout: 20,
  connect_timeout: 10
});

export const db = drizzle(queryClient, { schema });
