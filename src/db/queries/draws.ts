import { observe } from "@/lib/logger";
import { and, desc, eq, ne } from "drizzle-orm";
import { db } from "@/db/client";
import { draws } from "@/db/schema";

export async function getCurrentDraw(editionId: string) {
  return observe("db.draws.current", { editionId }, async () => {
    const [draw] = await db.select().from(draws)
      .where(and(eq(draws.editionId, editionId), ne(draws.status, "revoked")))
      .orderBy(desc(draws.attemptNumber)).limit(1);
    return draw ?? null;

  }, undefined, { debug: true });
}

export async function listDrawAttempts(editionId: string) {
  return observe("db.draws.list", { editionId }, async () => {
    return db.select().from(draws).where(eq(draws.editionId, editionId)).orderBy(desc(draws.attemptNumber));

  }, r => ({ rowCount: r.length }), { debug: true });
}

export async function createDraw(input: typeof draws.$inferInsert) {
  return observe("db.draws.create", { editionId: input.editionId }, async () => {
    const [draw] = await db.insert(draws).values(input).returning();
    return draw;

  }, undefined, { debug: true });
}
