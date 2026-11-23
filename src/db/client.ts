import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { getEnv } from "@/lib/env";
import * as schema from "./schema";
import { logger, observeTransaction } from "@/lib/logger";

const env = getEnv();
const queryClient = postgres(env.databaseUrl, {
  prepare: false,
  max: 1,
  idle_timeout: 20,
  connect_timeout: 10,
  onnotice: () => logger.debug("db.notice")
});

export const db = drizzle(queryClient, { schema });

export function tracedTransaction<T>(work: (tx: Parameters<Parameters<typeof db.transaction>[0]>[0]) => Promise<T>): Promise<T> {
  return observeTransaction((completed) => db.transaction(async (tx) => {
    const result = await work(tx);
    completed();
    return result;
  }));
}
