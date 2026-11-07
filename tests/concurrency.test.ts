import assert from "node:assert/strict";
import test from "node:test";
import { mapConcurrent } from "../src/lib/concurrency";

test("bounded concurrency preserves order and drains active work before rejecting", async () => {
  let active = 0;
  let peak = 0;
  const result = await mapConcurrent([1, 2, 3, 4], 2, async (item) => {
    peak = Math.max(peak, ++active);
    await new Promise((resolve) => setImmediate(resolve));
    active--;
    return item * 2;
  });
  assert.deepEqual(result, [2, 4, 6, 8]);
  assert.equal(peak, 2);
  await assert.rejects(mapConcurrent([1, 2], 2, async (item) => {
    if (item === 1) throw new Error("Stopped");
    active++;
    await new Promise((resolve) => setImmediate(resolve));
    active--;
  }));
  assert.equal(active, 0);
});
