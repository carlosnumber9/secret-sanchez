import { and, eq, isNull, sql } from "drizzle-orm";
import { db } from "@/db/client";
import { adminUsers } from "@/db/schema";
import {
  resolveAdminIdentity,
  type AdminIdentityStore
} from "@/services/auth/resolveAdminIdentity";
import { createSupabaseServerClient } from "./server";

type AuthContext = {
  cookies: Parameters<typeof createSupabaseServerClient>[0]["cookies"];
  request: Request;
};

export class AuthCheckError extends Error {
  constructor(
    public readonly stage: "session_lookup" | "admin_lookup",
    cause: unknown
  ) {
    super(`Authentication failed during ${stage}.`, { cause });
    this.name = "AuthCheckError";
  }
}

type Admin = typeof adminUsers.$inferSelect;

const adminIdentityStore: AdminIdentityStore<Admin> = {
  async findByAuthUserId(authUserId) {
    const [admin] = await db
      .select()
      .from(adminUsers)
      .where(eq(adminUsers.authUserId, authUserId))
      .limit(1);
    return admin ?? null;
  },
  async findUnlinkedByEmail(email) {
    const [admin] = await db
      .select()
      .from(adminUsers)
      .where(
        and(
          isNull(adminUsers.authUserId),
          eq(sql`lower(${adminUsers.email})`, email.toLowerCase())
        )
      )
      .limit(1);
    return admin ?? null;
  },
  async linkAuthUserId(adminId, authUserId) {
    const [admin] = await db
      .update(adminUsers)
      .set({ authUserId })
      .where(and(eq(adminUsers.id, adminId), isNull(adminUsers.authUserId)))
      .returning();
    return admin ?? null;
  }
};

function findAdminForUser(user: { id: string; email?: string }) {
  return resolveAdminIdentity(user, adminIdentityStore);
}

export async function getCurrentAdmin(context: AuthContext) {
  const supabase = createSupabaseServerClient(context);
  const {
    data: { user },
    error
  } = await supabase.auth.getUser();

  if (error || !user) return null;
  return findAdminForUser(user);
}

export async function requireAdmin(context: AuthContext) {
  let user: Awaited<ReturnType<ReturnType<typeof createSupabaseServerClient>["auth"]["getUser"]>>["data"]["user"];
  let error: Awaited<ReturnType<ReturnType<typeof createSupabaseServerClient>["auth"]["getUser"]>>["error"];
  try {
    const supabase = createSupabaseServerClient(context);
    const result = await supabase.auth.getUser();
    user = result.data.user;
    error = result.error;
  } catch (cause) {
    throw new AuthCheckError("session_lookup", cause);
  }

  if (error || !user) {
    return {
      admin: null,
      status: 401 as const,
      reason: "missing_session" as const
    };
  }

  let admin: Admin | null;
  try {
    admin = await findAdminForUser(user);
  } catch (cause) {
    throw new AuthCheckError("admin_lookup", cause);
  }

  if (admin === null) {
    return {
      admin: null,
      status: 403 as const,
      reason: "admin_not_authorized" as const
    };
  }

  return { admin, status: 200 as const, reason: null };
}
