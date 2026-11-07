import { and, eq, ne } from "drizzle-orm";
import { db } from "@/db/client";
import { drawEditions, draws, families } from "@/db/schema";
import { claimNotificationAttempt, listCurrentNotificationLogsForDraw, updateNotificationLog } from "@/db/queries/notifications";
import { getOwnedAssignment, listAssignmentsForDraw } from "@/db/queries/assignments";
import { AppError } from "@/lib/errors";
import { getEnv } from "@/lib/env";
import { logger } from "@/lib/logger";
import { buildRevealUrl, decryptRevealToken } from "@/lib/tokens";
import { buildNotificationAttemptKey } from "@/services/admin/policies";
import { NotificationRateLimitError } from "@/services/notifications/retry";
import { mapConcurrent } from "@/lib/concurrency";
import { sendEmailNotification } from "@/services/notifications/sendEmailNotification";
import { sendWhatsappNotification } from "@/services/notifications/sendWhatsappNotification";

type SendInput = {
  admin: {
    id: string;
    email: string;
  };
  editionId: string;
  mode: "pending" | "failed" | "force";
  scope: "all" | "selected";
  assignmentIds?: string[];
  idempotencyKey: string;
  cursor?: number;
  drawId?: string;
};

const successfulStatuses = new Set(["sent", "delivered", "read", "opened"]);

