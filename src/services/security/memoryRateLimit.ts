export function createMemoryRateLimiter(capacity = 10_000) {
  const entries = new Map<string, { window: number; attempts: number }>();
  return (key: string, limit: number, now = Date.now()) => {
    const window = Math.floor(now / 60_000) * 60_000;
    let entry = entries.get(key);
    if (entries.size >= capacity) for (const [oldKey, value] of entries) if (value.window < window) entries.delete(oldKey);
    if (!entry || entry.window !== window) {
      if (entries.size >= capacity && !entries.has(key)) return { allowed: false, retryAfter: Math.max(1, Math.ceil((window + 60_000 - now) / 1000)) };
      entry = { window, attempts: 0 };
      entries.set(key, entry);
    }
    entry.attempts++;
    return { allowed: entry.attempts <= limit, retryAfter: Math.max(1, Math.ceil((window + 60_000 - now) / 1000)) };
  };
}
