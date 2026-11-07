import { isolatedTestDatabase } from "../../scripts/test-database";
import assert from "node:assert/strict";
import test, { after } from "node:test";
import { eq, sql } from "drizzle-orm";
import { db } from "../../src/db/client";
import * as s from "../../src/db/schema";
import { createOwnedEdition, generateEditionDraw, updateOwnedEdition, revokeEditionDraw } from "../../src/actions/editionData";
import { getAdminAppState, saveOwnedFamilyDraft, deleteOwnedParticipant } from "../../src/actions/adminData";
import { sendAdminNotifications } from "../../src/actions/notifications";
import { claimNotificationAttempt, applyWhatsappEvent, updateNotificationLog } from "../../src/db/queries/notifications";
import { getAssignmentByTokenHash } from "../../src/db/queries/assignments";
import { decryptRevealToken } from "../../src/lib/tokens";
import { POST as resolve } from "../../src/pages/api/reveal/resolve";
import { POST as open } from "../../src/pages/api/reveal/open";
import type { APIRoute } from "astro";

if (process.env.DATABASE_URL !== isolatedTestDatabase(process.env.TEST_DATABASE_URL)) throw new Error("DATABASE_URL debe coincidir con TEST_DATABASE_URL.");

after(async () => { await db.$client.end(); });

async function fixture(work: (data: Awaited<ReturnType<typeof seed>>) => Promise<void>) {
  const data = await seed();
  try { await work(data); }
  finally {
    await db.delete(s.families).where(eq(s.families.id, data.family.id));
    await db.delete(s.adminUsers).where(eq(s.adminUsers.id, data.admin.id));
  }
}

async function seed() {
  const [admin] = await db.insert(s.adminUsers).values({ email: `${crypto.randomUUID()}@example.invalid`, name: "Integration" }).returning();
  const [family] = await db.insert(s.families).values({ name: "Integration", slug: crypto.randomUUID(), ownerAdminId: admin.id }).returning();
  const islands = await db.insert(s.familyIslands).values([1, 2, 3].map((i) => ({ familyId: family.id, name: `Unit ${i}` }))).returning();
  const people = await db.insert(s.participants).values(islands.map((island, i) => ({ familyId: family.id, familyIslandId: island.id, name: `Person ${i}`, email: `person${i}@example.invalid`, preferredChannel: "email" as const }))).returning();
  const edition = await createOwnedEdition(admin.id, { familyId: family.id, name: "Test", year: 2090, kind: "test" });
  return { admin, family, islands, people, edition };
}

const generation = (data: Awaited<ReturnType<typeof seed>>) => generateEditionDraw({ editionId: data.edition.id, generatedByAdminId: data.admin.id });

function requestContext(token: string) {
  return { request: new Request("https://app.example.invalid/api/reveal", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token }) }) } as Parameters<APIRoute>[0];
}

test("concurrent generation produces exactly one current draw and locks editing", async () => fixture(async (data) => {
  const attempts = await Promise.allSettled([generation(data), generation(data)]);
  assert.equal(attempts.filter((result) => result.status === "fulfilled").length, 1);
  const rows = await db.select().from(s.draws).where(eq(s.draws.editionId, data.edition.id));
  assert.equal(rows.length, 1);
  await assert.rejects(updateOwnedEdition(data.admin.id, data.edition.id, { name: "Changed" }), { code: "EDITION_LOCKED" });
  await assert.rejects(updateOwnedEdition(crypto.randomUUID(), data.edition.id, { name: "Foreign" }), { code: "EDITION_NOT_FOUND" });
}));

test("notification reservation and concurrent status events preserve invariants", async () => fixture(async (data) => {
  const { draw } = await generation(data);
  const [assignment] = await db.select().from(s.assignments).where(eq(s.assignments.drawId, draw.id));
  const input = { assignmentId: assignment.id, channel: "whatsapp" as const, recipient: "+34000000000", mode: "pending" as const, idempotencyKey: crypto.randomUUID() };
  const results = await Promise.all([claimNotificationAttempt(input), claimNotificationAttempt({ ...input, idempotencyKey: crypto.randomUUID() })]);
  assert.equal(results.filter(Boolean).length, 1);
  const log = results.find(Boolean)!;
  await updateNotificationLog(log.id, { status: "sent", providerMessageId: `synthetic-${log.id}` });
  await Promise.all([applyWhatsappEvent(`synthetic-${log.id}`, "read"), applyWhatsappEvent(`synthetic-${log.id}`, "sent")]);
  const [current] = await db.select().from(s.notificationLogs).where(eq(s.notificationLogs.id, log.id));
  assert.equal(current.status, "read");
}));

