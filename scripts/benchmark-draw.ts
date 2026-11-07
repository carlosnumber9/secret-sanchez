import { generateDraw } from "../src/services/draw/generateDraw";

for (const size of [27, 40, 500]) {
  const people = Array.from({ length: size }, (_, i) => ({ id: String(i), name: `Synthetic ${i}`, familyIslandId: size === 40 ? i < 21 ? "large" : "small" : String(i % 9), active: true, canGive: true, canReceive: true }));
  const started = performance.now();
  const result = generateDraw(people, { noSameIsland: true, exclusions: [] });
  console.log(JSON.stringify({ participants: size, possible: result.ok, durationMs: Math.round((performance.now() - started) * 100) / 100 }));
}
