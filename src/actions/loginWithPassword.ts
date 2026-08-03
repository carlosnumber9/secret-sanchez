import type { AstroCookies } from "astro";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type LoginContext = {
  cookies: AstroCookies;
  request: Request;
};

export function loginWithPassword(context: LoginContext, email: string, password: string) {
  const supabase = createSupabaseServerClient(context);
  return supabase.auth.signInWithPassword({ email, password });
}
