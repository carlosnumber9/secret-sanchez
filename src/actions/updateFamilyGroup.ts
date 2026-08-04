import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { families } from "@/db/schema";

export async function updateFamilyGroup(id: string, input: Partial<typeof families.$inferInsert>) {
  const [group] = await db
    .update(families)
    .set({ ...input, updatedAt: new Date() })
    .where(eq(families.id, id))
    .returning();
  return group;
}
