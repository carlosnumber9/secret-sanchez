import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import test from "node:test";

test("CLI environment respects exported values and local file precedence", () => {
  const directory = mkdtempSync(path.join(tmpdir(), "ss-cli-env-"));
  try {
    writeFileSync(path.join(directory, ".env"), "FIXTURE_ONE=base\nFIXTURE_TWO=base\nFIXTURE_THREE=base\n");
    writeFileSync(path.join(directory, ".env.local"), "FIXTURE_ONE=local\nFIXTURE_TWO=local\n");
    const loader = pathToFileURL(path.resolve("scripts/load-env.ts")).href;
    const result = spawnSync(process.execPath, ["--import", import.meta.resolve("tsx"), "--input-type=module", "-e",
      `await import(${JSON.stringify(loader)}); console.log(JSON.stringify([process.env.FIXTURE_ONE,process.env.FIXTURE_TWO,process.env.FIXTURE_THREE]));`],
      { cwd: directory, env: { PATH: process.env.PATH, FIXTURE_ONE: "exported" }, encoding: "utf8" });
    assert.equal(result.status, 0, result.stderr);
    assert.deepEqual(JSON.parse(result.stdout), ["exported", "local", "base"]);
  } finally { rmSync(directory, { recursive: true, force: true }); }
});
