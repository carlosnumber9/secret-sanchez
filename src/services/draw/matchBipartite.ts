import { randomInt } from "node:crypto";

function shuffle<T>(items: T[]) {
  const copy = [...items];
  for (let index = copy.length - 1; index > 0; index--) {
    const swap = randomInt(index + 1);
    [copy[index], copy[swap]] = [copy[swap], copy[index]];
  }
  return copy;
}

export function matchBipartite(leftIds: string[], rightIds: string[], allowed: (left: string, right: string) => boolean) {
  if (leftIds.length > 500 || rightIds.length > 500 || leftIds.length > rightIds.length) return null;
  if (new Set(leftIds).size !== leftIds.length || new Set(rightIds).size !== rightIds.length) return null;
  const candidates = new Map(leftIds.map((left) => [left, shuffle(rightIds.filter((right) => allowed(left, right)))]));
  if ([...candidates.values()].some((items) => !items.length)) return null;
  const ordered = shuffle(leftIds).sort((a, b) => candidates.get(a)!.length - candidates.get(b)!.length);
  const owner = new Map<string, string>();
  function augment(left: string, visited: Set<string>): boolean {
    for (const right of candidates.get(left)!) {
      if (visited.has(right)) continue;
      visited.add(right);
      const previous = owner.get(right);
      if (previous === undefined || augment(previous, visited)) { owner.set(right, left); return true; }
    }
    return false;
  }
  for (const left of ordered) if (!augment(left, new Set())) return null;
  return [...owner].map(([right, left]) => ({ left, right }));
}
