import { phonePattern } from "@/lib/contact";
import type { APIRoute } from "astro";
import { z } from "zod";
import { createOwnedParticipant } from "@/actions/adminData";
import { handleApiError } from "@/lib/api";
import { logger } from "@/lib/logger";

const schema = z.object({
  familyId: z.uuid(),
  familyIslandId: z.uuid(),
  name: z.string().trim().min(1).max(180),
  email: z.union([z.email(), z.literal("")]).optional(),
  phone: z.union([z.string().trim().regex(phonePattern), z.literal("")]).optional(),
  preferredChannel: z.enum(["email", "whatsapp", "both"]).nullable().optional(),
  isBaby: z.boolean().default(false)
});

export const POST: APIRoute = async ({ locals, request }) => {
  try {
    const parsed = schema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return Response.json({ ok: false, message: "Datos de la persona no válidos." }, { status: 400 });
    const participant = await createOwnedParticipant(locals.admin.id, parsed.data);
    logger.info("participant.created", {
      familyId: participant.familyId,
      participantId: participant.id,
      islandId: participant.familyIslandId
    });
    return Response.json({ ok: true, data: participant }, { status: 201 });
  } catch (error) {
    return handleApiError("participant.create_failed", error, { adminId: locals.admin.id });
  }
};
