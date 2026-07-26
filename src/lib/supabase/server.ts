import type { AstroCookieSetOptions, AstroCookies } from "astro";
import { createServerClient } from "@supabase/ssr";
import { getEnv } from "../env";

type SupabaseServerContext = {
  cookies: AstroCookies;
  request: Request;
};

function getRequestCookies(request: Request) {
  const cookieHeader = request.headers.get("cookie");
  if (!cookieHeader) return [];

  return cookieHeader.split(";").flatMap((cookie) => {
    const separatorIndex = cookie.indexOf("=");
    if (separatorIndex < 0) return [];

    const name = cookie.slice(0, separatorIndex).trim();
    if (!name) return [];

    return [{ name, value: cookie.slice(separatorIndex + 1).trim() }];
  });
}

export function createSupabaseServerClient({ cookies, request }: SupabaseServerContext) {
  const env = getEnv();
  let requestCookies = getRequestCookies(request);

  return createServerClient(env.publicSupabaseUrl, env.publicSupabaseAnonKey, {
    cookies: {
      getAll() {
        return requestCookies;
      },
      setAll(cookiesToSet) {
        for (const { name, value, options } of cookiesToSet) {
          requestCookies = requestCookies.filter((cookie) => cookie.name !== name);
          if (value) requestCookies.push({ name, value });
          cookies.set(name, value, options as AstroCookieSetOptions);
        }
      }
    }
  });
}
