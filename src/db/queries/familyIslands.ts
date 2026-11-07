import { asc, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { familyIslands } from "@/db/schema";

export async function listFamilyIslands(familyId: string) {
  return db.select().from(familyIslands).where(eq(familyIslands.familyId, familyId)).orderBy(asc(familyIslands.createdAt));
}
