import { createClient } from "@supabase/supabase-js";
import { getEnv } from "@/lib/env";

export async function loginWithMagicLink(email: string) {
  const env = getEnv();
  if (!env.publicSupabaseUrl || !env.publicSupabaseAnonKey) {
    return {
      ok: false,
      message: "Supabase no está configurado todavía."
    };
  }

  const supabase = createClient(env.publicSupabaseUrl, env.publicSupabaseAnonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true
    }
  });

  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      emailRedirectTo: `${env.appUrl.replace(/\/$/, "")}/inicio`
    }
  });

  if (error) {
    return { ok: false, message: error.message };
  }

  return {
    ok: true,
    message: "Te hemos enviado un enlace de acceso. Revisa tu correo."
  };
}
