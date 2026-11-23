import { sql } from "drizzle-orm";
import { adminUsers } from "@/db/schema";

// Every registered administrator manages the same family and game editions.
// The session supplies adminId; historical creator fields do not grant access.
export function registeredAdmin(adminId: string) {
  return sql<boolean>`exists (select 1 from ${adminUsers} where ${adminUsers.id} = ${adminId})`;
}
