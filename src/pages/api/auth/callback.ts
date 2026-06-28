import type { APIRoute } from "astro";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const schema = z
  .object({
    accessToken: z.string().optional(),
    refreshToken: z.string().optional(),
    code: z.string().optional()
  })
  .refine((value) => Boolean(value.code || (value.accessToken && value.refreshToken)), {
    message: "Faltan credenciales de Supabase."
  });

export const POST: APIRoute = async ({ cookies, request }) => {
  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);

  if (!parsed.success) {
    return Response.json({ ok: false, message: "El enlace de acceso no es válido." }, { status: 400 });
  }

  const supabase = createSupabaseServerClient(cookies);

  const { data, error } = parsed.data.code
    ? await supabase.auth.exchangeCodeForSession(parsed.data.code)
    : await supabase.auth.setSession({
        access_token: parsed.data.accessToken ?? "",
        refresh_token: parsed.data.refreshToken ?? ""
      });

  if (error || !data.session) {
    return Response.json(
      {
        ok: false,
        message: error?.message ?? "No he podido confirmar la sesión."
      },
      { status: 400 }
    );
  }

  return Response.json({ ok: true });
};
