import "./load-env";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash, randomBytes } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { parseArgs } from "node:util";
import postgres from "postgres";
import { isolatedTestDatabase } from "./test-database";
import { decryptArchive, encryptArchive, familyTables, retainedFamilySnapshot, type DataSnapshot } from "./family-recovery";

const { values } = parseArgs({ options: {
  mode: { type: "string" }, "keep-family-id": { type: "string" }, "remove-family-ids": { type: "string" },
  "expected-project-ref": { type: "string" }, "expected-app-origin": { type: "string" },
  "recovery-dir": { type: "string" }
} });
const mode = values.mode;
if (!["backup", "verify", "apply"].includes(mode ?? "")) throw new Error("Indica --mode backup, verify o apply. No hay escrituras implícitas.");
const directory = path.resolve(required(values["recovery-dir"], "--recovery-dir"));
const binary = (name: string) => process.env.PG_BIN ? path.join(process.env.PG_BIN, name) : name;
const archivePath = path.join(directory, "database.enc");
const keyPath = path.join(directory, "recovery.key");
const verificationPath = path.join(directory, "verified.json");
type Archive = { projectRef: string; appOrigin: string; keepId: string; removeIds: string[]; snapshot: DataSnapshot; dump: string };

function required(value: string | undefined, name: string) {
  if (!value) throw new Error(`Falta ${name}.`);
  return value;
}
function pgEnvironment(url: URL) {
  return { PATH: process.env.PATH, PGHOST: url.hostname, PGPORT: url.port || "5432", PGDATABASE: url.pathname.slice(1), PGUSER: decodeURIComponent(url.username), PGPASSWORD: decodeURIComponent(url.password), PGSSLMODE: url.hostname === "127.0.0.1" ? "disable" : "require", PGCONNECT_TIMEOUT: "10" };
}
const digest = (data: Buffer) => createHash("sha256").update(data).digest("hex");
function loadArchive() {
  const encrypted = readFileSync(archivePath);
  const plaintext = decryptArchive(encrypted, readFileSync(keyPath));
  try { return { archive: JSON.parse(plaintext.toString()) as Archive, fingerprint: digest(encrypted) }; }
  finally { plaintext.fill(0); }
}
async function readSnapshot(client: postgres.TransactionSql) {
  await client`set local timezone = 'UTC'`;
  const tables = await client`select tablename from pg_tables where schemaname = 'public' order by tablename`;
  const snapshot: DataSnapshot = {};
  for (const { tablename } of tables) {
    const [row] = await client`select coalesce(jsonb_agg(to_jsonb(t) order by to_jsonb(t)::text), '[]'::jsonb) as rows from ${client(`public.${tablename}`)} t`;
    snapshot[tablename] = row.rows;
  }
  return snapshot;
}
function sameCriticalData(actual: DataSnapshot, expected: DataSnapshot) {
  for (const table of ["admin_users", ...familyTables]) assert.deepEqual(actual[table], expected[table], `Los datos de ${table} cambiaron; operación cancelada.`);
}
function counts(snapshot: DataSnapshot) {
  return Object.fromEntries(["admin_users", ...familyTables].map(table => [table, snapshot[table].length]));
}

