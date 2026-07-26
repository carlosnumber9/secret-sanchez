import type { APIRoute } from "astro";
import { z } from "zod";
import { loginWithMagicLink } from "@/actions/loginWithMagicLink";
import { handleApiError } from "@/lib/api";
import { logger } from "@/lib/logger";

const schema = z.object({
  email: z.email()
});

export const POST: APIRoute = async ({ request }) => {
  try {
    const body = await request.json().catch(() => null);
    const parsed = schema.safeParse(body);

    if (!parsed.success) {
      logger.warn("auth.magic_link_rejected", { reason: "invalid_input" });
      return Response.json({ ok: false, message: "Escribe un email válido." }, { status: 400 });
    }

    const result = await loginWithMagicLink(parsed.data.email, new URL(request.url).origin);
    if (result.ok) logger.info("auth.magic_link_requested");
    else logger.warn("auth.magic_link_failed", { reason: "provider_rejected" });
    return Response.json(result, { status: result.ok ? 200 : 400 });
  } catch (error) {
    return handleApiError("auth.magic_link_exception", error);
  }
};
