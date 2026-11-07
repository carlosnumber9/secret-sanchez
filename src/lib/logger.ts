import { randomUUID } from "node:crypto";

type LogValue = string | number | boolean | null | undefined;
type LogFields = Record<string, LogValue>;

const forbiddenFieldPattern = /(email|phone|name|token|hash|url|cookie|secret|key|recipient|payload|password|credential|authorization)/i;
const allowedErrorTypes = new Set(["Error", "TypeError", "RangeError", "SyntaxError", "AppError", "AuthCheckError", "PostgresError", "DrizzleQueryError", "AbortError", "TimeoutError"]);

function sanitizeFields(fields: LogFields) {
  return Object.fromEntries(
    Object.entries(fields).filter(([key, value]) => value !== undefined && !forbiddenFieldPattern.test(key))
  );
}

function getErrorCode(error: unknown) {
  if (!error || typeof error !== "object" || !("code" in error)) return undefined;
  const code = error.code;
  if (typeof code !== "string" && typeof code !== "number") return undefined;

  const normalized = String(code);
  return /^(?:[0-9A-Z]{5}|E[A-Z_]{1,32}|[1-5][0-9]{2})$/.test(normalized) ? normalized : undefined;
}

function getErrorType(error: unknown) {
  if (!error || typeof error !== "object" || !("name" in error)) return "UnknownError";
  return typeof error.name === "string" && allowedErrorTypes.has(error.name) ? error.name : "UnknownError";
}

function getErrorCause(error: unknown) {
  if (!error || typeof error !== "object" || !("cause" in error)) return undefined;
  return error.cause;
}

function getErrorFields(error: unknown): LogFields {
  const cause = getErrorCause(error);
  const rootCause = getErrorCause(cause);

  return {
    errorType: getErrorType(error),
    errorCode: getErrorCode(error),
    causeType: cause ? getErrorType(cause) : undefined,
    causeCode: getErrorCode(cause),
    rootCauseType: rootCause ? getErrorType(rootCause) : undefined,
    rootCauseCode: getErrorCode(rootCause)
  };
}

function write(level: "info" | "warn" | "error", event: string, fields: LogFields) {
  const payload = JSON.stringify({
    level,
    message: event,
    event,
    timestamp: new Date().toISOString(),
    ...sanitizeFields(fields)
  });

  if (level === "error") console.error(payload);
  else if (level === "warn") console.warn(payload);
  else console.log(payload);
}

export const logger = {
  info(event: string, fields: LogFields = {}) {
    write("info", event, fields);
  },
  warn(event: string, fields: LogFields = {}) {
    write("warn", event, fields);
  },
  error(event: string, error: unknown, fields: LogFields = {}) {
    const errorId = randomUUID();
    write("error", event, {
      ...fields,
      errorId,
      ...getErrorFields(error)
    });
    return errorId;
  }
};
