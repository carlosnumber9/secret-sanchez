import { AsyncLocalStorage } from "node:async_hooks";
import { randomUUID } from "node:crypto";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { AppError } from "./errors";
import { diagnosticCodes, editableFields, events, operations, reasons, smtpCommands, stages, type LogEvent, type OperationName } from "./log-contract";
import { logSources } from "./log-sources";

type Rule<T> = (value: unknown) => T | undefined;
const uuid: Rule<string> = (v) => typeof v === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v) ? v : undefined;
const number: Rule<number> = (v) => typeof v === "number" && Number.isFinite(v) && v >= 0 ? v : undefined;
const boolean: Rule<boolean> = (v) => typeof v === "boolean" ? v : undefined;
const choice = <T extends string>(values: readonly T[]): Rule<T> => (v) => typeof v === "string" && values.includes(v as T) ? v as T : undefined;
const code: Rule<string> = (v) => choice(diagnosticCodes)(v) ?? (typeof v === "string" && /^[1-5][0-9]{2}$/.test(v) ? v : undefined);
const providerId: Rule<string> = (v) => typeof v === "string" && /^(?:[0-9a-f-]{36}|wamid\.[A-Za-z0-9+/=_-]{1,220}|synthetic-[0-9a-f-]{36}|<[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}@gmail\.com>)$/i.test(v) ? v : undefined;
const statuses = ["ready", "drawn", "archived", "draft", "generated", "locked", "sent", "revoked", "pending", "delivered", "failed", "opened", "read", "manual"] as const;
const fieldRules = {
  familyId: uuid, editionId: uuid, drawId: uuid, assignmentId: uuid, participantId: uuid, islandId: uuid,
  entityId: uuid, representativeParticipantId: uuid, notificationId: uuid, batchId: uuid, targetIslandId: uuid,
  providerMessageId: providerId, durationMs: number, status: (v: unknown) => number(v) ?? choice(statuses)(v),
  previousStatus: choice(statuses), nextStatus: choice(statuses), reason: (v: unknown) => choice(reasons)(v) ?? code(v),
  stage: choice(stages), transactionStage: choice(["work", "commit"]), authStage: choice(stages), channel: choice(["email", "whatsapp", "manual", "both"]), provider: choice(["gmail", "resend", "kapso", "supabase"]),
  smtpStatus: number, smtpCommand: choice(smtpCommands),
  operation: choice(operations), result: choice(["succeeded", "failed", "rejected", "skipped", "unknown", "accepted", "applied", "ignored", "retry"]),
  mode: choice(["pending", "failed", "force"]), scope: choice(["all", "selected"]), kind: choice(["test", "final", "island", "participant"]),
  view: choice(["configuration", "draw", "deliveries", "history", "census"]), strategy: choice(["move", "cascade"]),
  bucket: choice(["login", "logout", "reveal", "admin"]), table: choice(["audit_events", "request_rate_limits"]),
  assignmentType: choice(["participant", "familyIsland"]),
  auditEvent: choice(["draw.generated", "draw.revoked", "assignment.link_copied", "notifications.requested"]),
  changedFields: (v: unknown): string[] | undefined => Array.isArray(v) ? v.slice(0, 20).flatMap((key) => choice(editableFields)(key) ?? []) : undefined,
  participantCount: number, islandCount: number, editionCount: number, assignmentCount: number, adultAssignmentCount: number,
  babyAssignmentCount: number, exclusionCount: number, attemptNumber: number, affectedParticipants: number, affectedEditions: number,
  affectedDraws: number, affectedAssignments: number, affectedNotifications: number, openedCount: number, rowCount: number,
  createdCount: number, updatedCount: number, deletedCount: number, sent: number, failed: number, skipped: number, unknown: number,
  cursor: number, nextCursor: number, processed: number, total: number, retryAfterSeconds: number, httpStatus: number,
  suppressedCount: number, byteLimit: number, year: number,
  persisted: boolean, distributed: boolean, available: boolean, allowed: boolean, alreadyOpened: boolean, firstOpen: boolean,
  allCovered: boolean, testMode: boolean, redirected: boolean, noSameIsland: boolean, enabled: boolean, canGive: boolean,
  canReceive: boolean, isBaby: boolean, hasEmail: boolean, hasPhone: boolean, transactionPending: boolean, truncated: boolean
} as const;
export type LogFields = { [K in keyof typeof fieldRules]?: ReturnType<typeof fieldRules[K]> | null };
export type Actor =
  | { actorType: "unknown" | "anonymous" | "system"; identityReason: typeof reasons[number] }
  | { actorType: "authenticated"; authUserId: string }
  | { actorType: "admin"; adminId: string; authUserId: string }
  | { actorType: "reveal_link"; assignmentId: string }
  | { actorType: "provider"; provider: "resend" | "kapso" };
