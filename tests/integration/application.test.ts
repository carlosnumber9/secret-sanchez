import { isolatedTestDatabase } from "../../scripts/test-database";
import assert from "node:assert/strict";
import test, { after } from "node:test";
import { eq, sql } from "drizzle-orm";
import { db } from "../../src/db/client";
import * as s from "../../src/db/schema";
import { createOwnedEdition, generateEditionDraw, updateOwnedEdition, revokeEditionDraw, getEditionAppState, listOwnedEditions, updateEditionParticipant } from "../../src/actions/editionData";
import { createOwnedGroup, getAdminAppState, saveOwnedFamilyDraft, deleteOwnedParticipant, updateOwnedParticipant, updateOwnedIsland } from "../../src/actions/adminData";
import { renameOwnedFamilyMember } from "../../src/actions/familyNames";
import { sendAdminNotifications } from "../../src/actions/notifications";
import { claimNotificationAttempt, applyWhatsappEvent, updateNotificationLog } from "../../src/db/queries/notifications";
import { getOwnedAssignment, getRevealPreparation } from "../../src/db/queries/assignments";
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

test("registered administrators share the census, editions, mutations and delivery access", async () => fixture(async (data) => {
  const [other] = await db.insert(s.adminUsers).values({ email: `${crypto.randomUUID()}@example.invalid`, name: "Second administrator" }).returning();
  try {
    assert.deepEqual(await getAdminAppState(other.id), await getAdminAppState(data.admin.id));
    assert.equal((await listOwnedEditions(other.id))[0].edition.id, data.edition.id);
    assert.equal((await getEditionAppState(other.id, data.edition.id)).family.id, data.family.id);
    await assert.rejects(createOwnedGroup(other.id, { name: "Duplicate" }), { code: "FAMILY_ALREADY_EXISTS" });
    await updateOwnedParticipant(other.id, data.people[0].id, { email: "shared@example.invalid" });
    await updateOwnedIsland(other.id, data.islands[0].id, { name: "Shared household" });
    const beforeRename = await getAdminAppState(data.admin.id);
    await renameOwnedFamilyMember(other.id, data.family.id, { revision: beforeRename.revision!, kind: "participant", id: data.people[0].id, name: "Shared person" });
    const shared = await getAdminAppState(data.admin.id);
    assert.equal(shared.participants.find(p => p.id === data.people[0].id)?.email, "shared@example.invalid");
    assert.equal(shared.participants.find(p => p.id === data.people[0].id)?.name, "Shared person");
    assert.equal(shared.islands.find(i => i.id === data.islands[0].id)?.name, "Shared household");
    await updateOwnedEdition(other.id, data.edition.id, { name: "Shared edition" });
    await updateEditionParticipant(other.id, data.edition.id, data.people[0].id, { enabled: true, canGive: true, canReceive: true, preferredChannel: "email" });
    const { draw } = await generateEditionDraw({ editionId: data.edition.id, generatedByAdminId: other.id });
    assert.equal(draw.generatedByAdminId, other.id);
    assert.equal((await getEditionAppState(data.admin.id, data.edition.id, "deliveries")).deliveries.length, data.people.length);
    const [assignment] = await db.select().from(s.assignments).where(eq(s.assignments.drawId, draw.id));
    assert.ok(await getOwnedAssignment(assignment.id, data.admin.id));
    assert.ok(await getOwnedAssignment(assignment.id, other.id));
    assert.equal(await getOwnedAssignment(assignment.id, crypto.randomUUID()), null);
    const sent = await sendAdminNotifications({ admin: other, editionId: data.edition.id, mode: "pending", scope: "all", idempotencyKey: crypto.randomUUID() }, {
      email: async () => ({ ok: true, providerMessageId: crypto.randomUUID() }),
      whatsapp: async () => { throw new Error("Unexpected WhatsApp call"); }
    });
    assert.equal(sent.sent, data.people.length);
    await revokeEditionDraw({ adminId: data.admin.id, editionId: data.edition.id, drawId: draw.id, confirmation: "ANULAR REPARTO" });
    await deleteOwnedParticipant(other.id, data.people[0].id, "ELIMINAR PERSONA");
    assert.equal((await getAdminAppState(data.admin.id)).participants.length, data.people.length - 1);
  } finally {
    // Historical actor references must be removed before deleting this account.
    await db.delete(s.families).where(eq(s.families.id, data.family.id));
    await db.delete(s.adminUsers).where(eq(s.adminUsers.id, other.id));
  }
}));

