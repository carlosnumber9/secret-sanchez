import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { drawRules, exclusionRules } from "@/db/schema";

export async function listDrawRules(groupId: string) {
  return db.select().from(drawRules).where(eq(drawRules.groupId, groupId));
}

export async function listExclusionRules(groupId: string) {
  return db.select().from(exclusionRules).where(eq(exclusionRules.groupId, groupId));
}
