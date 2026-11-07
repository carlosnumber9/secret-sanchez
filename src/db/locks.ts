import { and, eq, ne } from "drizzle-orm";
import { db } from "@/db/client";
import { drawEditions, draws, families } from "@/db/schema";
import { AppError } from "@/lib/errors";

export type Transaction = Parameters<Parameters<typeof db.transaction>[0]>[0];

export async function lockOwnedEdition(tx: Transaction, adminId: string, editionId: string) {
  const [reference] = await tx.select({ familyId: drawEditions.familyId }).from(drawEditions)
    .where(eq(drawEditions.id, editionId)).limit(1);
  if (!reference) throw new AppError(404, "EDITION_NOT_FOUND", "No se ha encontrado la edición.");
  const [family] = await tx.select().from(families)
    .where(and(eq(families.id, reference.familyId), eq(families.ownerAdminId, adminId))).for("update").limit(1);
  if (!family) throw new AppError(404, "EDITION_NOT_FOUND", "No se ha encontrado la edición.");
  const [edition] = await tx.select().from(drawEditions)
    .where(and(eq(drawEditions.id, editionId), eq(drawEditions.familyId, family.id))).for("update").limit(1);
  if (!edition) throw new AppError(404, "EDITION_NOT_FOUND", "No se ha encontrado la edición.");
  return { family, edition };
}

export async function withEditableEdition<T>(adminId: string, editionId: string, work: (tx: Transaction, owned: Awaited<ReturnType<typeof lockOwnedEdition>>) => Promise<T>) {
  return db.transaction(async (tx) => {
    const owned = await lockOwnedEdition(tx, adminId, editionId);
    const [current] = await tx.select({ id: draws.id }).from(draws)
      .where(and(eq(draws.editionId, editionId), ne(draws.status, "revoked"))).limit(1);
    if (current || owned.edition.status === "archived") throw new AppError(409, "EDITION_LOCKED", "Revoca el reparto vigente antes de cambiar una edición activa; las archivadas no se pueden editar.");
    return work(tx, owned);
  });
}

export async function lockOwnedFamily(tx: Transaction, adminId: string, familyId: string) {
  const [family] = await tx.select().from(families)
    .where(and(eq(families.id, familyId), eq(families.ownerAdminId, adminId))).for("update").limit(1);
  if (!family) throw new AppError(404, "FAMILY_NOT_FOUND", "No se ha encontrado la familia.");
  return family;
}
