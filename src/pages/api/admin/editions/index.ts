import type { APIRoute } from "astro";
import { z } from "zod";
import { createOwnedEdition, listOwnedEditions } from "@/actions/editionData";
import { handleApiError } from "@/lib/api";

const schema = z.object({
  familyId: z.uuid(),
  name: z.string().trim().min(2).max(180),
  year: z.number().int().min(2020).max(2100),
  kind: z.enum(["test", "final"])
});

export const GET: APIRoute = async ({ locals }) => Response.json({ ok: true, data: await listOwnedEditions(locals.admin.id) });

export const POST: APIRoute = async ({ locals, request }) => {
  try {
    const input = schema.parse(await request.json().catch(() => null));
    return Response.json({ ok: true, data: await createOwnedEdition(locals.admin.id, input) }, { status: 201 });
  } catch (error) {
    return handleApiError("edition.create_failed", error, { adminId: locals.admin.id });
  }
};
