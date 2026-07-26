/// <reference types="astro/client" />

declare namespace App {
  interface Locals {
    admin: typeof import("@/db/schema").adminUsers.$inferSelect;
  }
}
