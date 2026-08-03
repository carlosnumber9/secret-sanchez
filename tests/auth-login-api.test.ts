import assert from "node:assert/strict";
import test from "node:test";
import type { APIRoute } from "astro";
import { createPasswordLoginHandler } from "../src/pages/api/auth/login";

type ApiContext = Parameters<APIRoute>[0];

function createContext(body: unknown) {
  return {
    cookies: { marker: "cookies" },
    request: new Request("https://secret.example/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    })
  } as unknown as ApiContext;
}

test("password login rejects malformed input before calling Supabase", async (t) => {
  t.mock.method(console, "warn", () => undefined);
  let called = false;
  const handler = createPasswordLoginHandler(async () => {
    called = true;
    return { data: { session: null }, error: null };
  });

  const response = (await handler(createContext({ email: "invalid", password: "" }))) as Response;
  assert.equal(response.status, 400);
  assert.equal(called, false);
});

test("password login maps provider rejection to a generic 401", async (t) => {
  t.mock.method(console, "warn", () => undefined);
  const handler = createPasswordLoginHandler(async () => ({
    data: { session: null },
    error: { status: 400 }
  }));

  const response = (await handler(
    createContext({ email: "juan@example.com", password: "incorrect" })
  )) as Response;
  const payload = (await response.json()) as { message: string };

  assert.equal(response.status, 401);
  assert.equal(payload.message, "El email o la contraseña no son correctos.");
  assert.equal(payload.message.includes("juan@example.com"), false);
});

test("password login preserves provider rate limiting", async (t) => {
  t.mock.method(console, "warn", () => undefined);
  const handler = createPasswordLoginHandler(async () => ({
    data: { session: null },
    error: { status: 429 }
  }));

  const response = (await handler(
    createContext({ email: "juan@example.com", password: "attempt" })
  )) as Response;
  assert.equal(response.status, 429);
});

test("password login passes the SSR cookie context and returns success", async (t) => {
  t.mock.method(console, "log", () => undefined);
  const context = createContext({ email: "juan@example.com", password: "correct" });
  let receivedCookies: unknown;
  let receivedCredentials: string[] = [];
  const handler = createPasswordLoginHandler(async (loginContext, email, password) => {
    receivedCookies = loginContext.cookies;
    receivedCredentials = [email, password];
    return { data: { session: { access_token: "not-logged" } }, error: null };
  });

  const response = (await handler(context)) as Response;
  assert.equal(response.status, 200);
  assert.equal(receivedCookies, context.cookies);
  assert.deepEqual(receivedCredentials, ["juan@example.com", "correct"]);
});
