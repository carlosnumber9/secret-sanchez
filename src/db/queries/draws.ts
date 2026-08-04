import { and, desc, eq, ne } from "drizzle-orm";
import { db } from "@/db/client";
import { draws } from "@/db/schema";

export async function getCurrentDraw(editionId: string) {
  const [draw] = await db.select().from(draws)
    .where(and(eq(draws.editionId, editionId), ne(draws.status, "revoked")))
    .orderBy(desc(draws.attemptNumber)).limit(1);
  return draw ?? null;
}

export async function listDrawAttempts(editionId: string) {
  return db.select().from(draws).where(eq(draws.editionId, editionId)).orderBy(desc(draws.attemptNumber));
}

export async function createDraw(input: typeof draws.$inferInsert) {
  const [draw] = await db.insert(draws).values(input).returning();
  return draw;
}
