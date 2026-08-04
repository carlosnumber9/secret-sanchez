import { and, eq, ne } from "drizzle-orm";
import { db } from "@/db/client";
import { adminUsers, drawEditions, draws, families } from "@/db/schema";
import { createNotificationLog, findNotificationByIdempotencyKey, listNotificationLogsForDraw, updateNotificationLog } from "@/db/queries/notifications";
import { getOwnedAssignment, listAssignmentsForDraw } from "@/db/queries/assignments";
import { AppError } from "@/lib/errors";
import { getEnv } from "@/lib/env";
import { logger } from "@/lib/logger";
import { buildRevealUrl, decryptRevealToken } from "@/lib/tokens";
import { buildNotificationAttemptKey } from "@/services/admin/policies";
import { isEligibleNotification } from "@/services/notifications/eligibility";
import { sendEmailNotification } from "@/services/notifications/sendEmailNotification";

export async function sendAdminNotifications(input: { adminId: string; editionId: string; mode: "pending" | "failed"; idempotencyKey: string }) {
  const [owned] = await db.select({ edition: drawEditions, draw: draws, adminEmail: adminUsers.email })
    .from(drawEditions)
    .innerJoin(families, eq(drawEditions.familyId, families.id))
    .innerJoin(draws, and(eq(draws.editionId, drawEditions.id), ne(draws.status, "revoked")))
    .innerJoin(adminUsers, eq(families.ownerAdminId, adminUsers.id))
    .where(and(eq(drawEditions.id, input.editionId), eq(families.ownerAdminId, input.adminId))).limit(1);
  if (!owned) throw new AppError(404, "DRAW_NOT_FOUND", "No hay un reparto vigente para esta edición.");

  const [rows, logRows] = await Promise.all([listAssignmentsForDraw(owned.draw.id), listNotificationLogsForDraw(owned.draw.id)]);
  const logs = logRows.map(({ log }) => log);
  let sent = 0;
  let failed = 0;
  let skipped = 0;

  for (const { assignment, giver } of rows) {
    if (giver.preferredChannel !== "email" || !giver.email || !assignment.revealTokenCiphertext) {
      skipped += 1;
      continue;
    }
    const latest = logs.find((log) => log.assignmentId === assignment.id && log.channel === "email");
    if (!isEligibleNotification(latest?.status ?? null, input.mode)) {
      skipped += 1;
      continue;
    }
    const attemptKey = buildNotificationAttemptKey(input.idempotencyKey, assignment.id, "email");
    if (await findNotificationByIdempotencyKey(attemptKey)) {
      skipped += 1;
      continue;
    }
    const recipient = owned.edition.kind === "test" ? owned.adminEmail : giver.email;
    const log = await createNotificationLog({ assignmentId: assignment.id, channel: "email", recipient, status: "pending", idempotencyKey: attemptKey });
    try {
      const token = decryptRevealToken(assignment.revealTokenCiphertext);
      const result = await sendEmailNotification({
        to: recipient,
        name: giver.name,
        revealUrl: buildRevealUrl(getEnv().appUrl, token),
        testMode: owned.edition.kind === "test"
      });
      if (!result.ok) {
        failed += 1;
        await updateNotificationLog(log.id, { status: "failed", error: "provider_rejected" });
      } else {
        sent += 1;
        await updateNotificationLog(log.id, { status: "sent", providerMessageId: result.providerMessageId, sentAt: new Date(), error: null });
      }
    } catch (error) {
      failed += 1;
      const errorId = logger.error("notification.email_exception", error, { assignmentId: assignment.id, drawId: owned.draw.id });
      await updateNotificationLog(log.id, { status: "failed", error: `errorId:${errorId}` });
    }
  }
  if (sent > 0 && failed === 0) {
    await db.transaction(async (tx) => {
      await tx.update(draws).set({ status: "sent" }).where(eq(draws.id, owned.draw.id));
      await tx.update(drawEditions).set({ status: "sent", updatedAt: new Date() }).where(eq(drawEditions.id, input.editionId));
    });
  }
  return { sent, failed, skipped, redirected: owned.edition.kind === "test" };
}

export async function prepareManualDelivery(input: { adminId: string; assignmentId: string; idempotencyKey: string }) {
  const row = await getOwnedAssignment(input.assignmentId, input.adminId);
  if (!row) throw new AppError(404, "ASSIGNMENT_NOT_FOUND", "No se ha encontrado la entrega.");
  if (row.draw.status === "revoked") throw new AppError(409, "DRAW_REVOKED", "Este reparto está anulado.");
  if (!row.assignment.revealTokenCiphertext) throw new AppError(409, "LEGACY_TOKEN", "Este enlace antiguo no se puede recuperar.");
  if (!(await findNotificationByIdempotencyKey(input.idempotencyKey))) {
    await createNotificationLog({ assignmentId: row.assignment.id, channel: "manual", recipient: "manual", status: "manual", sentAt: new Date(), idempotencyKey: input.idempotencyKey });
  }
  const token = decryptRevealToken(row.assignment.revealTokenCiphertext);
  return { revealUrl: buildRevealUrl(getEnv().appUrl, token), testMode: row.edition.kind === "test" };
}
