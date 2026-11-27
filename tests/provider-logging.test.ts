import assert from "node:assert/strict";
import test, { type TestContext } from "node:test";
import { randomUUID } from "node:crypto";
import { sendEmailNotification, type EmailDelivery } from "../src/services/notifications/sendEmailNotification";
import { sendKapsoMessage } from "../src/lib/kapso";
import { createGmailTransport, getGmailDelivery } from "../src/lib/gmail";
import { traceRequest } from "../src/lib/logger";

function setup(t: TestContext) {
  const env = { ...process.env };
  Object.assign(process.env, {
    APP_ENV: "test", VERCEL_ENV: "", DATABASE_URL: "postgresql://synthetic@127.0.0.1:55487/synthetic_test",
    PUBLIC_SUPABASE_URL: "https://project.example.invalid", PUBLIC_SUPABASE_ANON_KEY: "synthetic",
    APP_URL: "https://app.example.invalid", REVEAL_TOKEN_ENCRYPTION_KEY: Buffer.alloc(32, 1).toString("base64"),
    GMAIL_USER: "sender@example.invalid", GMAIL_APP_PASSWORD: "synthetic-app-password",
    KAPSO_API_KEY: "synthetic-provider-key", KAPSO_PHONE_NUMBER_ID: "synthetic-phone-id",
    KAPSO_TEMPLATE_NAME: "synthetic-template", KAPSO_TEMPLATE_LANGUAGE: "es"
  });
  t.after(() => { for (const key of Object.keys(process.env)) if (!(key in env)) delete process.env[key]; Object.assign(process.env, env); });
  const logs: Array<Record<string, any>> = [];
  for (const method of ["log", "warn", "error"] as const) t.mock.method(console, method, (line: unknown) => logs.push(JSON.parse(String(line))));
  return logs;
}
const email = { to: "private-contact@example.invalid", name: "private-person", revealUrl: "https://app.example.invalid/r#private-token" };
const whatsapp = { phone: "+34000000000", name: "private-person", revealUrl: email.revealUrl };
const privateValues = /private-person|private-contact|private-token|34000000000|synthetic-provider-key|synthetic-phone-id|synthetic-app-password|sender@example/;

test("Gmail transport uses TLS, bounded timeouts and no SMTP payload logging", () => {
  const transport = createGmailTransport({ user: "sender@example.invalid", password: "synthetic-app-password" });
  const options = transport.options as Record<string, unknown>;
  assert.equal(options.host, "smtp.gmail.com");
  assert.equal(options.port, 465);
  assert.equal(options.secure, true);
  assert.deepEqual(options.tls, { minVersion: "TLSv1.2" });
  assert.equal(options.logger, false);
  assert.equal(options.debug, false);
  assert.equal(options.pool, false);
  assert.equal(options.disableFileAccess, true);
  assert.equal(options.disableUrlAccess, true);
  assert.equal(options.connectionTimeout, 5_000);
  transport.close();
});

