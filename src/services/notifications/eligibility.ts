export type NotificationAttemptStatus =
  | "pending"
  | "sent"
  | "delivered"
  | "failed"
  | "opened"
  | "manual";

export function isEligibleNotification(
  latestStatus: NotificationAttemptStatus | null,
  mode: "pending" | "failed"
) {
  return mode === "failed" ? latestStatus === "failed" : latestStatus === null || latestStatus === "pending";
}
