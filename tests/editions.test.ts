import assert from "node:assert/strict";
import test from "node:test";
import { nextAttemptNumber, resolveEditionParticipants, validateEditionRoles } from "../src/services/editions/configuration";
import { editionStatuses, getEditionStatusLabel } from "../src/services/editions/status";

const people = [
  { id: "a", familyIslandId: "one", enabled: true, islandEnabled: true, canGive: true, canReceive: true, isBaby: false },
  { id: "b", familyIslandId: "two", enabled: true, islandEnabled: true, canGive: true, canReceive: true, isBaby: false },
  { id: "c", familyIslandId: "three", enabled: true, islandEnabled: false, canGive: true, canReceive: true, isBaby: false }
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

test("edition lifecycle states have clear Spanish labels", () => {
  assert.deepEqual(editionStatuses, ["ready", "drawn", "sent", "archived"]);
  assert.deepEqual(
    editionStatuses.map(getEditionStatusLabel),
    ["En preparación", "Reparto generado", "Enviada", "Archivada"]
  );
});

test("babies receive but never give", () => {
  const withBaby = [...people, { id: "baby", familyIslandId: "one", enabled: true, islandEnabled: true, canGive: false, canReceive: true, isBaby: true }];
  assert.equal(validateEditionRoles(withBaby), null);
  assert.equal(validateEditionRoles(withBaby.map((person) => person.id === "baby" ? { ...person, canGive: true } : person)), "Los bebés activos reciben regalo, pero no pueden regalar.");
});
