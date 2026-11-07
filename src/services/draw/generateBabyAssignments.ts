import { matchBipartite } from "./matchBipartite";

export type BabyReceiver = { id: string; familyIslandId: string };
export type BabyGiverIsland = { id: string };
export type BabyAssignment = { giverIslandId: string; receiverId: string };

export function generateBabyAssignments(babies: BabyReceiver[], islands: BabyGiverIsland[]):
  { ok: true; assignments: BabyAssignment[] } | { ok: false; message: string } {
  if (!babies.length) return { ok: true, assignments: [] };
  if (islands.length < babies.length) return { ok: false, message: "No hay suficientes unidades preparadas para asignar una distinta a cada bebé." };
  const byId = new Map(babies.map((baby) => [baby.id, baby]));
  const pairs = matchBipartite(babies.map((baby) => baby.id), islands.map((island) => island.id),
    (baby, island) => byId.get(baby)!.familyIslandId !== island);
  if (!pairs) return { ok: false, message: "No existe una asignación válida de unidades para los bebés activos." };
  return { ok: true, assignments: pairs.map(({ left, right }) => ({ giverIslandId: right, receiverId: left })) };
}
