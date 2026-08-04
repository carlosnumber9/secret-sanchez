import { randomInt } from "node:crypto";

export type BabyReceiver = { id: string; familyIslandId: string };
export type BabyGiverIsland = { id: string };
export type BabyAssignment = { giverIslandId: string; receiverId: string };

function shuffle<T>(items: T[]) {
  const copy = [...items];
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const swapIndex = randomInt(index + 1);
    [copy[index], copy[swapIndex]] = [copy[swapIndex], copy[index]];
  }
  return copy;
}

export function generateBabyAssignments(
  babies: BabyReceiver[],
  islands: BabyGiverIsland[]
): { ok: true; assignments: BabyAssignment[] } | { ok: false; message: string } {
  if (!babies.length) return { ok: true, assignments: [] };
  if (islands.length < babies.length) {
    return { ok: false, message: "No hay suficientes unidades preparadas para asignar una distinta a cada bebé." };
  }

  const orderedBabies = shuffle(babies);
  const assignments: BabyAssignment[] = [];
  const usedIslandIds = new Set<string>();

  function place(index: number): boolean {
    if (index === orderedBabies.length) return true;
    const baby = orderedBabies[index];
    const candidates = shuffle(islands).filter(
      (island) => island.id !== baby.familyIslandId && !usedIslandIds.has(island.id)
    );
    for (const island of candidates) {
      assignments.push({ giverIslandId: island.id, receiverId: baby.id });
      usedIslandIds.add(island.id);
      if (place(index + 1)) return true;
      assignments.pop();
      usedIslandIds.delete(island.id);
    }
    return false;
  }

  if (!place(0)) {
    return { ok: false, message: "No existe una asignación válida de unidades para los bebés activos." };
  }
  return { ok: true, assignments };
}
