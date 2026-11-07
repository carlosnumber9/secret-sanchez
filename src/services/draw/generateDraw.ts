import { canAssign, type DrawParticipant, type DrawRuleConfig } from "./rules";
import { validateDraw, type AssignmentResult } from "./validateDraw";
import { matchBipartite } from "./matchBipartite";

export type GenerateDrawResult = { ok: true; assignments: AssignmentResult[] } | { ok: false; message: string };

export function generateDraw(participants: DrawParticipant[], config: DrawRuleConfig): GenerateDrawResult {
  const givers = participants.filter((p) => p.active && p.canGive);
  const receivers = participants.filter((p) => p.active && p.canReceive);
  if (givers.length < 2) return { ok: false, message: "Hace falta al menos dos personas activas para repartir." };
  if (givers.length !== receivers.length) return { ok: false, message: "El número de personas que pueden regalar y recibir debe coincidir." };
  if (givers.length > 500) return { ok: false, message: "El sorteo admite hasta 500 regaladores activos." };
  const byId = new Map(participants.map((p) => [p.id, p]));
  const exclusions = new Map<string, Set<string>>();
  for (const rule of config.exclusions) {
    if (!exclusions.has(rule.fromParticipantId)) exclusions.set(rule.fromParticipantId, new Set());
    exclusions.get(rule.fromParticipantId)!.add(rule.toParticipantId);
  }
  const unused = new Set<string>();
  const pairs = matchBipartite(givers.map((p) => p.id), receivers.map((p) => p.id),
    (giver, receiver) => canAssign(byId.get(giver)!, byId.get(receiver)!, config, unused, exclusions));
  if (!pairs) return { ok: false, message: "No hay un reparto posible con las reglas actuales. Prueba a revisar núcleos familiares o exclusiones manuales." };
  const assignments = pairs.map(({ left, right }) => ({ giverId: left, receiverId: right }));
  const error = validateDraw(participants, assignments, config);
  return error ? { ok: false, message: error } : { ok: true, assignments };
}
