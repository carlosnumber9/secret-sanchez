import { createClient } from "@supabase/supabase-js";
import { getEnv } from "@/lib/env";

export async function loginWithMagicLink(email: string, origin?: string) {
  const env = getEnv();
  const supabase = createClient(env.publicSupabaseUrl, env.publicSupabaseAnonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false
    }
  });

  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: {
          emailRedirectTo: `${(origin ?? env.appUrl).replace(/\/$/, "")}/auth/callback?next=/inicio`
    }
  });

  if (error) {
    return { ok: false, message: "No se pudo enviar el enlace. Vuelve a intentarlo." };
  }

  return {
    ok: true,
    message: "Te hemos enviado un enlace de acceso. Revisa tu correo."
  };
}
