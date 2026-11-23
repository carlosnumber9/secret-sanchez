import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import test from "node:test";
import { decryptArchive, encryptArchive, familyTables, retainedFamilySnapshot, type DataSnapshot } from "../scripts/family-recovery";

test("recovery encryption rejects tampering and unrelated keys", () => {
  const key = randomBytes(32);
  const original = Buffer.from("Synthetic recovery payload");
  const encrypted = encryptArchive(original, key);
  assert.deepEqual(decryptArchive(encrypted, key), original);
  assert.throws(() => decryptArchive(encrypted, randomBytes(32)));
  const corrupted = Buffer.from(encrypted);
  corrupted[corrupted.length - 1] ^= 1;
  assert.throws(() => decryptArchive(corrupted, key));
});

test("consolidation retains only the chosen family graph and preserves accounts and audit history", () => {
  const snapshot: DataSnapshot = Object.fromEntries(familyTables.map(t => [t, []]));
  snapshot.admin_users = [{ id: "first" }, { id: "second" }];
  snapshot.audit_events = [{ id: "audit", edition_id: "remove-edition" }];
  snapshot.families = [{ id: "keep" }, { id: "remove" }];
  for (const t of ["family_islands", "participants", "draw_editions"]) snapshot[t] = ["keep", "remove"].map(id => ({ id: `${id}-edition`, family_id: id }));
  for (const t of ["edition_participants", "edition_island_configs", "draw_rules", "exclusion_rules", "draws"]) snapshot[t] = ["keep", "remove"].map(id => ({ id: `${id}-draw`, edition_id: `${id}-edition` }));
  for (const t of ["draw_participants", "draw_islands", "assignments"]) snapshot[t] = ["keep", "remove"].map(id => ({ id: `${id}-assignment`, draw_id: `${id}-draw`, email: `${id}@example.invalid` }));
  snapshot.notification_logs = ["keep", "remove"].map(id => ({ id, assignment_id: `${id}-assignment` }));
  const before = structuredClone(snapshot);
  const retained = retainedFamilySnapshot(snapshot, "keep");
  for (const t of familyTables) assert.equal(retained[t].length, 1, t);
  assert.deepEqual(retained.admin_users, snapshot.admin_users);
  assert.deepEqual(retained.audit_events, snapshot.audit_events);
  assert.equal(retained.draw_participants[0].email, "keep@example.invalid");
  assert.deepEqual(snapshot, before);
  assert.throws(() => retainedFamilySnapshot(snapshot, "missing"));
});
