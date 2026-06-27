import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { adminUsers } from "@/db/schema";
import { isDatabaseConfigured, isSupabaseConfigured } from "../env";
import { createSupabaseServerClient } from "./server";

type AuthContext = {
  cookies: Parameters<typeof createSupabaseServerClient>[0];
};

export async function getCurrentAdmin(context: AuthContext) {
  if (!isSupabaseConfigured() || !isDatabaseConfigured()) return null;

  const supabase = createSupabaseServerClient(context.cookies);
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user?.email) return null;

  const [admin] = await db
    .select()
    .from(adminUsers)
    .where(eq(adminUsers.email, user.email.toLowerCase()))
    .limit(1);

  if (!admin) return null;
  return admin;
}

export async function requireAdmin(context: AuthContext) {
  const admin = await getCurrentAdmin(context);
  if (!admin) {
    return {
      admin: null,
      redirect: "/login"
    };
  }

  return { admin, redirect: null };
}
