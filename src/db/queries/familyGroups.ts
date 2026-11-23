import { registeredAdmin } from "@/db/admin-access";
import { observe } from "@/lib/logger";
import { and, asc, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { families } from "@/db/schema";

export async function getActiveFamilyGroupForAdmin(adminId: string) {
  return observe("db.families.active", {}, async () => {
    const [family] = await db.select().from(families).where(registeredAdmin(adminId)).orderBy(asc(families.createdAt)).limit(1);
    return family ?? null;

  }, undefined, { debug: true });
}

export async function getOwnedFamilyGroup(familyId: string, adminId: string) {
  return observe("db.families.owned", { familyId }, async () => {
    const [family] = await db.select().from(families)
      .where(and(eq(families.id, familyId), registeredAdmin(adminId))).limit(1);
    return family ?? null;

  }, undefined, { debug: true });
}
