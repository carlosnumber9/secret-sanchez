import { observe } from "@/lib/logger";
import { and, asc, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { families } from "@/db/schema";

export async function getActiveFamilyGroupForAdmin(ownerAdminId: string) {
  return observe("db.families.active", {}, async () => {
    const [family] = await db.select().from(families).where(eq(families.ownerAdminId, ownerAdminId)).orderBy(asc(families.createdAt)).limit(1);
    return family ?? null;

  }, undefined, { debug: true });
}

export async function getOwnedFamilyGroup(familyId: string, ownerAdminId: string) {
  return observe("db.families.owned", { familyId }, async () => {
    const [family] = await db.select().from(families)
      .where(and(eq(families.id, familyId), eq(families.ownerAdminId, ownerAdminId))).limit(1);
    return family ?? null;

  }, undefined, { debug: true });
}
