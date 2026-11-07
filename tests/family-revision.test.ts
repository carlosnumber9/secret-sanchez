import assert from "node:assert/strict";
import test from "node:test";
import { familyRevision } from "../src/lib/family-revision";

test("family revisions ignore query order and detect edits without changed identifiers", () => {
  const islands = [{ id: "a", name: "Unit", color: null }, { id: "b", name: "Other", color: null }];
  const people = [{ id: "p", familyIslandId: "a", name: "Person", email: null, phone: null, preferredChannel: null, isBaby: false, sortOrder: 0 }];
  const revision = familyRevision(islands, people);
  assert.equal(familyRevision([...islands].reverse(), people), revision);
  for (const changes of [{ name: "Changed" }, { email: "changed@example.invalid" }, { sortOrder: 1 }, { familyIslandId: "b" }]) {
    assert.notEqual(familyRevision(islands, [{ ...people[0], ...changes }]), revision);
  }
});
