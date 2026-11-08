import assert from "node:assert/strict";
import test from "node:test";
import { createSerialQueue } from "../src/lib/serial-queue";

test("serialized edits use the revision produced by the previous edit", async () => {
  const enqueue = createSerialQueue();
  let revision = 0;
  const seen: number[] = [];
  let release!: () => void;
  const gate = new Promise<void>((resolve) => { release = resolve; });
  const first = enqueue(async () => { seen.push(revision); await gate; revision++; });
  const second = enqueue(async () => { seen.push(revision); revision++; });
  await Promise.resolve();
  assert.deepEqual(seen, [0]);
  release();
  await Promise.all([first, second]);
  assert.deepEqual(seen, [0, 1]);
  assert.equal(revision, 2);
});

test("failed edits leave the queue available for a retry", async () => {
  const enqueue = createSerialQueue();
  const failure = enqueue(async () => { throw new Error("Rejected edit"); });
  const retry = enqueue(async () => "saved");
  await assert.rejects(failure, /Rejected edit/);
  assert.equal(await retry, "saved");
});
