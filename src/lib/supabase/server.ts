import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { getEnv } from "../env";

type AstroCookies = {
  get: (name: string) => { value: string } | undefined;
  set: (name: string, value: string, options?: Record<string, unknown>) => void;
  delete: (name: string, options?: Record<string, unknown>) => void;
};

export function createSupabaseServerClient(cookies: AstroCookies) {
  const env = getEnv();
  if (!env.publicSupabaseUrl || !env.publicSupabaseAnonKey) {
    throw new Error("Supabase public env vars are missing.");
  }

  return createServerClient(env.publicSupabaseUrl, env.publicSupabaseAnonKey, {
    cookies: {
      get(name) {
        return cookies.get(name)?.value;
      },
      set(name, value, options) {
        cookies.set(name, value, options);
      },
      remove(name, options) {
        cookies.delete(name, options);
      }
    }
  });
}

export function createSupabaseAdminClient() {
  const env = getEnv();
  if (!env.publicSupabaseUrl || !env.supabaseServiceRoleKey) {
    throw new Error("Supabase service role env vars are missing.");
  }

  return createClient(env.publicSupabaseUrl, env.supabaseServiceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false
    }
  });
}
