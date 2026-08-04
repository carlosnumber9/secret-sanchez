export type NotificationAttemptStatus =
  | "pending"
  | "sent"
  | "delivered"
  | "failed"
  | "opened"
  | "read"
  | "manual";

export function isEligibleNotification(
  latestStatus: NotificationAttemptStatus | null,
  mode: "pending" | "failed" | "force"
) {
  if (mode === "force") return true;
  return mode === "failed" ? latestStatus === "failed" : latestStatus === null || latestStatus === "pending";
}