interface LogContext {
  requestId?: string; route?: string; method?: string; actor: Actor;
  operationId?: string; parentOperationId?: string; operation?: OperationName;
  fields: LogFields; budget: { debug: number; suppressed: number };
  diagnostics: { errors: WeakMap<object, string>; lastErrorId?: string };
  transaction?: { stage: "work" | "commit"; afterCommit: Array<() => void> };
}
const storage = new AsyncLocalStorage<LogContext>();
const registeredEvents = new Set<string>(events);
for (const operation of operations) for (const suffix of ["started", "succeeded", "failed", "slow"]) registeredEvents.add(`${operation}.${suffix}`);
const errorTypes = choice(["Error", "TypeError", "RangeError", "SyntaxError", "AppError", "AuthCheckError", "PostgresError", "DrizzleQueryError", "AbortError", "TimeoutError", "NotificationRateLimitError", "UnknownError"]);
const levels = { debug: 0, info: 1, warn: 2, error: 3 } as const;
type Level = keyof typeof levels;

function clean(fields: LogFields): Record<string, unknown> {
  const output: Record<string, unknown> = {};
  for (const key of Object.keys(fieldRules) as Array<keyof LogFields>) {
    const descriptor = Object.getOwnPropertyDescriptor(fields, key);
    if (!descriptor || !("value" in descriptor)) continue;
    const value = fieldRules[key](descriptor.value);
    if (value !== undefined) output[key] = value;
  }
  const changed = Object.getOwnPropertyDescriptor(fields, "changedFields")?.value;
  if (Array.isArray(changed) && changed.length > 20) output.truncated = true;
  return output;
}
function cleanActor(actor: Actor): Record<string, unknown> {
  switch (actor.actorType) {
    case "admin": return uuid(actor.adminId) && uuid(actor.authUserId) ? { actorType: "admin", adminId: actor.adminId, authUserId: actor.authUserId } : { actorType: "unknown", identityReason: "not_resolved" };
    case "authenticated": return uuid(actor.authUserId) ? { actorType: "authenticated", authUserId: actor.authUserId } : { actorType: "unknown", identityReason: "not_resolved" };
    case "reveal_link": return uuid(actor.assignmentId) ? { actorType: "reveal_link", assignmentId: actor.assignmentId } : { actorType: "unknown", identityReason: "not_resolved" };
    case "provider": return { actorType: "provider", provider: choice(["resend", "kapso"])(actor.provider) };
    default: return { actorType: choice(["unknown", "anonymous", "system"])(actor.actorType) ?? "unknown", identityReason: choice(reasons)(actor.identityReason) ?? "not_resolved" };
  }
}
// Only known source filenames are accepted; stack messages and absolute paths are discarded.
function frames(error: object) {
  const stack: unknown = Reflect.get(error, "stack");
  if (typeof stack !== "string") return [];
  return stack.slice(0, 16384).split("\n").slice(1, 30).flatMap((line: string) => {
    const match = /((?:file:\/\/)?\/[^\s()]+):(\d+):(\d+)\)?$/.exec(line);
    if (!match) return [];
    const path = match[1].startsWith("file:") ? fileURLToPath(match[1]) : match[1];
    const source = /\/(src\/[^:]+\.(?:ts|tsx|astro))$/.exec(path)?.[1];
    const modulePath = fileURLToPath(import.meta.url);
    const marker = modulePath.lastIndexOf("/dist/server/");
    const serverRoot = marker >= 0 ? modulePath.slice(0, marker) + "/dist/server/" : undefined;
    const bundle = serverRoot && path.startsWith(serverRoot) && existsSync(path) ? path.slice(marker + 1) : undefined;
    const file = source && logSources.has(source) ? source : bundle && /^dist\/server\/(?:chunks|pages)\/[A-Za-z0-9_./\[\]-]+\.mjs$/.test(bundle) && !bundle.includes("..") ? bundle : undefined;
    return file ? [{ file, line: Number(match[2]), column: Number(match[3]) }] : [];
  }).slice(0, 4);
}
function diagnostics(error: unknown) {
  const chain: Array<Record<string, unknown>> = [];
  const seen = new Set<object>();
  let current = error;
  for (let depth = 0; depth < 3 && current && typeof current === "object" && !seen.has(current); depth++) {
    seen.add(current);
    const read = (key: string): unknown => { try { return Reflect.get(current as object, key); } catch { return undefined; } };
    const errorCode = read("code");
    chain.push({ type: errorTypes(read("name")) ?? "UnknownError", code: code(typeof errorCode === "number" ? String(errorCode) : errorCode), frames: frames(current) });
    current = read("cause");
  }
  const [first, cause, root] = chain;
  return { errorType: first?.type ?? "UnknownError", errorCode: first?.code, causeType: cause?.type, causeCode: cause?.code, rootCauseType: root?.type, rootCauseCode: root?.code, errorChain: chain };
}
function write(level: Level, event: LogEvent, fields: LogFields, diagnostic?: Record<string, unknown>) {
  try {
    const threshold = choice(Object.keys(levels) as Level[])(process.env.LOG_LEVEL ?? import.meta.env?.LOG_LEVEL) ?? "info";
    if (levels[level] < levels[threshold]) return;
    const context = storage.getStore();
    if (level === "debug" && context && context.budget.debug++ >= 64) { context.budget.suppressed++; return; }
    const safeEvent = registeredEvents.has(event) ? event : "logging.invalid_event";
    const environment = choice(["development", "preview", "production", "test"])(process.env.VERCEL_ENV || import.meta.env?.VERCEL_ENV || process.env.APP_ENV || import.meta.env?.APP_ENV) ?? "development";
    const deployment = /^dpl_[A-Za-z0-9]{1,100}$/.test(process.env.VERCEL_DEPLOYMENT_ID ?? "") ? process.env.VERCEL_DEPLOYMENT_ID : undefined;
    const payload = {
      ...clean(context?.fields ?? {}), ...clean(fields),
      schemaVersion: 1, timestamp: new Date().toISOString(), level, event: safeEvent, message: safeEvent, environment, deployment,
      requestId: context?.requestId, route: context?.route, method: context?.method,
      operationId: context?.operationId, parentOperationId: context?.parentOperationId, operation: context?.operation,
      ...cleanActor(context?.actor ?? { actorType: "system", identityReason: "no_context" }), ...diagnostic
    };
    let line = JSON.stringify(payload);
    if (Buffer.byteLength(line) > 8192) line = JSON.stringify({ ...payload, errorChain: undefined, changedFields: undefined, truncated: true });
    if (Buffer.byteLength(line) > 8192) return;
    if (level === "error") console.error(line);
    else if (level === "warn") console.warn(line);
    else console.log(line);
  } catch { /* Logging must not change the outcome of application work. */ }
}
export const logger = {
  debug(event: LogEvent, fields: LogFields = {}) { write("debug", event, fields); },
  info(event: LogEvent, fields: LogFields = {}) { write("info", event, fields); },
  warn(event: LogEvent, fields: LogFields = {}) { write("warn", event, fields); },
  error(event: LogEvent, error: unknown, fields: LogFields = {}) {
    const context = storage.getStore();
    if (error && typeof error === "object") {
      let current: unknown = error;
      for (let depth = 0; depth < 3 && current && typeof current === "object"; depth++) {
        const existing = context?.diagnostics.errors.get(current);
        if (existing && context) { context.diagnostics.errors.set(error, existing); context.diagnostics.lastErrorId = existing; return existing; }
        try { current = Reflect.get(current, "cause"); } catch { break; }
      }
    }
    const errorId = randomUUID();
    if (context) {
      context.diagnostics.lastErrorId = errorId;
      if (error && typeof error === "object") context.diagnostics.errors.set(error, errorId);
    }
    let details: Record<string, unknown> = {};
    try { details = diagnostics(error); } catch { /* Ignore malformed diagnostics. */ }
    write("error", event, fields, { ...details, errorId });
    return errorId;
  }
};
export function setLogActor(actor: Actor) { const context = storage.getStore(); if (context) context.actor = actor; }
export function addLogFields(fields: LogFields) { const context = storage.getStore(); if (context) Object.assign(context.fields, clean(fields)); }
export function logCommitted(event: LogEvent, fields: LogFields = {}) {
  const context = storage.getStore();
  const emit = () => context ? storage.run(context, () => logger.info(event, fields)) : logger.info(event, fields);
  if (context?.transaction) context.transaction.afterCommit.push(emit); else emit();
}
export function logStage(stage: NonNullable<LogFields["stage"]>, fields: LogFields = {}) { addLogFields({ stage }); logger.info("draw.stage", { ...fields, stage, transactionPending: Boolean(storage.getStore()?.transaction) }); }
export function withLogFields<T>(fields: LogFields, work: () => T): T {
  const parent = storage.getStore();
  const base: LogContext = parent ?? { actor: { actorType: "system", identityReason: "no_context" }, fields: {}, budget: { debug: 0, suppressed: 0 }, diagnostics: { errors: new WeakMap() } };
  return storage.run({ ...base, fields: { ...base.fields, ...fields } }, work);
}
export async function observe<T>(operation: OperationName, fields: LogFields, work: () => PromiseLike<T> | T, summary?: (result: T) => LogFields, options: { debug?: boolean; provider?: boolean } = {}): Promise<T> {
  return withLogFields(fields, async () => {
    const parent = storage.getStore()!;
    return storage.run({ ...parent, operation, operationId: randomUUID(), parentOperationId: parent.operationId, fields: { ...parent.fields } }, async () => {
      const start = performance.now();
      const emit = options.debug ? logger.debug : logger.info;
      emit(`${operation}.started`);
      try {
        const result = await work();
        let resultFields: LogFields = {};
        try { resultFields = summary?.(result) ?? {}; } catch { /* A summary cannot invalidate successful work. */ }
        const durationMs = Math.round(performance.now() - start);
        const completedContext = storage.getStore()!;
        const complete = () => storage.run(completedContext, () => emit(`${operation}.succeeded`, { result: "succeeded", ...resultFields, durationMs }));
        const transaction = storage.getStore()?.transaction;
        if (transaction) transaction.afterCommit.push(complete); else complete();
        if (!options.provider && durationMs > 1000) logger.warn(`${operation}.slow`, { durationMs });
        return result;
      } catch (error) {
        const durationMs = Math.round(performance.now() - start);
        if (error instanceof AppError) logger.warn(`${operation}.failed`, { durationMs, status: error.status, reason: error.code, result: "rejected" });
        else if (error instanceof Error && error.name === "NotificationRateLimitError") logger.warn(`${operation}.failed`, { durationMs, reason: "rate_limited", result: "retry" });
        else logger.error(`${operation}.failed`, error, { durationMs, result: "failed" });
        throw error;
      }
    });
  });
}
// Mark callback completion separately from the database's commit acknowledgement.
export async function observeTransaction<T>(execute: (workCompleted: () => void) => Promise<T>): Promise<T> {
  return withLogFields({}, async () => {
    const context = storage.getStore()!;
    const transaction: NonNullable<LogContext["transaction"]> = { stage: "work", afterCommit: [] };
    return storage.run({ ...context, transaction }, async () => {
      logger.debug("transaction.started");
      try {
        const result = await execute(() => { transaction.stage = "commit"; });
        logger.debug("transaction.committed", { stage: "commit" });
        for (const complete of transaction.afterCommit) complete();
        return result;
      } catch (error) {
        const fields: LogFields = { transactionStage: transaction.stage, stage: transaction.stage === "commit" ? "commit" : storage.getStore()?.fields.stage ?? "work", reason: transaction.stage === "commit" ? "commit_failed" : "rollback" };
        if (error instanceof AppError) logger.warn("transaction.failed", { ...fields, status: error.status });
        else logger.error("transaction.failed", error, fields);
        throw error;
      }
    });
  });
}
export async function traceRequest(input: { route: string; method: string }, work: () => Promise<Response>): Promise<Response> {
  const requestId = randomUUID();
  const route = /^\/[A-Za-z0-9_/\[\].-]{0,180}$/.test(input.route) && !input.route.includes("..") ? input.route : "/[unmatched]";
  const method = choice(["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"])(input.method) ?? "OTHER";
  return storage.run({ requestId, route, method, actor: { actorType: "unknown", identityReason: "not_resolved" }, fields: {}, budget: { debug: 0, suppressed: 0 }, diagnostics: { errors: new WeakMap() } }, async () => {
    const start = performance.now();
    logger.info("request.started");
    let response: Response;
    try { response = await work(); }
    catch (error) {
      const errorId = logger.error("request.failed", error);
      response = route.startsWith("/api/") ? Response.json({ ok: false, message: "Ha ocurrido un error inesperado.", errorId }, { status: 500 }) : new Response("Ha ocurrido un error inesperado.", { status: 500 });
    }
    const context = storage.getStore()!;
    if (context.budget.suppressed) logger.info("logging.debug_suppressed", { suppressedCount: context.budget.suppressed });
    write(response.status >= 500 ? "error" : response.status >= 400 ? "warn" : "info", "request.completed", { status: response.status, durationMs: Math.round(performance.now() - start), result: response.status >= 400 ? "failed" : "succeeded" }, context.diagnostics.lastErrorId ? { errorId: context.diagnostics.lastErrorId } : undefined);
    const headers = new Headers(response.headers);
    headers.set("X-Request-Id", requestId);
    return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
  });
}
