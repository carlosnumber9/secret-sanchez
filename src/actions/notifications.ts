import { and, eq, ne } from "drizzle-orm";
import { db } from "@/db/client";
import { drawEditions, draws, families } from "@/db/schema";
import { createNotificationLog, findNotificationByIdempotencyKey, listNotificationLogsForDraw, updateNotificationLog } from "@/db/queries/notifications";
import { getOwnedAssignment, listAssignmentsForDraw } from "@/db/queries/assignments";
import { AppError } from "@/lib/errors";
import { getEnv } from "@/lib/env";
import { logger } from "@/lib/logger";
import { buildRevealUrl, decryptRevealToken } from "@/lib/tokens";
import { buildNotificationAttemptKey } from "@/services/admin/policies";
import { isEligibleNotification } from "@/services/notifications/eligibility";
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
};

const successfulStatuses = new Set(["sent", "delivered", "read", "opened"]);

export async function sendAdminNotifications(input: SendInput) {
  const [owned] = await db.select({ edition: drawEditions, draw: draws })
    .from(drawEditions)
    .innerJoin(families, eq(drawEditions.familyId, families.id))
    .innerJoin(draws, and(eq(draws.editionId, drawEditions.id), ne(draws.status, "revoked")))
    .where(and(eq(drawEditions.id, input.editionId), eq(families.ownerAdminId, input.admin.id))).limit(1);
  if (!owned) throw new AppError(404, "DRAW_NOT_FOUND", "No hay un reparto vigente para esta edición.");

  const [allRows, logRows] = await Promise.all([listAssignmentsForDraw(owned.draw.id), listNotificationLogsForDraw(owned.draw.id)]);
  const selectedIds = new Set(input.assignmentIds ?? []);
  const rows = input.scope === "selected" ? allRows.filter(({ assignment }) => selectedIds.has(assignment.id)) : allRows;
  if (input.scope === "selected" && !rows.length) throw new AppError(422, "EMPTY_NOTIFICATION_SELECTION", "Selecciona al menos una entrega.");
  const logs = logRows.map(({ log }) => log);
  const { appUrl, kapsoTestRecipientPhone } = getEnv();
  let sent = 0;
  let failed = 0;
  let skipped = 0;

  for (const { assignment, giver, giverIsland } of rows) {
    if (!assignment.revealTokenCiphertext) { skipped += 1; continue; }
    const rawChannel = giver?.preferredChannel ?? giverIsland?.preferredChannel ?? null;
    const channel = rawChannel === "manual" ? null : rawChannel;
    const name = giver?.name ?? giverIsland?.representativeName ?? "Familia";
    const email = giver?.email ?? giverIsland?.representativeEmail ?? null;
    const phone = giver?.phone ?? giverIsland?.representativePhone ?? null;
    const channels: Array<"email" | "whatsapp"> = channel === "both" ? ["email", "whatsapp"] : channel ? [channel] : [];
    const revealUrl = buildRevealUrl(appUrl, decryptRevealToken(assignment.revealTokenCiphertext));

    for (const deliveryChannel of channels) {
      const latest = logs.find((log) => log.assignmentId === assignment.id && log.channel === deliveryChannel);
      if (!isEligibleNotification(latest?.status ?? null, input.mode)) { skipped += 1; continue; }
      const attemptKey = buildNotificationAttemptKey(input.idempotencyKey, assignment.id, deliveryChannel);
      if (await findNotificationByIdempotencyKey(attemptKey)) { skipped += 1; continue; }
      const recipient = deliveryChannel === "email"
        ? (owned.edition.kind === "test" ? input.admin.email : email)
        : (owned.edition.kind === "test" ? kapsoTestRecipientPhone : phone);
      if (!recipient) { failed += 1; continue; }
      const log = await createNotificationLog({ assignmentId: assignment.id, channel: deliveryChannel, recipient, status: "pending", idempotencyKey: attemptKey });
      try {
        const result = deliveryChannel === "email"
          ? await sendEmailNotification({ to: recipient, name, revealUrl, testMode: owned.edition.kind === "test" })
          : await sendWhatsappNotification({ phone: recipient, name, revealUrl });
        if (!result.ok) {
          failed += 1;
          await updateNotificationLog(log.id, { status: "failed", error: "provider_rejected" });
        } else {
          sent += 1;
          await updateNotificationLog(log.id, { status: "sent", providerMessageId: result.providerMessageId, sentAt: new Date(), error: null });
        }
      } catch (error) {
        failed += 1;
        const errorId = logger.error(`notification.${deliveryChannel}_exception`, error, { assignmentId: assignment.id, drawId: owned.draw.id });
        await updateNotificationLog(log.id, { status: "failed", error: `errorId:${errorId}` });
      }
    }
  }

  const currentLogs = (await listNotificationLogsForDraw(owned.draw.id)).map(({ log }) => log);
  const allCovered = allRows.every(({ assignment }) => currentLogs.some((log) => log.assignmentId === assignment.id && log.channel !== "manual" && successfulStatuses.has(log.status)));
  if (allCovered) {
    await db.transaction(async (tx) => {
      await tx.update(draws).set({ status: "sent" }).where(eq(draws.id, owned.draw.id));
      await tx.update(drawEditions).set({ status: "sent", updatedAt: new Date() }).where(eq(drawEditions.id, input.editionId));
    });
  }
  return { sent, failed, skipped, redirected: owned.edition.kind === "test", allCovered };
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
