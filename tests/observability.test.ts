import assert from "node:assert/strict";
import test, { type TestContext } from "node:test";
import { randomUUID } from "node:crypto";
import { AppError } from "../src/lib/errors";
import { handleApiError } from "../src/lib/api";
import { addLogFields, logCommitted, logger, observe, observeTransaction, setLogActor, traceRequest, withLogFields, type LogFields } from "../src/lib/logger";

function capture(t: TestContext) {
  const entries: Array<Record<string, any>> = [];
  for (const method of ["log", "warn", "error"] as const) t.mock.method(console, method, (line: unknown) => entries.push(JSON.parse(String(line))));
  return entries;
}
const tick = () => new Promise<void>((resolve) => setImmediate(resolve));

test("concurrent requests and delivery jobs isolate actors, fields and operation IDs", async (t) => {
  const logs = capture(t);
  const admins = [randomUUID(), randomUUID()];
  const assignments = [randomUUID(), randomUUID()];
  const responses = await Promise.all(admins.map((adminId) => traceRequest({ route: "/api/admin/editions/[id]/notifications/send", method: "POST" }, async () => {
    setLogActor({ actorType: "admin", adminId, authUserId: adminId });
    await observe("notification.batch", { editionId: adminId }, async () => Promise.all(assignments.map((assignmentId) => observe("notification.delivery", { assignmentId }, async () => {
      await tick();
      addLogFields({ notificationId: assignmentId });
      logger.info("notification.job", { result: "accepted" });
    }))));
    return Response.json({ ok: true });
  })));
  assert.notEqual(responses[0].headers.get("X-Request-Id"), responses[1].headers.get("X-Request-Id"));
  for (const [index, response] of responses.entries()) {
    const requestLogs = logs.filter((entry) => entry.requestId === response.headers.get("X-Request-Id"));
    const jobs = requestLogs.filter((entry) => entry.event === "notification.job");
    assert.equal(jobs.length, 2);
    assert.equal(new Set(jobs.map((entry) => entry.operationId)).size, 2);
    for (const job of jobs) {
      assert.equal(job.adminId, admins[index]);
      assert.equal(job.editionId, admins[index]);
      assert.equal(job.assignmentId, job.notificationId);
      assert.ok(job.parentOperationId);
    }
    assert.equal(requestLogs.at(-1)?.assignmentId, undefined);
    assert.equal(requestLogs.at(-1)?.adminId, admins[index]);
  }
});

test("all response outcomes preserve status, body, headers and final correlation", async (t) => {
  const logs = capture(t);
  for (const status of [200, 303, 400, 401, 403, 409, 413, 429, 500, 503]) {
    const response = await traceRequest({ route: "/api/health", method: "GET" }, async () => new Response(status === 303 ? null : "unchanged", { status, headers: { "Set-Cookie": "synthetic=1; HttpOnly", "Retry-After": "2" } }));
    assert.equal(response.status, status);
    assert.equal(response.headers.get("Set-Cookie"), "synthetic=1; HttpOnly");
    assert.equal(response.headers.get("Retry-After"), "2");
    assert.equal(await response.text(), status === 303 ? "" : "unchanged");
    const final = logs.findLast((entry) => entry.requestId === response.headers.get("X-Request-Id"));
    assert.equal(final?.event, "request.completed");
    assert.equal(final?.status, status);
  }
});

test("technical errors get one diagnostic across cause wrapping and API boundaries", async (t) => {
  const logs = capture(t);
  const cause = Object.assign(new Error("secret SQL and contacts"), { code: "ECONNRESET" });
  const response = await traceRequest({ route: "/api/health", method: "GET" }, async () => {
    try {
      await observe("db.assignments.list", {}, async () => { throw cause; });
      return new Response();
    } catch (error) { return handleApiError("health.failed", new Error("private provider payload", { cause: error })); }
  });
  const body = await response.json();
  const diagnostics = logs.filter((entry) => entry.errorChain);
  assert.equal(diagnostics.length, 1);
  assert.equal(diagnostics[0].errorId, body.errorId);
  assert.equal(logs.at(-1)?.errorId, body.errorId);
  assert.doesNotMatch(JSON.stringify(logs), /secret SQL|private provider payload/);
});

test("unhandled SSR and API errors become correlated generic responses", async (t) => {
  const logs = capture(t);
  for (const route of ["/familia", "/api/health"]) {
    const response = await traceRequest({ route, method: "GET" }, async () => { throw new Error("private runtime message"); });
    assert.equal(response.status, 500);
    assert.ok(response.headers.get("X-Request-Id"));
    assert.doesNotMatch(await response.text(), /private runtime message/);
  }
  assert.equal(logs.filter((entry) => entry.event === "request.failed").length, 2);
});

test("commit failures discard pending success events and report commit stage", async (t) => {
  const logs = capture(t);
  const failure = new Error("commit outcome private");
  const response = await traceRequest({ route: "/api/admin/editions/[id]/draws/generate", method: "POST" }, async () => {
    await observe("draw.generation", {}, () => observeTransaction(async (completed) => {
      await observe("db.bulk.islands", {}, async () => 3);
      logCommitted("audit.persisted", { persisted: true });
      completed();
      assert.equal(logs.some((entry) => entry.event.endsWith(".succeeded")), false);
      throw failure;
    }));
    return new Response();
  });
  assert.equal(response.status, 500);
  assert.equal(logs.some((entry) => entry.event.endsWith(".succeeded") || entry.event === "audit.persisted"), false);
  assert.equal(logs.find((entry) => entry.event === "transaction.failed")?.stage, "commit");
  assert.equal(logs.filter((entry) => entry.errorChain).length, 1);
});

