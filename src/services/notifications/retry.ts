export const notificationLeaseMs = 60_000;
const providerIdempotencyWindowMs = 23 * 60 * 60_000;

export function canResumePending(channel: string, createdAt: Date, now = Date.now()) {
  const age = now - createdAt.getTime();
  return channel === "email" && age >= notificationLeaseMs && age < providerIdempotencyWindowMs;
}

export class NotificationRateLimitError extends Error {
  readonly retryAfterSeconds: number;
  constructor(value?: string | null) {
    super("Provider rate limit reached.");
    this.name = "NotificationRateLimitError";
    const seconds = value && Number.isFinite(Number(value)) ? Number(value) : 2;
    this.retryAfterSeconds = Math.min(60, Math.max(1, Math.ceil(seconds)));
  }
}

export function pendingRateLimit(error: string | null | undefined, now = Date.now()) {
  if (!error?.startsWith("rate_limited:")) return null;
  const until = Number(error.slice("rate_limited:".length));
  return Number.isFinite(until) ? Math.max(0, until - now) : null;
}
