import { desc, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { draws } from "@/db/schema";

export async function getLatestDraw(groupId: string) {
  const [draw] = await db.select().from(draws).where(eq(draws.groupId, groupId)).orderBy(desc(draws.createdAt)).limit(1);
  return draw ?? null;
}

export async function createDraw(input: typeof draws.$inferInsert) {
  const [draw] = await db.insert(draws).values(input).returning();
  return draw;
}
