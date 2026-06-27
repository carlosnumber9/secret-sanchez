import { createFamilyIsland as insertFamilyIsland } from "@/db/queries/familyIslands";

export async function createFamilyIsland(input: {
  groupId: string;
  name: string;
  color?: string;
  description?: string;
}) {
  return insertFamilyIsland(input);
}
