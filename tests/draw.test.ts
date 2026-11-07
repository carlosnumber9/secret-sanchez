import assert from "node:assert/strict";
import test from "node:test";
import { generateDraw } from "../src/services/draw/generateDraw";
import { validateDraw } from "../src/services/draw/validateDraw";

const people = [
  { id: "a", name: "A", familyIslandId: "one", active: true, canGive: true, canReceive: true },
  { id: "b", name: "B", familyIslandId: "two", active: true, canGive: true, canReceive: true },
  { id: "c", name: "C", familyIslandId: "three", active: true, canGive: true, canReceive: true }
];

test("generated draws satisfy all configured invariants", () => {
  for (let attempt = 0; attempt < 30; attempt += 1) {
    const result = generateDraw(people, { noSameIsland: true, exclusions: [] });
    assert.equal(result.ok, true);
    if (result.ok) assert.equal(validateDraw(people, result.assignments, { noSameIsland: true, exclusions: [] }), null);
  }
});

test("an impossible same-island draw is rejected", () => {
  const result = generateDraw(
    people.map((person) => ({ ...person, familyIslandId: "one" })),
    { noSameIsland: true, exclusions: [] }
  );
  assert.equal(result.ok, false);
});

test("validation rejects duplicate givers even when every receiver is unique", () => {
  const error = validateDraw(people, [
    { giverId: "a", receiverId: "b" },
    { giverId: "a", receiverId: "c" },
    { giverId: "b", receiverId: "a" }
  ], { noSameIsland: true, exclusions: [] });
  assert.equal(error, "Cada persona que regala debe aparecer exactamente una vez.");
});

test("validation rejects an unknown giver and duplicate participant identities", () => {
  const assignments = [{ giverId: "a", receiverId: "b" }, { giverId: "b", receiverId: "c" }, { giverId: "other", receiverId: "a" }];
  assert.notEqual(validateDraw(people, assignments, { noSameIsland: true, exclusions: [] }), null);
  assert.notEqual(validateDraw([...people, people[0]], assignments, { noSameIsland: true, exclusions: [] }), null);
});
