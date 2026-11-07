import type { APIRoute } from "astro";
import { z } from "zod";
import { getRevealPreparation } from "@/db/queries/assignments";
import { handleApiError } from "@/lib/api";
import { AppError } from "@/lib/errors";
import { logger } from "@/lib/logger";
import { hashRevealToken } from "@/lib/tokens";

const schema = z.object({ token: z.string().min(20).max(200) });

export const POST: APIRoute = async ({ request }) => {
  try {
    const { token } = schema.parse(await request.json().catch(() => null));
    const row = await getRevealPreparation(hashRevealToken(token));
    if (!row || !row.giverName) {
      logger.warn("reveal.resolve_rejected", { reason: "invalid_token" });
      throw new AppError(404, "REVEAL_NOT_FOUND", "Este enlace no parece válido.");
    }
    logger.info("reveal.resolved", {
      assignmentId: row.assignmentId,
      alreadyOpened: row.alreadyOpened
    });
    return Response.json({
      ok: true,
      data: {
        giverName: row.giverName,
        giverKind: row.giverKind,
        giverIslandName: row.giverIslandName,
        alreadyOpened: row.alreadyOpened
      }
    });
  } catch (error) {
    return handleApiError("reveal.resolve_failed", error);
  }
};