test("a revocation during the final delivery cannot reactivate tokens", async () => fixture(async (data) => {
  const { draw } = await generation(data);
  let delivered = 0;
  const result = await sendAdminNotifications({ admin: data.admin, editionId: data.edition.id, mode: "pending", scope: "all", idempotencyKey: crypto.randomUUID() }, {
    email: async () => {
      delivered++;
      if (delivered === data.people.length) await revokeEditionDraw({ adminId: data.admin.id, editionId: data.edition.id, drawId: draw.id, confirmation: "ANULAR REPARTO" });
      return { ok: true, providerMessageId: crypto.randomUUID() };
    },
    whatsapp: async () => { throw new Error("Unexpected WhatsApp call"); }
  });
  assert.equal(result.allCovered, false);
  const [current] = await db.select().from(s.draws).where(eq(s.draws.id, draw.id));
  assert.equal(current.status, "revoked");
  const [assignment] = await db.select().from(s.assignments).where(eq(s.assignments.drawId, draw.id));
  assert.equal(await getAssignmentByTokenHash(assignment.revealTokenHash), null);
}));

test("stale drafts are rejected and invalid drafts roll back all changes", async () => fixture(async (data) => {
  const state = await getAdminAppState(data.admin.id);
  const draft = {
    revision: state.revision!, confirmedParticipantDeletionIds: [], confirmedIslandDeletionIds: [],
    islands: state.islands.map((i) => ({ clientId: i.id, id: i.id, name: i.name, color: i.color ?? "#d6a84f" })),
    participants: state.participants.map((p) => ({ clientId: p.id, id: p.id, familyIslandClientId: p.familyIslandId, name: p.name, email: p.email ?? "", phone: p.phone ?? "", preferredChannel: p.preferredChannel === "manual" ? null : p.preferredChannel, isBaby: p.isBaby, sortOrder: p.sortOrder }))
  };
  const updated = await saveOwnedFamilyDraft(data.admin.id, data.family.id, draft);
  await assert.rejects(saveOwnedFamilyDraft(data.admin.id, data.family.id, draft), { code: "FAMILY_DRAFT_STALE" });
  const invalid = { ...draft, revision: updated.revision, islands: draft.islands.map((i) => ({ ...i, name: "Must roll back" })), participants: draft.participants.map((p) => ({ ...p, familyIslandClientId: "missing" })) };
  await assert.rejects(saveOwnedFamilyDraft(data.admin.id, data.family.id, invalid), { code: "ISLAND_MISMATCH" });
  const [island] = await db.select().from(s.familyIslands).where(eq(s.familyIslands.id, data.islands[0].id));
  assert.notEqual(island.name, "Must roll back");
}));

test("public reveal preserves secrecy before opening and rejects revoked links", async () => fixture(async (data) => {
  const { draw } = await generation(data);
  const [assignment] = await db.select().from(s.assignments).where(eq(s.assignments.drawId, draw.id));
  const token = decryptRevealToken(assignment.revealTokenCiphertext!);
  const preparation = await resolve(requestContext(token)) as Response;
  assert.equal(preparation.status, 200);
  assert.equal((await preparation.json()).data.receiverName, undefined);
  const response = await open(requestContext(token)) as Response;
  assert.equal(response.status, 200);
  assert.equal(typeof (await response.json()).data.receiverName, "string");
  const [opened] = await db.select().from(s.assignments).where(eq(s.assignments.id, assignment.id));
  assert.ok(opened.openedAt);
  await revokeEditionDraw({ adminId: data.admin.id, editionId: data.edition.id, drawId: draw.id, confirmation: "ANULAR REPARTO" });
  assert.equal((await open(requestContext(token)) as Response).status, 404);
}));

test("participant deletion removes impacted attempts atomically", async () => fixture(async (data) => {
  await generation(data);
  await deleteOwnedParticipant(data.admin.id, data.people[0].id, "ELIMINAR PERSONA");
  const attempts = await db.select().from(s.draws).where(eq(s.draws.editionId, data.edition.id));
  assert.equal(attempts.length, 0);
  const [edition] = await db.select().from(s.drawEditions).where(eq(s.drawEditions.id, data.edition.id));
  assert.equal(edition.status, "ready");
}));

