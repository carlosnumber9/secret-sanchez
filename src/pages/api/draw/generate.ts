import type { APIRoute } from "astro";
import { z } from "zod";
import { generateDraw as generatePersistedDraw } from "@/actions/generateDraw";
import { isDatabaseConfigured } from "@/lib/env";
import { demoGroup, demoParticipants } from "@/lib/demo";
import { generateDraw } from "@/services/draw/generateDraw";

const schema = z.object({
  groupId: z.string().optional()
});

export const POST: APIRoute = async ({ request }) => {
  const body = await request.json().catch(() => ({}));
  const parsed = schema.safeParse(body);

  if (!parsed.success) {
    return Response.json({ ok: false, message: "No he podido leer el sorteo." }, { status: 400 });
  }

  if (isDatabaseConfigured() && parsed.data.groupId && parsed.data.groupId !== demoGroup.id) {
    const result = await generatePersistedDraw({
      groupId: parsed.data.groupId,
      year: new Date().getFullYear()
    });
    return Response.json(
      {
        ok: result.ok,
        message: result.ok ? "Sorteo realizado. Los enlaces secretos ya están preparados." : result.message
      },
      { status: result.ok ? 200 : 422 }
    );
  }

  const result = generateDraw(demoParticipants, {
    noSameIsland: true,
    exclusions: []
  });

  return Response.json(
    {
      ok: result.ok,
      message: result.ok
        ? "Sorteo demo realizado. Al conectar Supabase se guardarán asignaciones y tokens reales."
        : result.message
    },
    { status: result.ok ? 200 : 422 }
  );
};
