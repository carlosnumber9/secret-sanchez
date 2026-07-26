import { randomUUID } from "node:crypto";

type LogValue = string | number | boolean | null | undefined;
type LogFields = Record<string, LogValue>;

const forbiddenFieldPattern = /(email|phone|name|token|hash|url|cookie|secret|key|recipient|payload)/i;
const errorTextLimit = 500;
const connectionUrlPattern = /\b[a-z][a-z0-9+.-]*:\/\/\S+/gi;
const emailPattern = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi;
const longCredentialPattern = /\b[A-Za-z0-9_-]{32,}\b/g;

function sanitizeFields(fields: LogFields) {
  return Object.fromEntries(
    Object.entries(fields).filter(([key, value]) => value !== undefined && !forbiddenFieldPattern.test(key))
  );
}

function sanitizeErrorText(value: string) {
  return value
    .replace(connectionUrlPattern, "[redacted-url]")
    .replace(emailPattern, "[redacted-email]")
    .replace(longCredentialPattern, "[redacted-credential]")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, errorTextLimit);
}

function getErrorCode(error: unknown) {
  if (!error || typeof error !== "object" || !("code" in error)) return undefined;
  const code = error.code;
  if (typeof code !== "string" && typeof code !== "number") return undefined;

  const normalized = String(code);
  return /^[A-Za-z0-9_.-]{1,80}$/.test(normalized) ? normalized : undefined;
}

function getErrorMessage(error: unknown) {
  if (!error || typeof error !== "object" || !("message" in error)) return undefined;
  return typeof error.message === "string" ? sanitizeErrorText(error.message) : undefined;
}

function getErrorType(error: unknown) {
  if (error instanceof Error) return error.name;
  if (!error || typeof error !== "object" || !("name" in error)) return "UnknownError";
  return typeof error.name === "string" ? sanitizeErrorText(error.name).slice(0, 80) : "UnknownError";
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
    errorMessage: getErrorMessage(error),
    causeType: cause ? getErrorType(cause) : undefined,
    causeCode: getErrorCode(cause),
    causeMessage: getErrorMessage(cause),
    rootCauseType: rootCause ? getErrorType(rootCause) : undefined,
    rootCauseCode: getErrorCode(rootCause),
    rootCauseMessage: getErrorMessage(rootCause)
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