test("public roles cannot read protected application tables", async () => {
  for (const role of ["anon", "authenticated"]) {
    await assert.rejects(db.transaction(async (tx) => {
      await tx.execute(sql.raw(`set local role ${role}`));
      await tx.select().from(s.assignments).limit(1);
    }), (error: unknown) => Boolean(error && typeof error === "object" && "cause" in error && (error.cause as { code?: string })?.code === "42501"));
  }
});

test("family batches preserve unchanged rows and synchronize baby roles", async () => fixture(async (data) => {
  const state = await getAdminAppState(data.admin.id);
  const draft = {
    revision: state.revision!, confirmedParticipantDeletionIds: [], confirmedIslandDeletionIds: [],
    islands: state.islands.map((i) => ({ clientId: i.id, id: i.id, name: i.name, color: i.color ?? "#d6a84f" })),
    participants: state.participants.map((p) => ({ clientId: p.id, id: p.id as string | null, familyIslandClientId: p.familyIslandId, name: p.name, email: p.email ?? "", phone: p.phone ?? "", preferredChannel: p.preferredChannel === "manual" ? null : p.preferredChannel, isBaby: p.isBaby, sortOrder: p.sortOrder }))
  };
  const saved = await saveOwnedFamilyDraft(data.admin.id, data.family.id, draft);
  await saveOwnedFamilyDraft(data.admin.id, data.family.id, { ...draft, revision: saved.revision });
  const unchanged = await db.select().from(s.participants).where(eq(s.participants.familyId, data.family.id));
  for (const person of unchanged) assert.equal(person.updatedAt.getTime(), data.people.find((p) => p.id === person.id)!.updatedAt.getTime());
  const changed = { ...draft, revision: saved.revision, participants: draft.participants.map((p, index) => index === 0 ? { ...p, isBaby: true, email: "", preferredChannel: null } : p) };
  changed.participants.push({ ...changed.participants[0], clientId: "new-baby", id: null, name: "New baby", sortOrder: 1 });
  const result = await saveOwnedFamilyDraft(data.admin.id, data.family.id, changed);
  const baby = result.islands.flatMap((i) => i.participants).find((p) => p.name === "New baby")!;
  assert.ok(baby.id);
  const configs = await db.select().from(s.editionParticipants).where(eq(s.editionParticipants.editionId, data.edition.id));
  const newConfig = configs.find((c) => c.participantId === baby.id)!;
  assert.equal(newConfig.enabled, false);
  assert.equal(newConfig.canGive, false);
  const changedConfig = configs.find((c) => c.participantId === changed.participants[0].id)!;
  assert.equal(changedConfig.isBaby, true);
  assert.equal(changedConfig.preferredChannel, null);
}));

test("delivery summaries use the latest attempt rather than any historical success", async () => fixture(async (data) => {
  const { draw } = await generation(data);
  const assignments = await db.select().from(s.assignments).where(eq(s.assignments.drawId, draw.id));
  await db.insert(s.notificationLogs).values(assignments.map((a) => ({ assignmentId: a.id, channel: "email" as const, recipient: "test@example.invalid", status: "sent" as const, createdAt: new Date(0) })));
  await db.insert(s.notificationLogs).values({ assignmentId: assignments[0].id, channel: "email", recipient: "test@example.invalid", status: "failed" });
  const { getEditionAppState } = await import("../../src/actions/editionData");
  const state = await getEditionAppState(data.admin.id, data.edition.id, "deliveries");
  assert.equal(state.deliveries.find((d) => d.id === assignments[0].id)!.emailStatus, "failed");
  assert.deepEqual(state.participants, []);
  const result = await sendAdminNotifications({ admin: data.admin, editionId: data.edition.id, mode: "pending", scope: "all", idempotencyKey: crypto.randomUUID() }, {
    email: async () => { throw new Error("Unexpected send"); }, whatsapp: async () => { throw new Error("Unexpected send"); }
  });
  assert.equal(result.sent, 0);
  assert.equal(result.allCovered, false);
  const configuration = await getEditionAppState(data.admin.id, data.edition.id);
  assert.equal(configuration.exposure.notifications, assignments.length + 1);
}));
