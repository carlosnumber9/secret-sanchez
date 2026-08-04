export const ACTIVE_DRAW_STATUSES = ["generated", "locked", "sent"] as const;

export function isOwnedByAdmin(ownerAdminId: string, adminId: string) {
  return ownerAdminId === adminId;
}

export function isActiveDrawStatus(status: string) {
  return ACTIVE_DRAW_STATUSES.includes(status as (typeof ACTIVE_DRAW_STATUSES)[number]);
}

export function buildNotificationAttemptKey(
  requestId: string,
  assignmentId: string,
  channel: "email" | "whatsapp"
) {
  return `${requestId}:${assignmentId}:${channel}`;
}
