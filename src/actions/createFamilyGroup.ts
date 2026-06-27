import { createFamilyGroup as insertFamilyGroup } from "@/db/queries/familyGroups";

export async function createFamilyGroup(input: {
  name: string;
  slug: string;
  year: number;
  ownerAdminId: string;
}) {
  return insertFamilyGroup(input);
}
