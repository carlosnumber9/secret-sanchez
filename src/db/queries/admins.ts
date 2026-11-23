import { observe } from "@/lib/logger";
import { eq, sql } from "drizzle-orm";
import { db } from "@/db/client";
import { adminUsers } from "@/db/schema";

export async function findAdminByEmail(email: string) {
  return observe("db.admins.find", {}, async () => {
    const [admin] = await db
      .select()
      .from(adminUsers)
      .where(eq(sql`lower(${adminUsers.email})`, email.toLowerCase()))
      .limit(1);

    return admin ?? null;

  }, undefined, { debug: true });
}

export async function createAdmin(input: { email: string; name: string; authUserId?: string }) {
  return observe("db.admins.create", {}, async () => {
    const [admin] = await db
      .insert(adminUsers)
      .values({
        email: input.email.toLowerCase(),
        name: input.name,
        authUserId: input.authUserId
      })
      .returning();

    return admin;

  }, undefined, { debug: true });
}
