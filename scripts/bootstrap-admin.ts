import "./load-env";
import { eq, sql } from "drizzle-orm";
import { db } from "@/db/client";
import { adminUsers } from "@/db/schema";

function readFlag(name: string) {
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 ? process.argv[index + 1]?.trim() : undefined;
}

const email = readFlag("email")?.toLowerCase();
const name = readFlag("name");

if (!email || !email.includes("@") || !name) {
  console.error("Uso: npm run admin:bootstrap -- --email admin@example.com --name \"Nombre\"");
  process.exitCode = 1;
} else {
  const [existing] = await db
    .select()
    .from(adminUsers)
    .where(eq(sql`lower(${adminUsers.email})`, email))
    .limit(1);

  if (existing) {
    await db.update(adminUsers).set({ name }).where(eq(adminUsers.id, existing.id));
  } else {
    await db.insert(adminUsers).values({ email, name });
  }

  console.log("Administrador preparado correctamente.");
}