try {
  if (mode === "verify") {
    const { archive, fingerprint } = loadArchive();
    const url = new URL(isolatedTestDatabase(process.env.RESTORE_DATABASE_URL));
    const local = postgres(url.href, { prepare: false, max: 1, onnotice: () => {} });
    try {
      const [row] = await local`select count(*)::int as count from pg_tables where schemaname not in ('pg_catalog', 'information_schema')`;
      if (row.count !== 0) throw new Error("La base local de recuperación debe estar vacía.");
      const dump = Buffer.from(archive.dump, "base64");
      try { execFileSync(binary("pg_restore"), ["--exit-on-error", "--single-transaction", "--clean", "--if-exists", "--no-owner", "--no-acl", `--dbname=${url.pathname.slice(1)}`], { env: pgEnvironment(url), input: dump, stdio: ["pipe", "pipe", "pipe"], maxBuffer: 32 * 1024 * 1024 }); }
      finally { dump.fill(0); }
      const restored = await local.begin("read only", tx => readSnapshot(tx));
      assert.deepEqual(restored, archive.snapshot, "La restauración no coincide con la copia.");
      writeFileSync(verificationPath, JSON.stringify({ fingerprint, verifiedAt: new Date().toISOString() }), { mode: 0o600, flag: "wx" });
      console.log(JSON.stringify({ result: "restore_verified", counts: counts(archive.snapshot) }));
    } finally { await local.end(); }
  } else {
    const expectedRef = required(values["expected-project-ref"], "--expected-project-ref");
    const expectedOrigin = new URL(required(values["expected-app-origin"], "--expected-app-origin")).origin;
    const keepId = required(values["keep-family-id"], "--keep-family-id");
    const removeIds = required(values["remove-family-ids"], "--remove-family-ids").split(",").sort();
    const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (![keepId, ...removeIds].every(id => uuid.test(id)) || removeIds.includes(keepId) || new Set(removeIds).size !== removeIds.length) throw new Error("La selección de familias no es válida.");
    const url = new URL(required(process.env.DATABASE_URL, "DATABASE_URL"));
    const authRef = new URL(required(process.env.PUBLIC_SUPABASE_URL, "PUBLIC_SUPABASE_URL")).hostname.split(".")[0];
    const dbRef = decodeURIComponent(url.username).split(".")[1] ?? url.hostname.match(/^db\.([^.]+)\.supabase\.co$/)?.[1];
    if (authRef !== expectedRef || dbRef !== expectedRef || new URL(required(process.env.APP_URL, "APP_URL")).origin !== expectedOrigin) throw new Error("El destino no coincide con el proyecto y origen autorizados.");
    const saved = mode === "apply" ? loadArchive() : null;
    if (saved) {
      assert.equal(saved.archive.projectRef, expectedRef);
      assert.equal(saved.archive.appOrigin, expectedOrigin);
      assert.equal(saved.archive.keepId, keepId);
      assert.deepEqual(saved.archive.removeIds, removeIds);
      assert.equal(JSON.parse(readFileSync(verificationPath, "utf8")).fingerprint, saved.fingerprint, "Falta restauración verificada de esta copia.");
    }
    const client = postgres(url.href, { prepare: false, max: 1, connect_timeout: 10, onnotice: () => {} });
    try {
      const result = await client.begin(async tx => {
        await tx`set local lock_timeout = '10s'`;
        await tx`set local statement_timeout = '60s'`;
        // Brief maintenance lock: pg_dump can read while application writes wait.
        await tx`lock table ${tx(familyTables.map(t => `public.${t}`))} in share row exclusive mode`;
        await tx`lock table public.admin_users in share mode`;
        const before = await readSnapshot(tx);
        assert.deepEqual(before.families.map(r => r.id).sort(), [keepId, ...removeIds].sort(), "Hay familias nuevas o ausentes. Revisa el plan.");
        const expected = retainedFamilySnapshot(before, keepId);
        if (mode === "backup") {
          mkdirSync(directory, { recursive: true, mode: 0o700 });
          const dump = execFileSync(binary("pg_dump"), ["--format=custom", "--no-owner", "--no-acl", "--schema=public", "--schema=drizzle"], { env: pgEnvironment(url), stdio: ["ignore", "pipe", "pipe"], maxBuffer: 64 * 1024 * 1024 });
          const key = randomBytes(32);
          const archive: Archive = { projectRef: expectedRef, appOrigin: expectedOrigin, keepId, removeIds, snapshot: before, dump: dump.toString("base64") };
          const plaintext = Buffer.from(JSON.stringify(archive));
          try {
            writeFileSync(keyPath, key, { mode: 0o600, flag: "wx" });
            const encrypted = encryptArchive(plaintext, key);
            assert.deepEqual(decryptArchive(encrypted, key), plaintext);
            writeFileSync(archivePath, encrypted, { mode: 0o600, flag: "wx" });
          } finally { dump.fill(0); plaintext.fill(0); key.fill(0); }
          sameCriticalData(await readSnapshot(tx), before);
          return { result: "backup_created", before: counts(before), afterPlanned: counts(expected) };
        }
        sameCriticalData(before, saved!.archive.snapshot);
        await tx`delete from families where id in ${tx(removeIds)}`;
        const after = await readSnapshot(tx);
        sameCriticalData(after, expected);
        return { result: "consolidated", before: counts(before), after: counts(after) };
      });
      console.log(JSON.stringify(result));
    } finally { await client.end(); }
  }
} catch (error) {
  // Provider errors and child-process buffers can contain credentials or contacts.
  const known = ["La base local de recuperación debe estar vacía.", "La selección de familias no es válida.", "El destino no coincide con el proyecto y origen autorizados."];
  const safe = error instanceof assert.AssertionError ? error.message.split("\n")[0] : error instanceof Error && known.includes(error.message) ? error.message : "Falló la operación; no se muestran detalles privados.";
  console.error(safe);
  process.exitCode = 1;
}
