import type { APIRoute } from "astro";
import { z } from "zod";
import { getAssignmentByTokenHash, markAssignmentOpened } from "@/db/queries/assignments";
import { handleApiError } from "@/lib/api";
import { AppError } from "@/lib/errors";
import { logger } from "@/lib/logger";
import { hashRevealToken } from "@/lib/tokens";

const schema = z.object({ token: z.string().min(20).max(200) });

export const POST: APIRoute = async ({ request }) => {
  try {
    const { token } = schema.parse(await request.json().catch(() => null));
    const row = await getAssignmentByTokenHash(hashRevealToken(token));
    if (!row?.receiver) {
      logger.warn("reveal.open_rejected", { reason: "invalid_token" });
      throw new AppError(404, "REVEAL_NOT_FOUND", "Este enlace no parece válido.");
    }
    const firstOpen = row.assignment.openedAt
      ? false
      : Boolean(await markAssignmentOpened(row.assignment.id));
    logger.info(firstOpen ? "reveal.opened" : "reveal.reopened", {
      assignmentId: row.assignment.id
    });
    return Response.json({ ok: true, data: { receiverName: row.receiver.name } });
  } catch (error) {
    return handleApiError("reveal.open_failed", error);
  }
};
