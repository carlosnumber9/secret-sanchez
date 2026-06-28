export type AppEnv = {
  publicSupabaseUrl?: string;
  publicSupabaseAnonKey?: string;
  supabaseServiceRoleKey?: string;
  databaseUrl?: string;
  appUrl: string;
  resendApiKey?: string;
  kapsoApiKey?: string;
};

export function getEnv(): AppEnv {
  const publicSupabaseUrl = import.meta.env.PUBLIC_SUPABASE_URL || import.meta.env.SUPABASE_URL;
  const publicSupabaseAnonKey = import.meta.env.PUBLIC_SUPABASE_ANON_KEY || import.meta.env.SUPABASE_KEY;

  return {
    publicSupabaseUrl,
    publicSupabaseAnonKey,
    supabaseServiceRoleKey: import.meta.env.SUPABASE_SERVICE_ROLE_KEY,
    databaseUrl: import.meta.env.DATABASE_URL,
    appUrl: import.meta.env.APP_URL || "http://localhost:4321",
    resendApiKey: import.meta.env.RESEND_API_KEY,
    kapsoApiKey: import.meta.env.KAPSO_API_KEY
  };
}

export function isSupabaseConfigured() {
  const env = getEnv();
  return Boolean(env.publicSupabaseUrl && env.publicSupabaseAnonKey);
}

export function isDatabaseConfigured() {
  return Boolean(getEnv().databaseUrl);
}
