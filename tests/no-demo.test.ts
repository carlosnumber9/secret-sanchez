import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

async function sourceFiles(directory: string): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(
    entries.map((entry) => {
      const target = path.join(directory, entry.name);
      return entry.isDirectory() ? sourceFiles(target) : [target];
    })
  );
  return nested.flat().filter((file) => /\.(astro|ts|tsx)$/.test(file));
}

test("application source has no demo modes or fixtures", async () => {
  const files = await sourceFiles(path.resolve("src"));
  for (const file of files) {
    const contents = await readFile(file, "utf8");
    assert.doesNotMatch(contents, /\bdemo\b/i, file);
  }
});
