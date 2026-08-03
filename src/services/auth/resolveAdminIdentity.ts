export type AuthenticatedIdentity = {
  id: string;
  email?: string;
};

export type AdminIdentityStore<Admin extends { id: string }> = {
  findByAuthUserId(authUserId: string): Promise<Admin | null>;
  findUnlinkedByEmail(email: string): Promise<Admin | null>;
  linkAuthUserId(adminId: string, authUserId: string): Promise<Admin | null>;
};

export async function resolveAdminIdentity<Admin extends { id: string }>(
  identity: AuthenticatedIdentity,
  store: AdminIdentityStore<Admin>
) {
  const linkedAdmin = await store.findByAuthUserId(identity.id);
  if (linkedAdmin) return linkedAdmin;

  if (!identity.email) return null;

  const legacyAdmin = await store.findUnlinkedByEmail(identity.email.toLowerCase());
  if (!legacyAdmin) return null;

  const claimedAdmin = await store.linkAuthUserId(legacyAdmin.id, identity.id);
  if (claimedAdmin) return claimedAdmin;

  return store.findByAuthUserId(identity.id);
}
