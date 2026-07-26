import type { APIRoute } from "astro";
import { z } from "zod";
import { getAssignmentByTokenHash } from "@/db/queries/assignments";
import { handleApiError } from "@/lib/api";
import { AppError } from "@/lib/errors";
import { logger } from "@/lib/logger";
import { hashRevealToken } from "@/lib/tokens";

const schema = z.object({ token: z.string().min(20).max(200) });

export const POST: APIRoute = async ({ request }) => {
  try {
    const { token } = schema.parse(await request.json().catch(() => null));
    const row = await getAssignmentByTokenHash(hashRevealToken(token));
    if (!row?.giver) {
      logger.warn("reveal.resolve_rejected", { reason: "invalid_token" });
      throw new AppError(404, "REVEAL_NOT_FOUND", "Este enlace no parece válido.");
    }
    logger.info("reveal.resolved", {
      assignmentId: row.assignment.id,
      alreadyOpened: Boolean(row.assignment.openedAt)
    });
    return Response.json({
      ok: true,
      data: { giverName: row.giver.name, alreadyOpened: Boolean(row.assignment.openedAt) }
    });
  } catch (error) {
    return handleApiError("reveal.resolve_failed", error);
  }
};
