import { and, eq, sql } from "drizzle-orm";
import type { Transaction } from "@/db/locks";
import { familyIslands, participants } from "@/db/schema";

type PersonUpdate = Pick<typeof participants.$inferSelect, "id" | "familyIslandId" | "name" | "email" | "phone" | "preferredChannel" | "isBaby" | "sortOrder">;

export async function updateIslandsInBatch(tx: Transaction, familyId: string, changes: Array<{ id: string; name: string; color: string }>) {
  if (!changes.length) return [];
  return tx.update(familyIslands).set({ name: sql`changes.name`, color: sql`changes.color`, updatedAt: new Date() })
    .from(sql`jsonb_to_recordset(${JSON.stringify(changes)}::jsonb) as changes(id uuid, name text, color text)`)
    .where(and(eq(familyIslands.id, sql`changes.id`), eq(familyIslands.familyId, familyId))).returning();
}

export async function updatePeopleInBatch(tx: Transaction, familyId: string, changes: PersonUpdate[]) {
  if (!changes.length) return [];
  const values = changes.map((p) => ({ id: p.id, family_island_id: p.familyIslandId, name: p.name, email: p.email, phone: p.phone, preferred_channel: p.preferredChannel, is_baby: p.isBaby, sort_order: p.sortOrder }));
  return tx.update(participants).set({
    familyIslandId: sql`changes.family_island_id`, name: sql`changes.name`, email: sql`changes.email`, phone: sql`changes.phone`,
    preferredChannel: sql`changes.preferred_channel`, isBaby: sql`changes.is_baby`, sortOrder: sql`changes.sort_order`, updatedAt: new Date()
  }).from(sql`jsonb_to_recordset(${JSON.stringify(values)}::jsonb) as changes(id uuid, family_island_id uuid, name text, email text, phone text, preferred_channel preferred_channel, is_baby boolean, sort_order integer)`)
    .where(and(eq(participants.id, sql`changes.id`), eq(participants.familyId, familyId))).returning();
}
