import { sql } from "drizzle-orm";
import { db } from "@/db/client";
import type { Transaction } from "@/db/locks";

const cache = new Map<string, { available: boolean; expires: number }>();
export async function hasOptionalTable(name: "request_rate_limits" | "audit_events", connection: typeof db | Transaction = db) {
  const previous = cache.get(name);
  if (previous && previous.expires > Date.now()) return previous.available;
  const [row] = await connection.execute<{ available: boolean }>(sql`select to_regclass(${`public.${name}`}) is not null as available`);
  cache.set(name, { available: row.available, expires: Date.now() + 60_000 });
  return row.available;
}
