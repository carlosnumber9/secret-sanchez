export type AppEnv = {
  publicSupabaseUrl: string;
  publicSupabaseAnonKey: string;
  databaseUrl: string;
  appUrl: string;
  revealTokenEncryptionKey: string;
  resendApiKey?: string;
  kapsoApiKey?: string;
};

type EnvSource = Record<string, string | undefined>;

function defaultSource(): EnvSource {
  return {
    PUBLIC_SUPABASE_URL: import.meta.env?.PUBLIC_SUPABASE_URL ?? process.env.PUBLIC_SUPABASE_URL,
    PUBLIC_SUPABASE_ANON_KEY:
      import.meta.env?.PUBLIC_SUPABASE_ANON_KEY ?? process.env.PUBLIC_SUPABASE_ANON_KEY,
    DATABASE_URL: import.meta.env?.DATABASE_URL ?? process.env.DATABASE_URL,
    APP_URL: import.meta.env?.APP_URL ?? process.env.APP_URL,
    REVEAL_TOKEN_ENCRYPTION_KEY:
      import.meta.env?.REVEAL_TOKEN_ENCRYPTION_KEY ?? process.env.REVEAL_TOKEN_ENCRYPTION_KEY,
    RESEND_API_KEY: import.meta.env?.RESEND_API_KEY ?? process.env.RESEND_API_KEY,
    KAPSO_API_KEY: import.meta.env?.KAPSO_API_KEY ?? process.env.KAPSO_API_KEY
  };
}

function required(source: EnvSource, name: string) {
  const value = source[name]?.trim();
  if (!value) throw new Error(`${name} is required.`);
  return value;
}

export function readEnv(source: EnvSource): AppEnv {
  const appUrl = required(source, "APP_URL");
  const revealTokenEncryptionKey = required(source, "REVEAL_TOKEN_ENCRYPTION_KEY");
  let parsedAppUrl: URL;
  try {
    parsedAppUrl = new URL(appUrl);
  } catch {
    throw new Error("APP_URL must be an absolute URL.");
  }
  if (!["http:", "https:"].includes(parsedAppUrl.protocol)) {
    throw new Error("APP_URL must use HTTP or HTTPS.");
  }
  if (
    !/^[A-Za-z0-9+/]{43}=$/.test(revealTokenEncryptionKey) ||
    Buffer.from(revealTokenEncryptionKey, "base64").length !== 32
  ) {
    throw new Error("REVEAL_TOKEN_ENCRYPTION_KEY must decode to exactly 32 bytes.");
  }

  return {
    publicSupabaseUrl: required(source, "PUBLIC_SUPABASE_URL"),
    publicSupabaseAnonKey: required(source, "PUBLIC_SUPABASE_ANON_KEY"),
    databaseUrl: required(source, "DATABASE_URL"),
    appUrl,
    revealTokenEncryptionKey,
    resendApiKey: source.RESEND_API_KEY?.trim() || undefined,
    kapsoApiKey: source.KAPSO_API_KEY?.trim() || undefined
  };
}

export function getEnv(): AppEnv {
  return readEnv(defaultSource());
}
