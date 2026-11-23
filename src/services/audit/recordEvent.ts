import { observe, logger, logCommitted } from "@/lib/logger";
import { db } from "@/db/client";
import { auditEvents } from "@/db/schema";
import { hasOptionalTable } from "@/db/capabilities";
import type { Transaction } from "@/db/locks";

type AuditInput = {
  event: "draw.generated" | "draw.revoked" | "assignment.link_copied" | "notifications.requested";
  actorAdminId: string;
  editionId: string;
  drawId: string;
  assignmentId?: string;
};

export async function recordAuditEvent(input: AuditInput, connection: typeof db | Transaction = db) {
  return observe("audit.record", { editionId: input.editionId, drawId: input.drawId, assignmentId: input.assignmentId }, async () => {
    if (await hasOptionalTable("audit_events", connection)) {
      await connection.insert(auditEvents).values(input);
      logCommitted("audit.persisted", { auditEvent: input.event, editionId: input.editionId, drawId: input.drawId, assignmentId: input.assignmentId, persisted: true });
    } else {
      logger.warn("audit.persistence_unavailable", { auditEvent: input.event, editionId: input.editionId, drawId: input.drawId, assignmentId: input.assignmentId, persisted: false });
    }

  }, undefined, { debug: true });
}
