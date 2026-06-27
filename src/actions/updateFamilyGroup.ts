import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { familyGroups } from "@/db/schema";

export async function updateFamilyGroup(id: string, input: Partial<typeof familyGroups.$inferInsert>) {
  const [group] = await db
    .update(familyGroups)
    .set({ ...input, updatedAt: new Date() })
    .where(eq(familyGroups.id, id))
    .returning();
  return group;
}