test("committed child operations retain their operation context and rollback never reports success", async (t) => {
  const logs = capture(t);
  await traceRequest({ route: "/familia", method: "POST" }, async () => {
    await observeTransaction(async (completed) => {
      await observe("db.bulk.islands", { familyId: randomUUID() }, async () => 1);
      completed();
      return 1;
    });
    try {
      await observeTransaction(async () => {
        addLogFields({ stage: "snapshots" });
        logCommitted("audit.persisted", { persisted: true });
        throw new AppError(409, "FAMILY_DRAFT_STALE", "private name");
      });
    } catch { /* Expected business rejection. */ }
    return new Response();
  });
  const start = logs.find((entry) => entry.event === "db.bulk.islands.started");
  const success = logs.find((entry) => entry.event === "db.bulk.islands.succeeded");
  assert.equal(start?.operationId, success?.operationId);
  assert.equal(start?.familyId, success?.familyId);
  assert.equal(logs.some((entry) => entry.event === "audit.persisted"), false);
  assert.equal(logs.find((entry) => entry.event === "transaction.failed")?.reason, "rollback");
  assert.equal(logs.find((entry) => entry.event === "transaction.failed")?.stage, "snapshots");
  assert.equal(logs.find((entry) => entry.event === "transaction.failed")?.transactionStage, "work");
});

test("controlled fields reject private values, reserved overrides and forged diagnostics", async (t) => {
  const logs = capture(t);
  const adminId = randomUUID();
  const error = Object.assign(new Error("private-name private-contact private-token"), {
    name: "private-name", code: "PRIVATE_CREDENTIAL",
    stack: "Error: private-token\n at private-name (/tmp/private-token.ts:1:2)\n at user (/secret/src/lib/private-token.ts:2:3)\n at fn (/workspace/src/lib/logger.ts:10:20)"
  });
  await traceRequest({ route: "/api/health", method: "GET" }, async () => {
    setLogActor({ actorType: "admin", adminId, authUserId: adminId });
    logger.error("health.failed", error, {
      event: "private-token", actorType: "private-name", adminId: "private-contact", requestId: "private-token",
      password: "private-token", payload: { token: "private-token" }, reason: "PRIVATE_CREDENTIAL",
      providerMessageId: "private-contact", familyId: "private-token", changedFields: ["private-token", "name"]
    } as unknown as LogFields);
    return new Response();
  });
  const serialized = JSON.stringify(logs);
  assert.doesNotMatch(serialized, /private-name|private-contact|private-token|PRIVATE_CREDENTIAL/);
  const diagnostic = logs.find((entry) => entry.event === "health.failed");
  assert.equal(diagnostic?.adminId, adminId);
  assert.deepEqual(diagnostic?.changedFields, ["name"]);
  assert.deepEqual(diagnostic?.errorChain[0].frames, [{ file: "src/lib/logger.ts", line: 10, column: 20 }]);
  assert.ok(logs.every((entry) => Buffer.byteLength(JSON.stringify(entry)) <= 8192));
});

test("debug budget reports suppression without dropping main results", async (t) => {
  const previous = process.env.LOG_LEVEL;
  process.env.LOG_LEVEL = "debug";
  t.after(() => { if (previous === undefined) delete process.env.LOG_LEVEL; else process.env.LOG_LEVEL = previous; });
  const logs = capture(t);
  await traceRequest({ route: "/api/health", method: "GET" }, async () => {
    for (let index = 0; index < 100; index++) logger.debug("security.rate_limit_allowed", { allowed: true });
    logger.info("health.succeeded", { changedFields: Array.from({ length: 50 }, () => "name") });
    logger.error("health.failed", new Error("private"));
    return new Response();
  });
  assert.equal(logs.filter((entry) => entry.level === "debug").length, 64);
  assert.equal(logs.find((entry) => entry.event === "logging.debug_suppressed")?.suppressedCount, 36);
  assert.ok(logs.some((entry) => entry.event === "health.failed"));
  assert.equal(logs.at(-1)?.event, "request.completed");
  assert.equal(logs.find((entry) => entry.event === "health.succeeded")?.truncated, true);
});

test("reveal and provider actors stay scoped and logger failures do not interrupt work", async (t) => {
  const logs = capture(t);
  await traceRequest({ route: "/r", method: "GET" }, async () => {
    await withLogFields({}, async () => { setLogActor({ actorType: "reveal_link", assignmentId: randomUUID() }); logger.info("reveal.opened"); });
    await withLogFields({}, async () => { setLogActor({ actorType: "provider", provider: "resend" }); logger.info("resend.delivery_updated"); });
    return new Response();
  });
  assert.equal(logs.find((entry) => entry.event === "reveal.opened")?.actorType, "reveal_link");
  assert.equal(logs.find((entry) => entry.event === "resend.delivery_updated")?.actorType, "provider");
  assert.equal(logs.at(-1)?.actorType, "unknown");
  t.mock.method(console, "log", () => { throw new Error("broken sink"); });
  assert.equal(await observe("family.create", {}, async () => 42, () => { throw new Error("broken summary"); }), 42);
  assert.doesNotThrow(() => logger.error("health.failed", new Proxy({}, { get() { throw new Error("getter"); } })));
});
