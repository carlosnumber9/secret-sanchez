import { createBrowserClient } from "@supabase/ssr";
import { getEnv } from "../env";

export function createSupabaseBrowserClient() {
  const env = getEnv();
  if (!env.publicSupabaseUrl || !env.publicSupabaseAnonKey) {
    throw new Error("Supabase public env vars are missing.");
  }

  return createBrowserClient(env.publicSupabaseUrl, env.publicSupabaseAnonKey);
}
