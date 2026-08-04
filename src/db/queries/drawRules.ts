import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { drawRules, exclusionRules } from "@/db/schema";

export async function listDrawRules(editionId: string) {
  return db.select().from(drawRules).where(eq(drawRules.editionId, editionId));
}

export async function listExclusionRules(editionId: string) {
  return db.select().from(exclusionRules).where(eq(exclusionRules.editionId, editionId));
}
