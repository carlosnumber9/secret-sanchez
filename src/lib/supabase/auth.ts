import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { adminUsers } from "@/db/schema";
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

export async function getCurrentAdmin(context: AuthContext) {
  const supabase = createSupabaseServerClient(context);
  const {
    data: { user },
    error
  } = await supabase.auth.getUser();

  if (error || !user?.email) return null;

  const [admin] = await db
    .select()
    .from(adminUsers)
    .where(eq(adminUsers.email, user.email.toLowerCase()))
    .limit(1);

  if (!admin) return null;
  return admin;
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

  if (error || !user?.email) {
    return {
      admin: null,
      status: 401 as const,
      reason: "missing_session" as const
    };
  }

  let admin: typeof adminUsers.$inferSelect | undefined;
  try {
    [admin] = await db
      .select()
      .from(adminUsers)
      .where(eq(adminUsers.email, user.email.toLowerCase()))
      .limit(1);
  } catch (cause) {
    throw new AuthCheckError("admin_lookup", cause);
  }

  if (!admin) {
    return {
      admin: null,
      status: 403 as const,
      reason: "admin_not_authorized" as const
    };
  }

  return { admin, status: 200 as const, reason: null };
}
