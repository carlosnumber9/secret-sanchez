import type { APIRoute } from "astro";
import { z } from "zod";
import { loginWithMagicLink } from "@/actions/loginWithMagicLink";

const schema = z.object({
  email: z.string().email()
});

export const POST: APIRoute = async ({ request }) => {
  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);

  if (!parsed.success) {
    return Response.json(
      {
        ok: false,
        message: "Escribe un email válido."
      },
      { status: 400 }
    );
  }

  const result = await loginWithMagicLink(parsed.data.email);
  return Response.json(result, { status: result.ok ? 200 : 400 });
};
