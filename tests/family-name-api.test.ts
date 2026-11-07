import assert from "node:assert/strict";
import test from "node:test";
import type { APIRoute } from "astro";
import { createFamilyNameHandler } from "../src/pages/api/admin/families/[id]/name";
import { AppError } from "../src/lib/errors";

const familyId = "00000000-0000-4000-8000-000000000001";
const entityId = "00000000-0000-4000-8000-000000000002";
const input = { revision: "a".repeat(64), kind: "participant", id: entityId, name: "Nombre de prueba" };

function context(body: unknown, id = familyId) {
  return {
    locals: { admin: { id: "admin" } }, params: { id },
    request: new Request(`https://app.example.invalid/api/admin/families/${id}/name`, {
      method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body)
    })
  } as unknown as Parameters<APIRoute>[0];
}

test("family name API rejects invalid or unrelated fields before writing", async (t) => {
  t.mock.method(console, "warn", () => undefined);
  const handler = createFamilyNameHandler(async () => { throw new Error("Must not write"); });
  for (const changes of [
    { name: "   " }, { name: "x".repeat(181) }, { revision: "invalid" },
    { id: "invalid" }, { kind: "family" }, { email: "other@example.invalid" }
  ]) {
    const response = await handler(context({ ...input, ...changes })) as Response;
    assert.equal(response.status, 400);
  }
  assert.equal((await handler(context(input, "invalid")) as Response).status, 400);
});

test("family name API passes ownership, revision and trimmed names for both entity kinds", async (t) => {
  t.mock.method(console, "log", () => undefined);
  for (const kind of ["participant", "island"] as const) {
    let received: unknown;
    const result = { name: "Nuevo nombre", revision: "b".repeat(64) };
    const handler = createFamilyNameHandler(async (...args) => { received = args; return result; });
    const response = await handler(context({ ...input, kind, name: "  Nuevo nombre  " })) as Response;
    assert.equal(response.status, 200);
    assert.deepEqual(received, ["admin", familyId, { ...input, kind, name: "Nuevo nombre" }]);
    assert.deepEqual(await response.json(), { ok: true, data: result });
  }
});

test("family name API preserves stale revision and ownership errors", async (t) => {
  t.mock.method(console, "warn", () => undefined);
  for (const [status, code] of [[409, "FAMILY_DRAFT_STALE"], [404, "FAMILY_NOT_FOUND"]] as const) {
    const handler = createFamilyNameHandler(async () => { throw new AppError(status, code, "No se pudo guardar."); });
    const response = await handler(context(input)) as Response;
    assert.equal(response.status, status);
    assert.equal((await response.json()).code, code);
  }
});