export async function sendAdminNotifications(input: SendInput, transports = { email: sendEmailNotification, whatsapp: sendWhatsappNotification }) {
  const [owned] = await db.select({ edition: drawEditions, draw: draws })
    .from(drawEditions)
    .innerJoin(families, eq(drawEditions.familyId, families.id))
    .innerJoin(draws, and(eq(draws.editionId, drawEditions.id), ne(draws.status, "revoked")))
    .where(and(eq(drawEditions.id, input.editionId), eq(families.ownerAdminId, input.admin.id))).limit(1);
  if (!owned) throw new AppError(404, "DRAW_NOT_FOUND", "No hay un reparto vigente para esta edición.");
  if (input.drawId && input.drawId !== owned.draw.id) throw new AppError(409, "DRAW_CHANGED", "El reparto cambió. Recarga el panel antes de enviar.");

  const allRows = (await listAssignmentsForDraw(owned.draw.id)).sort((a, b) => a.assignment.id.localeCompare(b.assignment.id));
  const selectedIds = new Set(input.assignmentIds ?? []);
  const rows = input.scope === "selected" ? allRows.filter(({ assignment }) => selectedIds.has(assignment.id)) : allRows;
  if (input.scope === "selected" && !rows.length) throw new AppError(422, "EMPTY_NOTIFICATION_SELECTION", "Selecciona al menos una entrega.");
  const { appUrl, kapsoTestRecipientPhone } = getEnv();
  let sent = 0;
  let failed = 0;
  let skipped = 0;
  let unknown = 0;
  let retryAfterSeconds = 0;
  let nextSendAt = Date.now();
  const jobs = rows.flatMap((row) => {
    const channel = row.giver?.preferredChannel ?? row.giverIsland?.preferredChannel;
    const channels: Array<"email" | "whatsapp"> = channel === "both" ? ["email", "whatsapp"] : channel === "email" || channel === "whatsapp" ? [channel] : [];
    return channels.map((deliveryChannel) => ({ row, deliveryChannel }));
  });
  const cursor = Math.min(input.cursor ?? 0, jobs.length);
  const batch = jobs.slice(cursor, cursor + 4);
  await mapConcurrent(batch, 2, async ({ row: { assignment, giver, giverIsland }, deliveryChannel }) => {
    if (retryAfterSeconds) { skipped++; return; }
    if (!assignment.revealTokenCiphertext) { skipped++; return; }
    const name = giver?.name ?? giverIsland?.representativeName ?? "Familia";
    const recipient = deliveryChannel === "email"
      ? (owned.edition.kind === "test" ? input.admin.email : giver?.email ?? giverIsland?.representativeEmail)
      : (owned.edition.kind === "test" ? kapsoTestRecipientPhone : giver?.phone ?? giverIsland?.representativePhone);
    if (!recipient) { failed++; return; }
    const attemptKey = buildNotificationAttemptKey(input.idempotencyKey, assignment.id, deliveryChannel);
    const log = await claimNotificationAttempt({ assignmentId: assignment.id, channel: deliveryChannel, recipient, mode: input.mode, idempotencyKey: attemptKey });
    if (!log) { skipped++; return; }
    const slot = Math.max(Date.now(), nextSendAt);
    nextSendAt = slot + 550;
    await new Promise((resolve) => setTimeout(resolve, Math.max(0, slot - Date.now())));
    const [current] = await db.select({ id: draws.id }).from(draws)
      .where(and(eq(draws.id, owned.draw.id), ne(draws.status, "revoked"))).limit(1);
    if (!current) {
      await updateNotificationLog(log.id, { status: "failed", error: "draw_revoked" });
      throw new AppError(409, "DRAW_REVOKED", "El reparto fue anulado. Se han detenido los envíos pendientes.");
    }
    try {
      if (retryAfterSeconds) throw new NotificationRateLimitError(String(retryAfterSeconds));
      const revealUrl = buildRevealUrl(appUrl, decryptRevealToken(assignment.revealTokenCiphertext));
      const result = deliveryChannel === "email"
        ? await transports.email({ to: log.recipient, name, revealUrl, idempotencyKey: log.idempotencyKey ?? undefined, testMode: owned.edition.kind === "test" })
        : await transports.whatsapp({ phone: log.recipient, name, revealUrl });
      if (!result.ok) {
        failed++;
        await updateNotificationLog(log.id, { status: "failed", error: "provider_rejected" });
      } else {
        sent++;
        await updateNotificationLog(log.id, { status: "sent", providerMessageId: result.providerMessageId, sentAt: new Date(), error: null });
      }
    } catch (error) {
      if (error instanceof NotificationRateLimitError) {
        retryAfterSeconds = Math.max(retryAfterSeconds, error.retryAfterSeconds);
        await updateNotificationLog(log.id, { status: "pending", error: `rate_limited:${Date.now() + retryAfterSeconds * 1000}` });
      } else {
        unknown++;
        const errorId = logger.error(`notification.${deliveryChannel}_exception`, error, { assignmentId: assignment.id, drawId: owned.draw.id });
        await updateNotificationLog(log.id, { status: "pending", error: `outcome_unknown:${errorId}` });
      }
    }
  });

  const currentLogs = (await listCurrentNotificationLogsForDraw(owned.draw.id)).map(({ log }) => log);
  const coveredAssignments = new Set(currentLogs.filter((log) => log.channel !== "manual" && successfulStatuses.has(log.status)).map((log) => log.assignmentId));
  const allCovered = allRows.length > 0 && allRows.every(({ assignment }) => coveredAssignments.has(assignment.id));
  let finalized = false;
  if (allCovered) {
    finalized = await db.transaction(async (tx) => {
      await tx.select({ id: drawEditions.id }).from(drawEditions)
        .where(eq(drawEditions.id, input.editionId)).for("update");
      const [current] = await tx.update(draws).set({ status: "sent" })
        .where(and(eq(draws.id, owned.draw.id), ne(draws.status, "revoked"))).returning({ id: draws.id });
      if (!current) return false;
      await tx.update(drawEditions).set({ status: "sent", updatedAt: new Date() }).where(eq(drawEditions.id, input.editionId));
      return true;
    });
  }
  const end = cursor + batch.length;
  return { drawId: owned.draw.id, sent, failed, skipped, unknown, retryAfterSeconds, nextCursor: retryAfterSeconds ? cursor : end < jobs.length ? end : null, processed: end, total: jobs.length, redirected: owned.edition.kind === "test", allCovered: finalized };
}

export async function prepareManualDelivery(input: { adminId: string; assignmentId: string }) {
  const row = await getOwnedAssignment(input.assignmentId, input.adminId);
  if (!row) throw new AppError(404, "ASSIGNMENT_NOT_FOUND", "No se ha encontrado la entrega.");
  if (row.draw.status === "revoked") throw new AppError(409, "DRAW_REVOKED", "Este reparto está anulado.");
  if (!row.assignment.revealTokenCiphertext) throw new AppError(409, "LEGACY_TOKEN", "Este enlace antiguo no se puede recuperar.");
  const token = decryptRevealToken(row.assignment.revealTokenCiphertext);
  logger.info("assignment_link_copied", {
    adminUserId: input.adminId,
    editionId: row.edition.id,
    drawId: row.draw.id,
    assignmentId: row.assignment.id,
    assignmentType: row.giver ? "participant" : "familyIsland",
    participantId: row.giver?.sourceParticipantId,
    islandId: row.giverIsland?.sourceFamilyIslandId,
    representativeParticipantId: row.giverIsland?.representativeSourceParticipantId
  });
  return { revealUrl: buildRevealUrl(getEnv().appUrl, token), testMode: row.edition.kind === "test" };
}
