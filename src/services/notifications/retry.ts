export const notificationLeaseMs = 60_000;
const providerIdempotencyWindowMs = 23 * 60 * 60_000;

export function canResumePending(channel: string, createdAt: Date, now = Date.now()) {
  const age = now - createdAt.getTime();
  return channel === "email" && age >= notificationLeaseMs && age < providerIdempotencyWindowMs;
}
