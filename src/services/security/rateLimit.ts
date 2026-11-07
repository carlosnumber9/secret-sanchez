import { createHmac } from "node:crypto";
import { inArray, lt, sql } from "drizzle-orm";
import { db } from "@/db/client";
import { requestRateLimits } from "@/db/schema";
import { hasOptionalTable } from "@/db/capabilities";
import { getEnv } from "@/lib/env";
import { logger } from "@/lib/logger";
import { createMemoryRateLimiter } from "./memoryRateLimit";

export const ratePolicies = { login: 10, logout: 30, reveal: 60, admin: 120 } as const;
export type RateBucket = keyof typeof ratePolicies;
const memory = createMemoryRateLimiter();
let warned = false;
let nextPrune = 0;

export function rateLimitKey(bucket: RateBucket, subject: string) {
  return createHmac("sha256", Buffer.from(getEnv().revealTokenEncryptionKey, "base64"))
    .update(`rate-limit:v1\0${bucket}\0${subject.slice(0, 256)}`).digest("hex");
}

export async function checkRateLimit(bucket: RateBucket, subject: string) {
  const key = rateLimitKey(bucket, subject);
  const limit = ratePolicies[bucket];
  if (!await hasOptionalTable("request_rate_limits")) {
    if (!warned) { logger.warn("security.rate_limit_memory_fallback", { distributed: false }); warned = true; }
    return memory(key, limit);
  }
  const now = Date.now();
  const started = new Date(Math.floor(now / 60_000) * 60_000);
  const expires = new Date(started.getTime() + 120_000);
  const [row] = await db.insert(requestRateLimits).values({ keyHash: key, windowStartedAt: started, attempts: 1, expiresAt: expires })
    .onConflictDoUpdate({ target: requestRateLimits.keyHash, set: {
      attempts: sql`case when ${requestRateLimits.windowStartedAt} < ${started.toISOString()}::timestamptz then 1 else ${requestRateLimits.attempts} + 1 end`,
      windowStartedAt: sql`greatest(${requestRateLimits.windowStartedAt}, ${started.toISOString()}::timestamptz)`, expiresAt: expires
    } }).returning({ attempts: requestRateLimits.attempts });
  if (now >= nextPrune) {
    nextPrune = now + 60_000;
    await db.delete(requestRateLimits).where(inArray(requestRateLimits.keyHash,
      db.select({ key: requestRateLimits.keyHash }).from(requestRateLimits).where(lt(requestRateLimits.expiresAt, new Date(now))).limit(200)));
  }
  return { allowed: row.attempts <= limit, retryAfter: Math.max(1, Math.ceil((started.getTime() + 60_000 - now) / 1000)) };
}