test("Gmail acceptance and rejection retain safe IDs and status without contacts or bodies", async t => {
  const logs = setup(t);
  const whatsappId = `wamid.${randomUUID()}`;
  let status = 200;
  let closed = 0;
  let emailId = "";
  const delivery: EmailDelivery = { sender: "sender@example.invalid", transport: {
    async sendMail(message) {
      assert.deepEqual(message.from, { name: "Secret Sánchez", address: "sender@example.invalid" });
      assert.deepEqual(message.to, { address: email.to });
      assert.deepEqual(message.envelope, { from: "sender@example.invalid", to: [email.to] });
      assert.ok(message.signal instanceof AbortSignal);
      assert.match(String(message.html), /Secret Sánchez/);
      assert.match(String(message.html), /private-token/);
      emailId = String(message.messageId);
      if (status !== 200) throw Object.assign(new Error("private-person private-contact@example.invalid private-token synthetic-app-password"), { responseCode: 550, command: "RCPT TO", code: "EENVELOPE" });
      return { accepted: [email.to], rejected: [], messageId: emailId };
    }, close() { closed++; }
  } };
  t.mock.method(globalThis, "fetch", async (input: Parameters<typeof fetch>[0]) => {
    assert.match(String(input), /^https:\/\/api\.kapso\.ai\//);
    return Response.json(status === 200 ? { messages: [{ id: whatsappId }] } : { statusCode: status, name: "validation_error", message: "private-token" }, { status });
  });
  await traceRequest({ route: "/api/admin/editions/[id]/notifications/send", method: "POST" }, async () => {
    const accepted = await sendEmailNotification(email, delivery);
    assert.equal(accepted.ok, true);
    assert.equal(accepted.providerMessageId, emailId);
    assert.equal((await sendKapsoMessage(whatsapp)).ok, true);
    status = 422;
    assert.equal((await sendEmailNotification(email, delivery)).ok, false);
    assert.equal((await sendKapsoMessage(whatsapp)).ok, false);
    return new Response();
  });
  assert.equal(closed, 2);
  assert.ok(logs.some(entry => entry.event === "provider.email.succeeded" && entry.provider === "gmail" && /^<[0-9a-f-]{36}@gmail.com>$/.test(entry.providerMessageId)));
  assert.ok(logs.some(entry => entry.event === "provider.whatsapp.succeeded" && entry.providerMessageId === whatsappId));
  assert.ok(logs.some(entry => entry.smtpStatus === 550 && entry.smtpCommand === "RCPT TO" && entry.result === "rejected"));
  assert.ok(logs.some(entry => entry.httpStatus === 422 && entry.result === "rejected"));
  assert.doesNotMatch(JSON.stringify(logs), privateValues);
});

test("Gmail temporary refusals, authentication failures and uncertain outcomes are distinguished", async t => {
  const logs = setup(t);
  let failure: unknown = Object.assign(new Error("private-token"), { responseCode: 421, command: "DATA" });
  const delivery: EmailDelivery = { sender: "sender@example.invalid", transport: {
    async sendMail() { throw failure; }, close() {}
  } };
  await assert.rejects(sendEmailNotification(email, delivery), { name: "NotificationRateLimitError", retryAfterSeconds: 60 });
  failure = Object.assign(new Error("private-contact@example.invalid synthetic-app-password"), { responseCode: 535, command: "AUTH PLAIN" });
  assert.equal((await sendEmailNotification(email, delivery)).ok, false);
  for (const code of ["ETIMEDOUT", "ECONNRESET", "ECONNECTION", "ESOCKET"]) {
    failure = Object.assign(new Error("private-token"), { code, command: "DATA" });
    await assert.rejects(sendEmailNotification(email, delivery), /outcome unknown/);
  }
  assert.ok(logs.some(entry => entry.smtpStatus === 421 && entry.result === "retry"));
  assert.ok(logs.some(entry => entry.smtpStatus === 535 && entry.reason === "invalid_credentials"));
  assert.ok(logs.some(entry => entry.smtpStatus === 535 && entry.smtpCommand === "AUTH"));
  assert.ok(logs.some(entry => entry.reason === "outcome_unknown" && entry.result === "unknown"));
  assert.doesNotMatch(JSON.stringify(logs), privateValues);
});

test("missing Gmail credentials do not fall back to Resend", async t => {
  const logs = setup(t);
  process.env.RESEND_API_KEY = "synthetic-unused-key";
  delete process.env.GMAIL_APP_PASSWORD;
  t.mock.method(globalThis, "fetch", async () => { throw new Error("Unexpected network call"); });
  assert.equal(getGmailDelivery(), null);
  assert.equal((await sendEmailNotification(email)).ok, false);
  assert.ok(logs.some(entry => entry.provider === "gmail" && entry.reason === "configuration_missing"));
  assert.doesNotMatch(JSON.stringify(logs), privateValues);
});

test("Gmail reports an explicitly refused recipient as failed", async t => {
  setup(t);
  let closed = false;
  const delivery: EmailDelivery = { sender: "sender@example.invalid", transport: {
    async sendMail() { return { accepted: [], rejected: [email.to], messageId: "synthetic" }; },
    close() { closed = true; }
  } };
  assert.equal((await sendEmailNotification(email, delivery)).ok, false);
  assert.equal(closed, true);
});

test("WhatsApp retains HTTP cooldown and uncertain-outcome handling", async t => {
  const logs = setup(t);
  let status = 429;
  t.mock.method(globalThis, "fetch", async () => Response.json({ statusCode: status, message: "private-token" }, { status, headers: { "retry-after": "7" } }));
  await assert.rejects(sendKapsoMessage(whatsapp), { name: "NotificationRateLimitError", retryAfterSeconds: 7 });
  status = 503;
  await assert.rejects(sendKapsoMessage(whatsapp));
  status = 200;
  await assert.rejects(sendKapsoMessage(whatsapp));
  assert.ok(logs.some(entry => entry.httpStatus === 429 && entry.result === "retry"));
  assert.ok(logs.some(entry => entry.httpStatus === 503 && entry.result === "unknown"));
  assert.doesNotMatch(JSON.stringify(logs), privateValues);
});

test("unrecognized SMTP commands are omitted before creating typed log diagnostics", async t => {
  const logs = setup(t);
  const delivery: EmailDelivery = { sender: "sender@example.invalid", transport: {
    async sendMail() { throw Object.assign(new Error("private-token"), { responseCode: 550, command: "RCPT TO private-contact@example.invalid" }); },
    close() {}
  } };
  assert.equal((await sendEmailNotification(email, delivery)).ok, false);
  const rejection = logs.find(entry => entry.event === "provider.result" && entry.result === "rejected");
  assert.equal(rejection?.smtpStatus, 550);
  assert.equal(rejection?.smtpCommand, undefined);
  assert.doesNotMatch(JSON.stringify(logs), privateValues);
});
