import { db } from "@/db/client";
import { auditEvents } from "@/db/schema";
import { hasOptionalTable } from "@/db/capabilities";
import type { Transaction } from "@/db/locks";
import { logger } from "@/lib/logger";

type AuditInput = {
  event: "draw.generated" | "draw.revoked" | "assignment.link_copied" | "notifications.requested";
  actorAdminId: string;
  editionId: string;
  drawId: string;
  assignmentId?: string;
};

export async function recordAuditEvent(input: AuditInput, connection: typeof db | Transaction = db) {
  if (await hasOptionalTable("audit_events", connection)) {
    await connection.insert(auditEvents).values(input);
  } else {
    logger.warn("audit.persistence_unavailable", { ...input, persisted: false });
  }
}
