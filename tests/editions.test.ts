import assert from "node:assert/strict";
import test from "node:test";
import { nextAttemptNumber, resolveEditionParticipants, validateEditionRoles } from "../src/services/editions/configuration";

const people = [
  { id: "a", familyIslandId: "one", enabled: true, islandEnabled: true, canGive: true, canReceive: true },
  { id: "b", familyIslandId: "two", enabled: true, islandEnabled: true, canGive: true, canReceive: true },
  { id: "c", familyIslandId: "three", enabled: true, islandEnabled: false, canGive: true, canReceive: true }
];

test("a disabled island takes precedence over participant configuration", () => {
  assert.deepEqual(resolveEditionParticipants(people).map(({ id }) => id), ["a", "b"]);
});

test("enabled participants need at least one role", () => {
  assert.equal(validateEditionRoles(people.map((person) => person.id === "a" ? { ...person, canGive: false, canReceive: false } : person)), "Una persona activa debe regalar, recibir o ambas cosas.");
});

test("giver and receiver totals must be balanced", () => {
  assert.equal(validateEditionRoles(people.map((person) => person.id === "a" ? { ...person, canReceive: false } : person)), "El número de personas que regalan y reciben debe coincidir.");
  assert.equal(validateEditionRoles(people), null);
});

test("attempt numbers are monotonic and gaps are not reused", () => {
  assert.equal(nextAttemptNumber([]), 1);
  assert.equal(nextAttemptNumber([1, 3, 4]), 5);
});
