import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createCipheriv, createDecipheriv, randomBytes, randomUUID } from "node:crypto";
import path from "node:path";
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import { isolatedTestDatabase } from "./test-database";
import * as s from "../src/db/schema";
import { encryptRevealToken, decryptRevealToken } from "../src/lib/tokens";

// This drill never loads .env and never exports an existing database.
const connection = new URL(isolatedTestDatabase(process.env.TEST_DATABASE_URL));
const control = postgres(connection.href, { max: 1, prepare: false, onnotice: () => {} });
const prefix = `ss_recovery_${randomUUID().replaceAll("-", "")}`;
const names = [`${prefix}_source_test`, `${prefix}_restore_test`];
const clients: ReturnType<typeof postgres>[] = [];
const binary = (name: string) => process.env.PG_BIN ? path.join(process.env.PG_BIN, name) : name;
const pgEnv = { PATH: process.env.PATH, PGCONNECT_TIMEOUT: "5", PGHOST: connection.hostname, PGPORT: connection.port || "5432", PGUSER: decodeURIComponent(connection.username), PGPASSWORD: decodeURIComponent(connection.password), PGSSLMODE: "disable" };
const created: string[] = [];
const started = performance.now();
try {
  await control.unsafe("DO $$ BEGIN IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname='anon') THEN CREATE ROLE anon NOLOGIN; END IF; IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname='authenticated') THEN CREATE ROLE authenticated NOLOGIN; END IF; END $$;");
  for (const name of names) {
    await control.unsafe(`create database "${name}"`);
    created.push(name);
    const url = new URL(connection); url.pathname = `/${name}`;
    clients.push(postgres(url.href, { max: 1, prepare: false, onnotice: () => {} }));
  }
  const source = drizzle(clients[0]);
  await migrate(source, { migrationsFolder: "drizzle" });
  const [admin] = await source.insert(s.adminUsers).values({ name: "Synthetic drill", email: "drill@example.invalid" }).returning();
  const [family] = await source.insert(s.families).values({ name: "Synthetic drill", slug: randomUUID(), ownerAdminId: admin.id }).returning();
  const [island] = await source.insert(s.familyIslands).values({ familyId: family.id, name: "Synthetic household" }).returning();
  const people = await source.insert(s.participants).values([1, 2].map((n) => ({ familyId: family.id, familyIslandId: island.id, name: `Synthetic ${n}`, email: `synthetic${n}@example.invalid` }))).returning();
  const [edition] = await source.insert(s.drawEditions).values({ familyId: family.id, name: "Synthetic edition", year: 2090, kind: "test", createdByAdminId: admin.id }).returning();
  const [draw] = await source.insert(s.draws).values({ editionId: edition.id, attemptNumber: 1, status: "generated" }).returning();
  const snapshots = await source.insert(s.drawParticipants).values(people.map((person) => ({ drawId: draw.id, sourceParticipantId: person.id, name: person.name, familyIslandName: island.name, canGive: true, canReceive: true }))).returning();
  const tokenKey = randomBytes(32).toString("base64");
  await source.insert(s.assignments).values(snapshots.map((person, i) => ({ drawId: draw.id, giverId: person.id, receiverId: snapshots[1 - i].id, revealTokenHash: String(i).repeat(64), revealTokenCiphertext: encryptRevealToken(`synthetic-token-${i}`, tokenKey), openedAt: i === 0 ? new Date(0) : null })));
  await source.insert(s.drawRules).values({ editionId: edition.id, type: "ATTEMPT_COUNTER", config: { lastUsed: 1 } });
  await source.insert(s.auditEvents).values({ actorAdminId: admin.id, editionId: edition.id, drawId: draw.id, event: "draw.generated" });
  const dump = execFileSync(binary("pg_dump"), ["--format=custom", "--no-owner", "--no-acl", `--dbname=${names[0]}`], { env: pgEnv, maxBuffer: 32 * 1024 * 1024, stdio: ["ignore", "pipe", "pipe"] });
  // Exercise authenticated encryption entirely in memory; no backup or key files.
  const archiveKey = randomBytes(32), iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", archiveKey, iv);
  const encrypted = Buffer.concat([cipher.update(dump), cipher.final()]);
  const tag = cipher.getAuthTag();
  dump.fill(0);
  function decrypt(value: Buffer) {
    const decipher = createDecipheriv("aes-256-gcm", archiveKey, iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(value), decipher.final()]);
  }
  const altered = Buffer.from(encrypted); altered[0] ^= 1;
  assert.throws(() => decrypt(altered));
  const restored = decrypt(encrypted);
  try {
    execFileSync(binary("pg_restore"), ["--exit-on-error", "--no-owner", "--no-acl", `--dbname=${names[1]}`], { env: pgEnv, input: restored, stdio: ["pipe", "pipe", "pipe"] });
  } finally { restored.fill(0); archiveKey.fill(0); }
  // Compare all application tables plus migration metadata, including empty ones.
  const tables = await clients[0]`select tablename from pg_tables where schemaname = 'public' order by tablename`;
  for (const { tablename } of tables) {
    const query = `select coalesce(jsonb_agg(to_jsonb(t) order by to_jsonb(t)::text), '[]'::jsonb) as rows from "public"."${tablename}" t`;
    assert.deepEqual((await clients[1].unsafe(query))[0].rows, (await clients[0].unsafe(query))[0].rows);
  }
  assert.deepEqual(await clients[1].unsafe('select * from drizzle.__drizzle_migrations order by id'), await clients[0].unsafe('select * from drizzle.__drizzle_migrations order by id'));
  const links = await drizzle(clients[1]).select().from(s.assignments);
  assert.equal(links.length, 2);
  assert.ok(links.every((row) => decryptRevealToken(row.revealTokenCiphertext!, tokenKey).startsWith("synthetic-token-")));
  for (const role of ["anon", "authenticated"]) await assert.rejects(clients[1].begin(async (tx) => { await tx.unsafe(`set local role ${role}`); await tx.unsafe("select * from public.assignments"); }), (error: unknown) => Boolean(error && typeof error === "object" && "code" in error && error.code === "42501"));
  console.log(`Recuperación sintética verificada: ${tables.length} tablas, journal, tokens y RLS; ${Math.round(performance.now() - started)} ms. Sin archivos ni datos reales.`);
} finally {
  for (const client of clients) await client.end();
  for (const name of created.reverse()) await control.unsafe(`drop database "${name}"`);
  await control.end();
}
