import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import test from "node:test";

function runGuard(fail: boolean) {
  const hook = `import { registerHooks } from 'node:module';
    registerHooks({ resolve(specifier, context, nextResolve) {
      if (specifier === '@astrojs/check' || specifier === 'typescript') {
        ${fail ? "throw new Error('synthetic-private-diagnostic');" : "return { url: 'data:text/javascript,export const available = true;', shortCircuit: true };"}
      }
      return nextResolve(specifier, context);
    } });`;
  return spawnSync(process.execPath, ["--import", `data:text/javascript,${encodeURIComponent(hook)}`, "scripts/check-build-tools.mjs"], { encoding: "utf8" });
}

test("build stops with a useful error when type checking cannot load", () => {
  const result = runGuard(true);
  assert.equal(result.status, 1);
  assert.match(result.stderr, /No se pudo cargar el comprobador de tipos/);
  assert.doesNotMatch(result.stderr, /synthetic-private-diagnostic/);
});

test("build can proceed when both checker dependencies load", () => {
  const result = runGuard(false);
  assert.equal(result.status, 0);
  assert.equal(result.stderr, "");
});
