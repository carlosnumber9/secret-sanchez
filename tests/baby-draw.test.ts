import assert from "node:assert/strict";
import test from "node:test";
import { generateBabyAssignments } from "../src/services/draw/generateBabyAssignments";

test("six babies are assigned to six distinct units outside their own", () => {
  const islands = Array.from({ length: 9 }, (_, index) => ({ id: `unit-${index}` }));
  const babies = [
    { id: "lucas", familyIslandId: "unit-4" },
    { id: "mario-jr", familyIslandId: "unit-5" },
    { id: "alvaro", familyIslandId: "unit-5" },
    { id: "gael", familyIslandId: "unit-6" },
    { id: "santi", familyIslandId: "unit-7" },
    { id: "macarena", familyIslandId: "unit-7" }
  ];
  for (let attempt = 0; attempt < 30; attempt += 1) {
    const result = generateBabyAssignments(babies, islands);
    assert.equal(result.ok, true);
    if (!result.ok) continue;
    assert.equal(result.assignments.length, 6);
    assert.equal(new Set(result.assignments.map(({ giverIslandId }) => giverIslandId)).size, 6);
    for (const assignment of result.assignments) {
      assert.notEqual(assignment.giverIslandId, babies.find(({ id }) => id === assignment.receiverId)?.familyIslandId);
    }
  }
});

test("baby assignment reports an impossible unit configuration", () => {
  const result = generateBabyAssignments(
    [{ id: "baby-a", familyIslandId: "only" }],
    [{ id: "only" }]
  );
  assert.equal(result.ok, false);
});
