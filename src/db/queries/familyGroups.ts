import { and, asc, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { families } from "@/db/schema";

export async function getActiveFamilyGroupForAdmin(ownerAdminId: string) {
  const [family] = await db.select().from(families).where(eq(families.ownerAdminId, ownerAdminId)).orderBy(asc(families.createdAt)).limit(1);
  return family ?? null;
}

export async function getOwnedFamilyGroup(familyId: string, ownerAdminId: string) {
  const [family] = await db.select().from(families)
    .where(and(eq(families.id, familyId), eq(families.ownerAdminId, ownerAdminId))).limit(1);
  return family ?? null;
}
