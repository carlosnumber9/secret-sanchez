import type { APIRoute } from "astro";
import { sql } from "drizzle-orm";
import { getEnv } from "@/lib/env";
import { logger } from "@/lib/logger";

export const GET: APIRoute = async () => {
  const startedAt = performance.now();
  try {
    getEnv();
    const { db } = await import("@/db/client");
    await db.execute(sql`select 1`);
    logger.info("health.succeeded", { durationMs: Math.round(performance.now() - startedAt) });
    return Response.json(
      { ok: true },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    const errorId = logger.error("health.failed", error, {
      durationMs: Math.round(performance.now() - startedAt)
    });
    return Response.json(
      { ok: false, errorId },
      { status: 503, headers: { "Cache-Control": "no-store" } }
    );
  }
};
