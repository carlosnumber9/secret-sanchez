import assert from "node:assert/strict";
import test, { type TestContext } from "node:test";
import { randomUUID } from "node:crypto";
import { sendEmailNotification } from "../src/services/notifications/sendEmailNotification";
import { sendKapsoMessage } from "../src/lib/kapso";
import { traceRequest } from "../src/lib/logger";

function setup(t: TestContext) {
  const env = { ...process.env };
  Object.assign(process.env, {
    APP_ENV: "test", VERCEL_ENV: "", DATABASE_URL: "postgresql://synthetic@127.0.0.1:55487/synthetic_test",
    PUBLIC_SUPABASE_URL: "https://project.example.invalid", PUBLIC_SUPABASE_ANON_KEY: "synthetic",
    APP_URL: "https://app.example.invalid", REVEAL_TOKEN_ENCRYPTION_KEY: Buffer.alloc(32, 1).toString("base64"),
    RESEND_API_KEY: "synthetic-provider-key", KAPSO_API_KEY: "synthetic-provider-key", KAPSO_PHONE_NUMBER_ID: "synthetic-phone-id",
    KAPSO_TEMPLATE_NAME: "synthetic-template", KAPSO_TEMPLATE_LANGUAGE: "es"
  });
  t.after(() => { for (const key of Object.keys(process.env)) if (!(key in env)) delete process.env[key]; Object.assign(process.env, env); });
  const logs: Array<Record<string, any>> = [];
  for (const method of ["log", "warn", "error"] as const) t.mock.method(console, method, (line: unknown) => logs.push(JSON.parse(String(line))));
  return logs;
}
const email = { to: "private-contact@example.invalid", name: "private-person", revealUrl: "https://app.example.invalid/r#private-token" };
const whatsapp = { phone: "+34000000000", name: "private-person", revealUrl: email.revealUrl };

test("provider acceptance and rejection log IDs and safe status without contacts or bodies", async (t) => {
  const logs = setup(t);
  const messageId = randomUUID();
  let status = 200;
  t.mock.method(globalThis, "fetch", async (input: Parameters<typeof fetch>[0]) => {
    assert.match(String(input), /^https:\/\/(api\.resend\.com|api\.kapso\.ai)\//);
    return Response.json(status === 200 ? String(input).includes("kapso") ? { messages: [{ id: `wamid.${messageId}` }] } : { id: messageId } : { statusCode: status, name: "validation_error", message: "private-person private-contact@example.invalid private-token" }, { status });
  });
  const response = await traceRequest({ route: "/api/admin/editions/[id]/notifications/send", method: "POST" }, async () => {
    assert.equal((await sendEmailNotification(email)).ok, true);
    assert.equal((await sendKapsoMessage(whatsapp)).ok, true);
    status = 422;
    assert.equal((await sendEmailNotification(email)).ok, false);
    assert.equal((await sendKapsoMessage(whatsapp)).ok, false);
    return new Response();
  });
  assert.equal(response.status, 200);
  assert.ok(logs.some((entry) => entry.event === "provider.email.succeeded" && entry.providerMessageId === messageId));
  assert.ok(logs.some((entry) => entry.event === "provider.whatsapp.succeeded" && entry.providerMessageId === `wamid.${messageId}`));
  assert.ok(logs.some((entry) => entry.httpStatus === 422 && entry.result === "rejected"));
  assert.doesNotMatch(JSON.stringify(logs), /private-person|private-contact|private-token|34000000000|synthetic-provider-key|synthetic-phone-id/);
});

test("rate limits and uncertain provider outcomes remain distinguishable", async (t) => {
  const logs = setup(t);
  let status = 429;
  t.mock.method(globalThis, "fetch", async () => Response.json({ statusCode: status, name: "rate_limit_exceeded", message: "private-token" }, { status, headers: { "retry-after": "7" } }));
  const response = await traceRequest({ route: "/api/admin/editions/[id]/notifications/send", method: "POST" }, async () => {
    for (const send of [() => sendEmailNotification(email), () => sendKapsoMessage(whatsapp)]) {
      await assert.rejects(send(), { name: "NotificationRateLimitError", retryAfterSeconds: 7 });
    }
    status = 503;
    await assert.rejects(sendEmailNotification(email));
    await assert.rejects(sendKapsoMessage(whatsapp));
    status = 200;
    await assert.rejects(sendEmailNotification(email));
    await assert.rejects(sendKapsoMessage(whatsapp));
    return new Response();
  });
  assert.equal(response.status, 200);
  assert.ok(logs.some((entry) => entry.httpStatus === 429 && entry.result === "retry"));
  assert.ok(logs.some((entry) => entry.httpStatus === 503 && entry.result === "unknown"));
  assert.ok(logs.some((entry) => entry.reason === "outcome_unknown"));
  assert.doesNotMatch(JSON.stringify(logs), /private-token/);
});
