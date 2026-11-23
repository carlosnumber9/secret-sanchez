import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

export type DataSnapshot = Record<string, Array<Record<string, unknown>>>;

export const familyTables = ["families", "family_islands", "participants", "draw_editions", "edition_participants", "edition_island_configs", "draw_rules", "exclusion_rules", "draws", "draw_participants", "draw_islands", "assignments", "notification_logs"] as const;

export function encryptArchive(plaintext: Buffer, key: Buffer) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const data = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), data]);
}

export function decryptArchive(archive: Buffer, key: Buffer) {
  const decipher = createDecipheriv("aes-256-gcm", key, archive.subarray(0, 12));
  decipher.setAuthTag(archive.subarray(12, 28));
  return Buffer.concat([decipher.update(archive.subarray(28)), decipher.final()]);
}

export function retainedFamilySnapshot(snapshot: DataSnapshot, keepId: string): DataSnapshot {
  if (snapshot.families.filter(r => r.id === keepId).length !== 1) throw new Error("La familia que se debe conservar no existe.");
  const result = { ...snapshot };
  result.families = snapshot.families.filter(r => r.id === keepId);
  for (const table of ["family_islands", "participants", "draw_editions"]) result[table] = snapshot[table].filter(r => r.family_id === keepId);
  const editionIds = new Set(result.draw_editions.map(r => r.id));
  for (const table of ["edition_participants", "edition_island_configs", "draw_rules", "exclusion_rules", "draws"]) result[table] = snapshot[table].filter(r => editionIds.has(r.edition_id));
  const drawIds = new Set(result.draws.map(r => r.id));
  for (const table of ["draw_participants", "draw_islands", "assignments"]) result[table] = snapshot[table].filter(r => drawIds.has(r.draw_id));
  const assignmentIds = new Set(result.assignments.map(r => r.id));
  result.notification_logs = snapshot.notification_logs.filter(r => assignmentIds.has(r.assignment_id));
  return result;
}
