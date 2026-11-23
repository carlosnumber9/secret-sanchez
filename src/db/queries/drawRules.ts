import { observe } from "@/lib/logger";
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { drawRules, exclusionRules } from "@/db/schema";

export async function listDrawRules(editionId: string) {
  return observe("db.rules.list", { editionId }, async () => {
    return db.select().from(drawRules).where(eq(drawRules.editionId, editionId));

  }, r => ({ rowCount: r.length }), { debug: true });
}

export async function listExclusionRules(editionId: string) {
  return observe("db.exclusions.list", { editionId }, async () => {
    return db.select().from(exclusionRules).where(eq(exclusionRules.editionId, editionId));

  }, r => ({ rowCount: r.length }), { debug: true });
}
