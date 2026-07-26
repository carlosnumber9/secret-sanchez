import { createNotificationLog, findNotificationByIdempotencyKey, updateNotificationLog } from "@/db/queries/notifications";
import { getOwnedAssignment, listAssignmentsForDraw } from "@/db/queries/assignments";
import { getActiveFamilyGroupForAdmin } from "@/db/queries/familyGroups";
import { getLatestOwnedDraw } from "@/db/queries/draws";
import { listNotificationLogsForDraw } from "@/db/queries/notifications";
import { AppError } from "@/lib/errors";
import { getEnv } from "@/lib/env";
import { logger } from "@/lib/logger";
import { buildRevealUrl, decryptRevealToken } from "@/lib/tokens";
import { buildNotificationAttemptKey } from "@/services/admin/policies";
import { isEligibleNotification } from "@/services/notifications/eligibility";
import { sendEmailNotification } from "@/services/notifications/sendEmailNotification";

export async function sendAdminNotifications(input: {
  adminId: string;
  mode: "pending" | "failed";
  idempotencyKey: string;
}) {
  const group = await getActiveFamilyGroupForAdmin(input.adminId);
  if (!group) throw new AppError(404, "GROUP_NOT_FOUND", "No hay un grupo activo.");
  const draw = await getLatestOwnedDraw(group.id);
  if (!draw) throw new AppError(404, "DRAW_NOT_FOUND", "Todavía no hay un sorteo.");

  const [rows, logRows] = await Promise.all([
    listAssignmentsForDraw(draw.id),
    listNotificationLogsForDraw(draw.id)
  ]);
  const logs = logRows.map(({ log }) => log);
  let sent = 0;
  let failed = 0;
  let skipped = 0;

  for (const { assignment, giver } of rows) {
    if (giver.preferredChannel !== "email" || !giver.email || !assignment.revealTokenCiphertext) {
      skipped += 1;
      continue;
    }

    const latest = logs.find(
      (log) => log.assignmentId === assignment.id && log.channel === "email"
    );
    const eligible = isEligibleNotification(latest?.status ?? null, input.mode);
    if (!eligible) {
      skipped += 1;
      continue;
    }

    const attemptKey = buildNotificationAttemptKey(input.idempotencyKey, assignment.id, "email");
    const existing = await findNotificationByIdempotencyKey(attemptKey);
    if (existing) {
      skipped += 1;
      continue;
    }

    const log = await createNotificationLog({
      assignmentId: assignment.id,
      channel: "email",
      recipient: giver.email,
      status: "pending",
      idempotencyKey: attemptKey
    });

    try {
      const token = decryptRevealToken(assignment.revealTokenCiphertext);
      const result = await sendEmailNotification({
        to: giver.email,
        name: giver.name,
        revealUrl: buildRevealUrl(getEnv().appUrl, token)
      });
      if (!result.ok) {
        failed += 1;
        await updateNotificationLog(log.id, { status: "failed", error: "provider_rejected" });
        logger.warn("notification.email_failed", {
          assignmentId: assignment.id,
          drawId: draw.id,
          reason: "provider_rejected"
        });
      } else {
        sent += 1;
        await updateNotificationLog(log.id, {
          status: "sent",
          providerMessageId: result.providerMessageId,
          sentAt: new Date(),
          error: null
        });
        logger.info("notification.email_sent", { assignmentId: assignment.id, drawId: draw.id });
      }
    } catch (error) {
      failed += 1;
      const errorId = logger.error("notification.email_exception", error, {
        assignmentId: assignment.id,
        drawId: draw.id
      });
      await updateNotificationLog(log.id, { status: "failed", error: `errorId:${errorId}` });
    }
  }

  return { sent, failed, skipped };
}

export async function prepareManualDelivery(input: {
  adminId: string;
  assignmentId: string;
  idempotencyKey: string;
}) {
  const row = await getOwnedAssignment(input.assignmentId, input.adminId);
  if (!row) throw new AppError(404, "ASSIGNMENT_NOT_FOUND", "No se ha encontrado la entrega.");
  if (!row.assignment.revealTokenCiphertext) {
    throw new AppError(409, "LEGACY_TOKEN", "Este enlace antiguo no se puede recuperar.");
  }

  const existing = await findNotificationByIdempotencyKey(input.idempotencyKey);
  if (!existing) {
    await createNotificationLog({
      assignmentId: row.assignment.id,
      channel: "manual",
      recipient: "manual",
      status: "manual",
      sentAt: new Date(),
      idempotencyKey: input.idempotencyKey
    });
  }

  const token = decryptRevealToken(row.assignment.revealTokenCiphertext);
  logger.info("notification.manual_prepared", {
    assignmentId: row.assignment.id,
    drawId: row.draw.id
  });
  return { revealUrl: buildRevealUrl(getEnv().appUrl, token) };
}