test("unregistered identities cannot read or mutate shared data", async () => fixture(async (data) => {
  const unknown = crypto.randomUUID();
  assert.equal((await getAdminAppState(unknown)).family, null);
  assert.deepEqual(await listOwnedEditions(unknown), []);
  await assert.rejects(getEditionAppState(unknown, data.edition.id), { code: "EDITION_NOT_FOUND" });
  await assert.rejects(createOwnedGroup(unknown, { name: "Forbidden" }), { code: "ADMIN_FORBIDDEN" });
  await assert.rejects(createOwnedEdition(unknown, { familyId: data.family.id, name: "Forbidden", year: 2091, kind: "test" }), { code: "FAMILY_NOT_FOUND" });
  await assert.rejects(sendAdminNotifications({ admin: { id: unknown, email: "unknown@example.invalid" }, editionId: data.edition.id, mode: "pending", scope: "all", idempotencyKey: crypto.randomUUID() }), { code: "DRAW_NOT_FOUND" });
}));

test("concurrent first-time setup creates only one shared family", async () => {
  const admins = await db.insert(s.adminUsers).values([1, 2].map(i => ({ email: `${crypto.randomUUID()}@example.invalid`, name: `Setup ${i}` }))).returning();
  try {
    const results = await Promise.allSettled(admins.map(a => createOwnedGroup(a.id, { name: "Shared family" })));
    assert.equal(results.filter(r => r.status === "fulfilled").length, 1);
    const failure = results.find(r => r.status === "rejected") as PromiseRejectedResult;
    assert.equal(failure.reason.code, "FAMILY_ALREADY_EXISTS");
    assert.equal((await db.select().from(s.families)).length, 1);
    assert.deepEqual(await getAdminAppState(admins[0].id), await getAdminAppState(admins[1].id));
  } finally {
    await db.delete(s.families);
    for (const a of admins) await db.delete(s.adminUsers).where(eq(s.adminUsers.id, a.id));
  }
});

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
  assert.equal(await getRevealPreparation(assignment.revealTokenHash), null);
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

