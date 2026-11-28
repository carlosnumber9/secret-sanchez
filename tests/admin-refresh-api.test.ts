import assert from "node:assert/strict";
import test from "node:test";
import type { APIRoute } from "astro";
import { createDeliveriesReadHandler } from "../src/pages/api/admin/editions/[id]/deliveries";
import { createFamilyReadHandler } from "../src/pages/api/admin/family";
import type { getEditionAppState } from "../src/actions/editionData";
import { AppError } from "../src/lib/errors";
import { editionView } from "../src/lib/admin-view-models";

const id = "00000000-0000-4000-8000-000000000001";
const context = (editionId = id) => ({ locals: { admin: { id: "verified-admin" } }, params: { id: editionId } }) as unknown as Parameters<APIRoute>[0];
type State = Awaited<ReturnType<typeof getEditionAppState>>;

test("delivery refresh scopes reads to the verified admin and returns no internal draw or token rows", async () => {
  const handler = createDeliveriesReadHandler(async (...args) => {
    assert.deepEqual(args, ["verified-admin", id, "deliveries"]);
    return { deliveries: [{ id: "assignment", emailStatus: "sent" }], currentDraw: { id, secret: "must-not-leak" }, participants: [{ email: "private" }] } as unknown as State;
  });
  const response = await handler(context()) as Response;
  assert.deepEqual(await response.json(), { ok: true, data: { deliveries: [{ id: "assignment", emailStatus: "sent" }], drawId: id } });
  const empty = createDeliveriesReadHandler(async () => ({ deliveries: [], currentDraw: null }) as unknown as State);
  assert.deepEqual(await (await empty(context()) as Response).json(), { ok: true, data: { deliveries: [], drawId: null } });
});

test("delivery refresh validates IDs and preserves not-found authorization outcomes", async t => {
  t.mock.method(console, "warn", () => undefined);
  const invalid = createDeliveriesReadHandler(async () => { throw new Error("must not read"); });
  assert.equal((await invalid(context("invalid")) as Response).status, 400);
  const denied = createDeliveriesReadHandler(async () => { throw new AppError(404, "EDITION_NOT_FOUND", "No se ha encontrado la edición."); });
  assert.equal((await denied(context()) as Response).status, 404);
});

test("family refresh returns a safe empty initial state using the verified admin", async () => {
  const handler = createFamilyReadHandler(async (...args) => {
    assert.deepEqual(args, ["verified-admin", { editions: false }]);
    return { family: null, group: null, islands: [], participants: [], editions: [], revision: null };
  });
  assert.deepEqual(await (await handler(context()) as Response).json(), { ok: true, data: { familyId: null, revision: null, islands: [] } });
});

test("edition refresh projects revoked history and excludes contact and draw secrets", () => {
  const state = {
    edition: { id, name: "Edición", year: 2026, kind: "test", status: "ready", createdByAdminId: "private" },
    currentDraw: null, islands: [], participants: [], rules: [], exclusions: [],
    attempts: [{ id, status: "revoked", attemptNumber: 1, revokedAt: new Date("2026-11-28T10:00:00Z"), secret: "must-not-leak" }],
    exposure: { notifications: 0, manual: 0, opened: 0 }
  } as unknown as State;
  const view = editionView(state);
  assert.equal(view.currentDraw, null);
  assert.equal(view.edition.status, "ready");
  assert.equal(view.revokedAttempts[0].revokedAt, "2026-11-28T10:00:00.000Z");
  assert.ok(!JSON.stringify(view).includes("must-not-leak"));
  assert.ok(!JSON.stringify(view).includes("createdByAdminId"));
});
