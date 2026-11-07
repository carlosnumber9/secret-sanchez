type Source = Record<string, string | undefined>;
export type AppEnvironment = "development" | "preview" | "production" | "test";

function projectRef(value: string | undefined) {
  try {
    const url = new URL(value ?? "");
    return url.protocol === "https:" ? /^([a-z0-9-]+)\.supabase\.co$/.exec(url.hostname)?.[1] : undefined;
  } catch { return undefined; }
}

export function environmentPolicy(source: Source): AppEnvironment {
  // Vercel's deployment identity takes precedence over app-controlled settings.
  const environment = source.VERCEL_ENV || source.APP_ENV || "development";
  if (!["development", "preview", "production", "test"].includes(environment)) throw new Error("APP_ENV must identify a supported environment.");
  let database: URL;
  try { database = new URL(source.DATABASE_URL || ""); }
  catch { throw new Error("DATABASE_URL must be a valid PostgreSQL URL."); }
  if (!/^postgres(?:ql)?:$/.test(database.protocol)) throw new Error("DATABASE_URL must use PostgreSQL.");
  if (environment === "production") return environment;
  if (environment === "test") {
    let auth: URL;
    try { auth = new URL(source.PUBLIC_SUPABASE_URL || ""); }
    catch { throw new Error("Test mode requires a synthetic Supabase URL."); }
    if (!["localhost", "127.0.0.1", "[::1]"].includes(database.hostname) || !/^\/[a-zA-Z0-9_]+_test$/.test(database.pathname) || !auth.hostname.endsWith(".invalid")) throw new Error("Test mode requires a local _test database and synthetic Supabase URL.");
    return environment;
  }
  const current = projectRef(source.PUBLIC_SUPABASE_URL);
  const production = projectRef(source.PRODUCTION_SUPABASE_URL);
  if (!current || !production || current === production) throw new Error("Non-production requires a separate Supabase project and PRODUCTION_SUPABASE_URL reference.");
  const direct = database.hostname === `db.${current}.supabase.co`;
  const pooler = database.hostname.endsWith(".pooler.supabase.com") && decodeURIComponent(database.username) === `postgres.${current}`;
  if (!direct && !pooler) throw new Error("DATABASE_URL must target the non-production Supabase project.");
  let currentOrigin: string, productionOrigin: string;
  try {
    const currentUrl = new URL(source.APP_URL || "");
    const productionUrl = new URL(source.PRODUCTION_APP_URL || "");
    if (![currentUrl, productionUrl].every((url) => ["https:", "http:"].includes(url.protocol))) throw new Error();
    currentOrigin = currentUrl.origin;
    productionOrigin = productionUrl.origin;
  } catch { throw new Error("Non-production requires APP_URL and PRODUCTION_APP_URL origins."); }
  if (currentOrigin === productionOrigin) throw new Error("Non-production APP_URL must differ from Production.");
  return environment as AppEnvironment;
}
