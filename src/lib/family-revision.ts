import { createHash } from "node:crypto";

type Island = { id: string; name: string; color: string | null; description?: string | null };
type Person = {
  id: string; familyIslandId: string; name: string; email: string | null; phone: string | null;
  preferredChannel: string | null; isBaby: boolean; sortOrder: number;
};

export function familyRevision(islands: Island[], people: Person[]) {
  const byId = <T extends { id: string }>(rows: T[]) => [...rows].sort((a, b) => a.id.localeCompare(b.id));
  return createHash("sha256").update(JSON.stringify({
    islands: byId(islands).map((i) => [i.id, i.name, i.color, i.description ?? null]),
    people: byId(people).map((p) => [p.id, p.familyIslandId, p.name, p.email, p.phone, p.preferredChannel, p.isBaby, p.sortOrder])
  })).digest("hex");
}
