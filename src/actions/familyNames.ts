import { and, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { lockOwnedFamily } from "@/db/locks";
import { familyIslands, participants } from "@/db/schema";
import { AppError } from "@/lib/errors";
import { familyRevision } from "@/lib/family-revision";

export async function renameOwnedFamilyMember(adminId: string, familyId: string, input: {
  revision: string;
  kind: "island" | "participant";
  id: string;
  name: string;
}) {
  return db.transaction(async (tx) => {
    await lockOwnedFamily(tx, adminId, familyId);
    const islands = await tx.select().from(familyIslands).where(eq(familyIslands.familyId, familyId)).for("update");
    const people = await tx.select().from(participants).where(eq(participants.familyId, familyId)).for("update");
    if (input.revision !== familyRevision(islands, people)) {
      throw new AppError(409, "FAMILY_DRAFT_STALE", "La familia cambió en otra operación. Conserva tus cambios y recarga antes de guardar.");
    }

    if (input.kind === "island") {
      if (!islands.some(({ id }) => id === input.id)) {
        throw new AppError(404, "ISLAND_NOT_FOUND", "No se ha encontrado la unidad.");
      }
      await tx.update(familyIslands).set({ name: input.name, updatedAt: new Date() })
        .where(and(eq(familyIslands.id, input.id), eq(familyIslands.familyId, familyId)));
    } else {
      if (!people.some(({ id }) => id === input.id)) {
        throw new AppError(404, "PARTICIPANT_NOT_FOUND", "No se ha encontrado la persona.");
      }
      await tx.update(participants).set({ name: input.name, updatedAt: new Date() })
        .where(and(eq(participants.id, input.id), eq(participants.familyId, familyId)));
    }

    return {
      name: input.name,
      revision: familyRevision(
        islands.map((island) => input.kind === "island" && island.id === input.id ? { ...island, name: input.name } : island),
        people.map((person) => input.kind === "participant" && person.id === input.id ? { ...person, name: input.name } : person)
      )
    };
  });
}
