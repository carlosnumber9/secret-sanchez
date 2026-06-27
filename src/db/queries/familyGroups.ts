import { desc, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { drawRules, familyGroups } from "@/db/schema";
import { DRAW_RULES } from "@/services/draw/rules";

export async function getLatestFamilyGroup() {
  const [group] = await db.select().from(familyGroups).orderBy(desc(familyGroups.createdAt)).limit(1);
  return group ?? null;
}

export async function getFamilyGroupById(groupId: string) {
  const [group] = await db.select().from(familyGroups).where(eq(familyGroups.id, groupId)).limit(1);
  return group ?? null;
}

export async function createFamilyGroup(input: {
  name: string;
  slug: string;
  year: number;
  ownerAdminId: string;
}) {
  const [group] = await db
    .insert(familyGroups)
    .values({
      name: input.name,
      slug: input.slug,
      year: input.year,
      ownerAdminId: input.ownerAdminId
    })
    .returning();

  await db.insert(drawRules).values({
    groupId: group.id,
    type: DRAW_RULES.NO_SAME_ISLAND,
    enabled: true,
    config: {}
  });

  return group;
}
