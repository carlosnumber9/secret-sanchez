const redirectBase = new URL("https://secret-sanchez.local");

export function getSafeRedirectPath(value: string | null | undefined, fallback = "/") {
  if (!value?.startsWith("/")) return fallback;

  try {
    const target = new URL(value, redirectBase);
    if (target.origin !== redirectBase.origin) return fallback;
    return `${target.pathname}${target.search}${target.hash}`;
  } catch {
    return fallback;
  }
}
