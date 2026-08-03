import assert from "node:assert/strict";
import test from "node:test";
import {
  resolveAdminIdentity,
  type AdminIdentityStore
} from "../src/services/auth/resolveAdminIdentity";

type Admin = {
  id: string;
  email: string;
  authUserId: string | null;
};

function createStore(initialAdmins: Admin[]) {
  const admins = structuredClone(initialAdmins);
  const calls: string[] = [];

  const store: AdminIdentityStore<Admin> = {
    async findByAuthUserId(authUserId) {
      calls.push(`uuid:${authUserId}`);
      return admins.find((admin) => admin.authUserId === authUserId) ?? null;
    },
    async findUnlinkedByEmail(email) {
      calls.push(`email:${email}`);
      return (
        admins.find(
          (admin) => admin.authUserId === null && admin.email.toLowerCase() === email.toLowerCase()
        ) ?? null
      );
    },
    async linkAuthUserId(adminId, authUserId) {
      calls.push(`link:${adminId}:${authUserId}`);
      const admin = admins.find((candidate) => candidate.id === adminId);
      if (!admin || admin.authUserId !== null) return null;
      admin.authUserId = authUserId;
      return admin;
    }
  };

  return { admins, calls, store };
}

test("UUID identity is preferred and does not use the email fallback", async () => {
  const { calls, store } = createStore([
    { id: "admin-a", email: "old@example.com", authUserId: "auth-a" }
  ]);

  const admin = await resolveAdminIdentity(
    { id: "auth-a", email: "new@example.com" },
    store
  );

  assert.equal(admin?.id, "admin-a");
  assert.deepEqual(calls, ["uuid:auth-a"]);
});

test("a legacy email match is linked atomically to the authenticated UUID", async () => {
  const { admins, calls, store } = createStore([
    { id: "admin-a", email: "JUAN@example.com", authUserId: null }
  ]);

  const admin = await resolveAdminIdentity(
    { id: "auth-a", email: "juan@example.com" },
    store
  );

  assert.equal(admin?.id, "admin-a");
  assert.equal(admins[0]?.authUserId, "auth-a");
  assert.deepEqual(calls, ["uuid:auth-a", "email:juan@example.com", "link:admin-a:auth-a"]);
});

test("email fallback cannot claim an administrator linked to another UUID", async () => {
  const { calls, store } = createStore([
    { id: "admin-a", email: "juan@example.com", authUserId: "auth-owner" }
  ]);

  const admin = await resolveAdminIdentity(
    { id: "auth-other", email: "juan@example.com" },
    store
  );

  assert.equal(admin, null);
  assert.deepEqual(calls, ["uuid:auth-other", "email:juan@example.com"]);
});

test("an authenticated user outside the allowlist is rejected", async () => {
  const { store } = createStore([]);
  assert.equal(
    await resolveAdminIdentity({ id: "auth-other", email: "other@example.com" }, store),
    null
  );
});

test("a concurrent legacy claim is resolved by rereading the authenticated UUID", async () => {
  const admin = { id: "admin-a", email: "juan@example.com", authUserId: null as string | null };
  let uuidReads = 0;
  const store: AdminIdentityStore<Admin> = {
    async findByAuthUserId(authUserId) {
      uuidReads += 1;
      return uuidReads > 1 && authUserId === "auth-a" ? { ...admin, authUserId } : null;
    },
    async findUnlinkedByEmail() {
      return admin;
    },
    async linkAuthUserId() {
      return null;
    }
  };

  const resolved = await resolveAdminIdentity(
    { id: "auth-a", email: "juan@example.com" },
    store
  );

  assert.equal(resolved?.authUserId, "auth-a");
  assert.equal(uuidReads, 2);
});
