import { observe } from "@/lib/logger";
import { asc, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { participants } from "@/db/schema";

export async function listParticipants(familyId: string) {
  return observe("db.participants.list", { familyId }, async () => {
    return db.select().from(participants).where(eq(participants.familyId, familyId))
      .orderBy(asc(participants.familyIslandId), asc(participants.sortOrder), asc(participants.createdAt));

  }, r => ({ rowCount: r.length }), { debug: true });
}
