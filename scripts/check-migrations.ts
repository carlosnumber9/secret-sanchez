import { execFileSync } from "node:child_process";
import { cpSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

const directory = mkdtempSync(path.join(tmpdir(), "ss-schema-"));
try {
  cpSync("drizzle", directory, { recursive: true });
  const journal = path.join(directory, "meta/_journal.json");
  const before = readFileSync(journal, "utf8");
  execFileSync(process.execPath, ["node_modules/drizzle-kit/bin.cjs", "generate", "--dialect=postgresql",
    `--schema=${path.resolve("src/db/schema.ts")}`, `--out=${directory}`, "--casing=snake_case"], { stdio: "pipe" });
  if (readFileSync(journal, "utf8") !== before) {
    throw new Error("El schema tiene cambios sin migración. Ejecuta npm run db:generate y revisa el SQL.");
  }
  console.log("Schema y migraciones coinciden.");
} finally { rmSync(directory, { recursive: true, force: true }); }
