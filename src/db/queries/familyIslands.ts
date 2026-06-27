import { asc, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { familyIslands } from "@/db/schema";

export async function listFamilyIslands(groupId: string) {
  return db.select().from(familyIslands).where(eq(familyIslands.groupId, groupId)).orderBy(asc(familyIslands.createdAt));
}

export async function createFamilyIsland(input: {
  groupId: string;
  name: string;
  color?: string;
  description?: string;
}) {
  const [island] = await db.insert(familyIslands).values(input).returning();
  return island;
}

export async function updateFamilyIsland(
  id: string,
  input: Partial<{
    name: string;
    color: string;
    description: string;
  }>
) {
  const [island] = await db
    .update(familyIslands)
    .set({ ...input, updatedAt: new Date() })
    .where(eq(familyIslands.id, id))
    .returning();
  return island;
}
