import { AppError } from "./errors";
import { logger } from "./logger";
import { ZodError } from "zod";

export function handleApiError(event: string, error: unknown, fields: Record<string, string | number | boolean> = {}) {
  if (error instanceof ZodError) {
    logger.warn(event, { ...fields, status: 400, reason: "invalid_input" });
    return Response.json({ ok: false, message: "Los datos enviados no son válidos." }, { status: 400 });
  }

  if (error instanceof AppError) {
    logger.warn(event, { ...fields, status: error.status, reason: error.code });
    return Response.json(
      { ok: false, message: error.message, code: error.code },
      { status: error.status }
    );
  }

  const databaseError = error && typeof error === "object" && "cause" in error ? error.cause : error;
  if (databaseError && typeof databaseError === "object" && "code" in databaseError && databaseError.code === "23505") {
    logger.warn(event, { ...fields, status: 409, reason: "unique_conflict" });
    return Response.json({ ok: false, code: "RESOURCE_CONFLICT", message: "El recurso ya existe o cambió en otra operación. Recarga y vuelve a intentarlo." }, { status: 409 });
  }

  const errorId = logger.error(event, error, fields);
  return Response.json(
    { ok: false, message: "Ha ocurrido un error inesperado.", errorId },
    { status: 500 }
  );
}