test("individual renames preserve other fields and serialize with family drafts", async () => fixture(async (data) => {
  const state = await getAdminAppState(data.admin.id);
  const person = state.participants[0];
  const renamed = await renameOwnedFamilyMember(data.admin.id, data.family.id, {
    revision: state.revision!, kind: "participant", id: person.id, name: "Renamed person"
  });
  const afterPerson = await getAdminAppState(data.admin.id);
  assert.equal(renamed.revision, afterPerson.revision);
  const saved = afterPerson.participants.find(({ id }) => id === person.id)!;
  assert.deepEqual({ ...saved, name: person.name, updatedAt: person.updatedAt }, person);
  assert.equal(saved.name, "Renamed person");
  await assert.rejects(renameOwnedFamilyMember(data.admin.id, data.family.id, {
    revision: state.revision!, kind: "participant", id: person.id, name: "Stale name"
  }), { code: "FAMILY_DRAFT_STALE" });
  await assert.rejects(renameOwnedFamilyMember(crypto.randomUUID(), data.family.id, {
    revision: renamed.revision, kind: "participant", id: person.id, name: "Foreign name"
  }), { code: "FAMILY_NOT_FOUND" });
  await assert.rejects(renameOwnedFamilyMember(data.admin.id, data.family.id, {
    revision: renamed.revision, kind: "island", id: crypto.randomUUID(), name: "Missing unit"
  }), { code: "ISLAND_NOT_FOUND" });
  const renamedIsland = await renameOwnedFamilyMember(data.admin.id, data.family.id, {
    revision: renamed.revision, kind: "island", id: data.islands[0].id, name: "Renamed unit"
  });
  const current = await getAdminAppState(data.admin.id);
  assert.equal(current.revision, renamedIsland.revision);
  assert.equal(current.islands.find(({ id }) => id === data.islands[0].id)!.name, "Renamed unit");
  const draft = {
    revision: renamedIsland.revision, confirmedParticipantDeletionIds: [], confirmedIslandDeletionIds: [],
    islands: current.islands.map((i) => ({ clientId: i.id, id: i.id, name: i.name, color: i.color ?? "#d6a84f" })),
    participants: current.participants.map((p) => ({ clientId: p.id, id: p.id, familyIslandClientId: p.familyIslandId, name: p.name, email: p.email ?? "", phone: p.phone ?? "", preferredChannel: p.preferredChannel === "manual" ? null : p.preferredChannel, isBaby: p.isBaby, sortOrder: p.sortOrder }))
  };
  const savedDraft = await saveOwnedFamilyDraft(data.admin.id, data.family.id, draft);
  const finalState = await getAdminAppState(data.admin.id);
  assert.equal(savedDraft.revision, finalState.revision);
  assert.equal(finalState.participants.find(({ id }) => id === person.id)!.name, "Renamed person");
  assert.equal(finalState.islands.find(({ id }) => id === data.islands[0].id)!.name, "Renamed unit");
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

test("deletion impact counts attempts once across editions and notification histories", async () => fixture(async (data) => {
  const first = await generation(data);
  await revokeEditionDraw({ adminId: data.admin.id, editionId: data.edition.id, drawId: first.draw.id, confirmation: "ANULAR REPARTO" });
  await generation(data);
  const other = await createOwnedEdition(data.admin.id, { familyId: data.family.id, name: "Other test", year: 2090, kind: "test" });
  await generateEditionDraw({ editionId: other.id, generatedByAdminId: data.admin.id });
  const attempts = await db.select({ id: s.draws.id }).from(s.draws).innerJoin(s.drawEditions, eq(s.draws.editionId, s.drawEditions.id)).where(eq(s.drawEditions.familyId, data.family.id));
  const allAssignments = (await Promise.all(attempts.map((d) => db.select().from(s.assignments).where(eq(s.assignments.drawId, d.id))))).flat();
  await db.insert(s.notificationLogs).values(allAssignments.flatMap((a) => [1, 2].map(() => ({ assignmentId: a.id, channel: "email" as const, recipient: "test@example.invalid", status: "sent" as const }))));
  await db.update(s.assignments).set({ openedAt: new Date() }).where(eq(s.assignments.id, allAssignments[0].id));
  const { getDeletionImpact } = await import("../../src/db/queries/deletionImpact");
  assert.deepEqual(await getDeletionImpact(data.people.slice(0, 2).map((p) => p.id)), { editions: 2, draws: 3, assignments: 9, notifications: 18, opened: 1 });
}));

test("delivery cursors are bounded and cannot resume a replaced draw", async () => fixture(async (data) => {
  const { draw } = await generation(data);
  const snapshots = await db.select().from(s.drawParticipants).where(eq(s.drawParticipants.drawId, draw.id));
  await db.update(s.drawParticipants).set({ preferredChannel: "both", phone: "+34000000000" }).where(eq(s.drawParticipants.drawId, draw.id));
  process.env.KAPSO_TEST_RECIPIENT_PHONE = "+34000000000";
  let calls = 0;
  const transports = { email: async () => ({ ok: true, providerMessageId: `email-${++calls}` }), whatsapp: async () => ({ ok: true as const, providerMessageId: `whatsapp-${++calls}` }) };
  const input = { admin: data.admin, editionId: data.edition.id, scope: "all" as const, mode: "pending" as const, idempotencyKey: crypto.randomUUID() };
  const first = await sendAdminNotifications(input, transports);
  assert.equal(calls, 4);
  assert.equal(first.nextCursor, 4);
  const second = await sendAdminNotifications({ ...input, cursor: first.nextCursor!, drawId: first.drawId }, transports);
  assert.equal(calls, snapshots.length * 2);
  assert.equal(second.nextCursor, null);
  await revokeEditionDraw({ adminId: data.admin.id, editionId: data.edition.id, drawId: draw.id, confirmation: "ANULAR REPARTO" });
  await generation(data);
  await assert.rejects(sendAdminNotifications({ ...input, drawId: draw.id, cursor: 4 }, transports), { code: "DRAW_CHANGED" });
  delete process.env.KAPSO_TEST_RECIPIENT_PHONE;
}));

test("provider rate limits preserve the cursor and resume the same attempts", async () => fixture(async (data) => {
  const { draw } = await generation(data);
  const { NotificationRateLimitError } = await import("../../src/services/notifications/retry");
  let limited = true;
  const transports = {
    email: async () => { if (limited) throw new NotificationRateLimitError("1"); return { ok: true, providerMessageId: crypto.randomUUID() }; },
    whatsapp: async () => { throw new Error("Unexpected send"); }
  };
  const input = { admin: data.admin, editionId: data.edition.id, scope: "all" as const, mode: "pending" as const, idempotencyKey: crypto.randomUUID() };
  const first = await sendAdminNotifications(input, transports);
  assert.equal(first.nextCursor, 0);
  assert.equal(first.retryAfterSeconds, 1);
  await db.update(s.notificationLogs).set({ error: `rate_limited:${Date.now() - 1}` }).where(eq(s.notificationLogs.status, "pending"));
  limited = false;
  const resumed = await sendAdminNotifications({ ...input, cursor: 0, drawId: draw.id }, transports);
  assert.equal(resumed.sent, data.people.length);
  assert.equal(resumed.nextCursor, null);
}));

test("concurrent reveal opens mark the first opening exactly once", async () => fixture(async (data) => {
  const { draw } = await generation(data);
  const [assignment] = await db.select().from(s.assignments).where(eq(s.assignments.drawId, draw.id));
  const { openRevealAssignment, getRevealPreparation } = await import("../../src/db/queries/assignments");
  const preparation = await getRevealPreparation(assignment.revealTokenHash);
  assert.equal("receiverName" in preparation!, false);
  const opens = await Promise.all([openRevealAssignment(assignment.revealTokenHash), openRevealAssignment(assignment.revealTokenHash)]);
  assert.equal(opens.filter((r) => r?.firstOpen).length, 1);
  assert.equal(opens[0]!.receiverName, opens[1]!.receiverName);
}));

test("attempt counters survive deletion of the latest attempt", async () => fixture(async (data) => {
  const first = await generation(data);
  assert.equal(first.draw.attemptNumber, 1);
  await deleteOwnedParticipant(data.admin.id, data.people[0].id, "ELIMINAR PERSONA");
  const next = await generation(data);
  assert.equal(next.draw.attemptNumber, 2);
}));

test("logout clears SSR session cookies and the next request requires authentication", async (t) => {
  const logged: Array<Record<string, unknown>> = [];
  t.mock.method(console, "log", (line: unknown) => logged.push(JSON.parse(String(line))));
  const userId = crypto.randomUUID();
  const sdkFetch = t.mock.method(globalThis, "fetch", async (input: Parameters<typeof fetch>[0]) => {
    if (String(input).endsWith("/auth/v1/user")) return Response.json({ id: userId, aud: "authenticated", email: "synthetic@example.invalid" });
    assert.match(String(input), /^https:\/\/project\.example\.invalid\/auth\/v1\/logout/);
    return new Response(null, { status: 204 });
  });
  const token = `${Buffer.from('{}').toString('base64url')}.${Buffer.from(JSON.stringify({ exp: Math.floor(Date.now() / 1000) + 3600 })).toString('base64url')}.synthetic`;
  const session = { access_token: token, refresh_token: "synthetic-refresh", expires_at: Math.floor(Date.now() / 1000) + 3600, expires_in: 3600, token_type: "bearer", user: { id: userId, aud: "authenticated", email: "synthetic@example.invalid" } };
  const cookie = `sb-project-auth-token=base64-${Buffer.from(JSON.stringify(session)).toString('base64url')}`;
  const writes: Array<{ name: string; value: string; options: { maxAge?: number } }> = [];
  const cookies = { set(name: string, value: string, options: { maxAge?: number }) { writes.push({ name, value, options }); } };
  const { createLogoutHandler } = await import("../../src/pages/api/auth/logout");
  const { traceRequest } = await import("../../src/lib/logger");
  const response = await traceRequest({ route: "/api/auth/logout", method: "POST" }, async () => await createLogoutHandler()({ cookies, request: new Request("https://app.example.invalid/api/auth/logout", { method: "POST", headers: { Cookie: cookie } }) } as unknown as Parameters<APIRoute>[0]) as Response);
  assert.equal(response.status, 303);
  assert.equal(sdkFetch.mock.calls.length, 2);
  assert.equal(logged.find((entry) => entry.event === "auth.logout_succeeded")?.authUserId, userId);
  assert.ok(writes.some((w) => w.name.startsWith("sb-project-auth-token") && w.value === "" && w.options.maxAge === 0));
  const { requireAdmin } = await import("../../src/lib/supabase/auth");
  const authorization = await requireAdmin({ cookies: cookies as never, request: new Request("https://app.example.invalid/") });
  assert.equal(authorization.status, 401);
});

test("concurrent distributed rate limits share one atomic request budget", async () => {
  const { checkRateLimit, rateLimitKey } = await import("../../src/services/security/rateLimit");
  const subject = crypto.randomUUID();
  try {
    const results = await Promise.all(Array.from({ length: 15 }, () => checkRateLimit("login", subject)));
    assert.equal(results.filter((r) => r.allowed).length, 10);
    const [row] = await db.select().from(s.requestRateLimits).where(eq(s.requestRateLimits.keyHash, rateLimitKey("login", subject)));
    assert.equal(row.attempts, 15);
    assert.ok(results.every((r) => r.retryAfter > 0 && r.retryAfter <= 60));
  } finally { await db.delete(s.requestRateLimits).where(eq(s.requestRateLimits.keyHash, rateLimitKey("login", subject))); }
});

test("audit events survive history deletion and exclude copied link contents", async () => fixture(async (data) => {
  const { draw } = await generation(data);
  const [assignment] = await db.select().from(s.assignments).where(eq(s.assignments.drawId, draw.id));
  const { prepareManualDelivery } = await import("../../src/actions/notifications");
  const { getDrawExposure } = await import("../../src/db/queries/notifications");
  await assert.rejects(prepareManualDelivery({ adminId: crypto.randomUUID(), assignmentId: assignment.id }), { code: "ASSIGNMENT_NOT_FOUND" });
  const result = await prepareManualDelivery({ adminId: data.admin.id, assignmentId: assignment.id });
  assert.equal((await getDrawExposure(draw.id)).manual, 1);
  await revokeEditionDraw({ adminId: data.admin.id, editionId: data.edition.id, drawId: draw.id, confirmation: "ANULAR REPARTO" });
  await deleteOwnedParticipant(data.admin.id, data.people[0].id, "ELIMINAR PERSONA");
  const events = await db.select().from(s.auditEvents).where(eq(s.auditEvents.drawId, draw.id));
  assert.deepEqual(events.map((e) => e.event).sort(), ["assignment.link_copied", "draw.generated", "draw.revoked"]);
  assert.equal(JSON.stringify(events).includes(result.revealUrl.split("#")[1]), false);
  await db.delete(s.auditEvents).where(eq(s.auditEvents.drawId, draw.id));
}));

test("signed email webhooks handle bounces, replays and out of order events", async () => fixture(async (data) => {
  const { createHmac } = await import("node:crypto");
  const { POST: webhook } = await import("../../src/pages/api/webhooks/resend");
  const { draw } = await generation(data);
  const [assignment] = await db.select().from(s.assignments).where(eq(s.assignments.drawId, draw.id));
  const providerId = crypto.randomUUID();
  await db.insert(s.notificationLogs).values({ assignmentId: assignment.id, channel: "email", recipient: "test@example.invalid", status: "sent", providerMessageId: providerId });
  const secret = Buffer.alloc(32, 2);
  process.env.RESEND_WEBHOOK_SECRET = `whsec_${secret.toString("base64")}`;
  const send = async (type: string, valid = true, age = 0, id = providerId) => {
    const payload = JSON.stringify({ type, data: { email_id: id } });
    const messageId = crypto.randomUUID();
    const timestamp = String(Math.floor(Date.now() / 1000) - age);
    const signature = createHmac("sha256", secret).update(`${messageId}.${timestamp}.${payload}`).digest("base64");
    return webhook({ request: new Request("https://app.example.invalid/api/webhooks/resend", { method: "POST", headers: { "svix-id": messageId, "svix-timestamp": timestamp, "svix-signature": `v1,${valid ? signature : "invalid"}` }, body: payload }) } as Parameters<APIRoute>[0]) as Promise<Response>;
  };
  try {
    assert.equal((await send("email.bounced", false)).status, 401);
    assert.equal((await send("email.bounced", true, 3600)).status, 401);
    assert.equal((await send("email.delivered", true, 0, crypto.randomUUID())).status, 503);
    for (const type of ["email.delivered", "email.bounced", "email.bounced", "email.sent", "email.delivered"]) assert.equal((await send(type)).status, 200);
    const [log] = await db.select().from(s.notificationLogs).where(eq(s.notificationLogs.providerMessageId, providerId));
    assert.equal(log.status, "failed");
    assert.equal(log.error, "email_bounced");
    assert.equal(await updateNotificationLog(log.id, { status: "sent", error: null }), undefined);
    assert.equal(await claimNotificationAttempt({ assignmentId: assignment.id, channel: "email", recipient: log.recipient, mode: "force", idempotencyKey: crypto.randomUUID() }), null);
  } finally { delete process.env.RESEND_WEBHOOK_SECRET; }
}));

test("edition rules are owned, atomic, enforced and preserve internal counters", async () => fixture(async (data) => {
  const { updateEditionRules } = await import("../../src/actions/editionRules");
  const input = { noSameIsland: false, exclusions: [{ fromParticipantId: data.people[0].id, toParticipantId: data.people[1].id }] };
  await assert.rejects(updateEditionRules(crypto.randomUUID(), data.edition.id, input), { code: "EDITION_NOT_FOUND" });
  await assert.rejects(updateEditionRules(data.admin.id, data.edition.id, { ...input, exclusions: [...input.exclusions, ...input.exclusions] }), { name: "ZodError" });
  await assert.rejects(updateEditionRules(data.admin.id, data.edition.id, { ...input, exclusions: [{ fromParticipantId: data.people[0].id, toParticipantId: data.people[0].id }] }), { name: "ZodError" });
  await updateEditionRules(data.admin.id, data.edition.id, input);
  await assert.rejects(updateEditionRules(data.admin.id, data.edition.id, { ...input, exclusions: [...input.exclusions, { fromParticipantId: data.people[0].id, toParticipantId: crypto.randomUUID() }] }), { code: "INVALID_EXCLUSION" });
  const rows = await db.select().from(s.exclusionRules).where(eq(s.exclusionRules.editionId, data.edition.id));
  assert.equal(rows.length, 1);
  const first = await generation(data);
  const pairs = await db.select({ giver: s.drawParticipants.sourceParticipantId, receiverId: s.assignments.receiverId }).from(s.assignments).innerJoin(s.drawParticipants, eq(s.assignments.giverId, s.drawParticipants.id)).where(eq(s.assignments.drawId, first.draw.id));
  const snapshots = await db.select().from(s.drawParticipants).where(eq(s.drawParticipants.drawId, first.draw.id));
  const pair = pairs.find((p) => p.giver === data.people[0].id)!;
  assert.notEqual(snapshots.find((p) => p.id === pair.receiverId)!.sourceParticipantId, data.people[1].id);
  await assert.rejects(updateEditionRules(data.admin.id, data.edition.id, input), { code: "EDITION_LOCKED" });
  await revokeEditionDraw({ adminId: data.admin.id, editionId: data.edition.id, drawId: first.draw.id, confirmation: "ANULAR REPARTO" });
  await updateEditionRules(data.admin.id, data.edition.id, { noSameIsland: true, exclusions: [] });
  const next = await generation(data);
  assert.equal(next.draw.attemptNumber, 2);
}));

test("legacy census mutations serialize positions and reject unregistered identities", async () => fixture(async (data) => {
  const { createOwnedParticipant, updateOwnedParticipant, updateOwnedIsland } = await import("../../src/actions/adminData");
  const created = await Promise.all(["First", "Second"].map((name) => createOwnedParticipant(data.admin.id, { familyId: data.family.id, familyIslandId: data.islands[0].id, name, isBaby: false })));
  assert.deepEqual(created.map((p) => p.sortOrder).sort(), [1, 2]);
  await assert.rejects(updateOwnedParticipant(crypto.randomUUID(), created[0].id, { name: "Foreign" }), { code: "FAMILY_NOT_FOUND" });
  await assert.rejects(updateOwnedIsland(crypto.randomUUID(), data.islands[0].id, { name: "Foreign" }), { code: "FAMILY_NOT_FOUND" });
  const updated = await updateOwnedParticipant(data.admin.id, created[0].id, { isBaby: true });
  assert.equal(updated.email, null);
  const [config] = await db.select().from(s.editionParticipants).where(eq(s.editionParticipants.participantId, updated.id));
  assert.equal(config.canGive, false);
}));

test("non-production deliveries require a test edition and explicit safe recipient", async () => fixture(async (data) => {
  const { draw } = await generation(data);
  const targets: string[] = [];
  const transports = { email: async (input: { to: string }) => { targets.push(input.to); return { ok: true, providerMessageId: crypto.randomUUID() }; }, whatsapp: async () => { throw new Error("Unexpected send"); } };
  const input = { admin: data.admin, editionId: data.edition.id, scope: "all" as const, mode: "pending" as const, idempotencyKey: crypto.randomUUID() };
  const safe = process.env.NOTIFICATION_TEST_EMAIL;
  delete process.env.NOTIFICATION_TEST_EMAIL;
  try { await assert.rejects(sendAdminNotifications(input, transports), { code: "TEST_EMAIL_REQUIRED" }); }
  finally { process.env.NOTIFICATION_TEST_EMAIL = safe; }
  await sendAdminNotifications(input, transports);
  assert.equal(targets.length, data.people.length);
  assert.ok(targets.every((target) => target === safe));
  await db.update(s.drawEditions).set({ kind: "final" }).where(eq(s.drawEditions.id, data.edition.id));
  await assert.rejects(sendAdminNotifications({ ...input, drawId: draw.id, idempotencyKey: crypto.randomUUID() }, transports), { code: "NON_PRODUCTION_DELIVERY" });
}));

test("notification traces retain actor and batch context across real reservations and uncertain outcomes", async (t) => fixture(async (data) => {
  const entries: Array<Record<string, any>> = [];
  for (const method of ["log", "warn", "error"] as const) t.mock.method(console, method, (line: unknown) => entries.push(JSON.parse(String(line))));
  const { traceRequest, setLogActor } = await import("../../src/lib/logger");
  const batchId = crypto.randomUUID();
  const authUserId = crypto.randomUUID();
  let calls = 0;
  let sentDrawId = "";
  const response = await traceRequest({ route: "/api/admin/editions/[id]/notifications/send", method: "POST" }, async () => {
    setLogActor({ actorType: "admin", adminId: data.admin.id, authUserId });
    const { draw } = await generation(data);
    sentDrawId = draw.id;
    const result = await sendAdminNotifications({ admin: data.admin, editionId: data.edition.id, mode: "pending", scope: "all", idempotencyKey: batchId }, {
      email: async () => {
        calls++;
        if (calls === 1) return { ok: true, providerMessageId: crypto.randomUUID() };
        if (calls === 2) return { ok: false, error: "private contact payload" };
        throw Object.assign(new Error("private token payload"), { code: "ECONNRESET" });
      },
      whatsapp: async () => { throw new Error("Unexpected WhatsApp call"); }
    });
    assert.equal(result.sent, 1);
    assert.equal(result.failed, 1);
    assert.equal(result.unknown, 1);
    return Response.json(result);
  });
  assert.equal(response.status, 200);
  const deliveries = entries.filter((entry) => entry.event === "notification.delivery.started");
  assert.equal(deliveries.length, 3);
  assert.equal(new Set(deliveries.map((entry) => entry.operationId)).size, 3);
  for (const entry of entries.filter((entry) => entry.batchId)) {
    assert.equal(entry.batchId, batchId);
    assert.equal(entry.adminId, data.admin.id);
    assert.equal(entry.authUserId, authUserId);
    assert.equal(entry.requestId, response.headers.get("X-Request-Id"));
  }
  assert.ok(entries.some((entry) => entry.event === "notification.attempt" && entry.reason === "claimed" && entry.notificationId));
  assert.ok(entries.some((entry) => entry.event === "notification.job" && entry.result === "unknown"));
  const generated = entries.find((entry) => entry.event === "draw.generation.succeeded");
  assert.equal(generated?.drawId, sentDrawId);
  assert.equal(generated?.actorType, "admin");
  const serialized = JSON.stringify(entries);
  assert.doesNotMatch(serialized, /private contact|private token|person\d@example\.invalid|Person [0-9]|reveal_token/);
  const [assignment] = await db.select().from(s.assignments).where(eq(s.assignments.drawId, sentDrawId));
  assert.equal(serialized.includes(decryptRevealToken(assignment.revealTokenCiphertext!)), false);
}));

test("signed WhatsApp callbacks log verified actors, applied transitions and ignored replays", async (t) => fixture(async (data) => {
  const entries: Array<Record<string, any>> = [];
  for (const method of ["log", "warn", "error"] as const) t.mock.method(console, method, (line: unknown) => entries.push(JSON.parse(String(line))));
  const { traceRequest } = await import("../../src/lib/logger");
  const { createHmac } = await import("node:crypto");
  const { POST: webhook } = await import("../../src/pages/api/webhooks/kapso");
  const { draw } = await generation(data);
  const [assignment] = await db.select().from(s.assignments).where(eq(s.assignments.drawId, draw.id));
  const messageId = `wamid.${crypto.randomUUID()}`;
  const [notification] = await db.insert(s.notificationLogs).values({ assignmentId: assignment.id, channel: "whatsapp", recipient: "+34000000000", status: "sent", providerMessageId: messageId }).returning();
  const previous = process.env.KAPSO_WEBHOOK_SECRET;
  process.env.KAPSO_WEBHOOK_SECRET = "synthetic-webhook-secret";
  const send = (status: string, valid = true, id = messageId) => {
    const body = JSON.stringify({ message: { id, kapso: { status } }, privateField: "private contact payload" });
    const signature = createHmac("sha256", process.env.KAPSO_WEBHOOK_SECRET!).update(body).digest("hex");
    return traceRequest({ route: "/api/webhooks/kapso", method: "POST" }, async () => await webhook({ request: new Request("https://app.example.invalid/api/webhooks/kapso", { method: "POST", headers: { "x-webhook-signature": valid ? signature : "invalid" }, body }) } as Parameters<APIRoute>[0]) as Response);
  };
  try {
    const rejected = await send("read", false);
    assert.equal(rejected.status, 401);
    assert.notEqual(entries.find((entry) => entry.event === "kapso.webhook_rejected")?.actorType, "provider");
    for (const status of ["read", "read", "sent"]) assert.equal((await send(status)).status, 200);
    const updates = entries.filter((entry) => entry.event === "kapso.delivery_updated");
    assert.deepEqual(updates.map((entry) => entry.result), ["applied", "ignored", "ignored"]);
    for (const entry of updates) {
      assert.equal(entry.actorType, "provider");
      assert.equal(entry.provider, "kapso");
      assert.equal(entry.notificationId, notification.id);
      assert.equal(entry.assignmentId, assignment.id);
      assert.equal(entry.nextStatus, "read");
    }
    assert.equal((await send("sent", true, `wamid.${crypto.randomUUID()}`)).status, 503);
    assert.ok(entries.some((entry) => entry.reason === "message_unknown" && entry.result === "retry"));
    assert.doesNotMatch(JSON.stringify(entries), /private contact|34000000000|synthetic-webhook-secret/);
  } finally { if (previous === undefined) delete process.env.KAPSO_WEBHOOK_SECRET; else process.env.KAPSO_WEBHOOK_SECRET = previous; }
}));

test("logout still clears cookies while identity enrichment remains pending", async (t) => {
  const entries: Array<Record<string, unknown>> = [];
  for (const method of ["log", "warn", "error"] as const) t.mock.method(console, method, (line: unknown) => entries.push(JSON.parse(String(line))));
  const calls: string[] = [];
  t.mock.method(globalThis, "fetch", async (input: Parameters<typeof fetch>[0], options?: RequestInit) => {
    const url = String(input);
    calls.push(url);
    if (url.endsWith("/auth/v1/user")) {
      assert.ok(options?.signal);
      return new Promise<Response>(() => {});
    }
    assert.match(url, /\/auth\/v1\/logout/);
    return new Response(null, { status: 204 });
  });
  const accessToken = `${Buffer.from('{}').toString('base64url')}.${Buffer.from(JSON.stringify({ exp: Math.floor(Date.now() / 1000) + 3600 })).toString('base64url')}.synthetic`;
  const session = { access_token: accessToken, refresh_token: "synthetic-refresh", expires_at: Math.floor(Date.now() / 1000) + 3600, expires_in: 3600, token_type: "bearer", user: { id: crypto.randomUUID(), aud: "authenticated" } };
  const cookie = `sb-project-auth-token=base64-${Buffer.from(JSON.stringify(session)).toString('base64url')}`;
  const writes: string[] = [];
  const cookies = { set(name: string, value: string) { if (value === "") writes.push(name); } };
  const { traceRequest } = await import("../../src/lib/logger");
  const { createLogoutHandler } = await import("../../src/pages/api/auth/logout");
  const response = await traceRequest({ route: "/api/auth/logout", method: "POST" }, async () => await createLogoutHandler()({ cookies, request: new Request("https://app.example.invalid/api/auth/logout", { method: "POST", headers: { Cookie: cookie } }) } as unknown as Parameters<APIRoute>[0]) as Response);
  assert.equal(response.status, 303);
  assert.equal(calls.length, 2);
  assert.ok(writes.includes("sb-project-auth-token"));
  assert.ok(entries.some((entry) => entry.event === "auth.identity_unavailable"));
  assert.equal(entries.find((entry) => entry.event === "auth.logout_succeeded")?.authUserId, undefined);
});
