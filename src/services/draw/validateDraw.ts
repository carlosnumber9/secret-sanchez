import { canAssign, type DrawParticipant, type DrawRuleConfig } from "./rules";

export type AssignmentResult = {
  giverId: string;
  receiverId: string;
};

export function validateDraw(
  participants: DrawParticipant[],
  assignments: AssignmentResult[],
  config: DrawRuleConfig
) {
  const activeGivers = participants.filter((participant) => participant.active && participant.canGive);
  const activeReceivers = participants.filter((participant) => participant.active && participant.canReceive);
  const byId = new Map(participants.map((participant) => [participant.id, participant]));
  if (byId.size !== participants.length) return "Hay participantes duplicados.";

  if (assignments.length !== activeGivers.length) {
    return "No todos los participantes activos tienen receptor.";
  }

  const giverIds = new Set(assignments.map((assignment) => assignment.giverId));
  if (giverIds.size !== activeGivers.length || activeGivers.some((giver) => !giverIds.has(giver.id))) {
    return "Cada persona que regala debe aparecer exactamente una vez.";
  }

  const receiverIds = new Set(assignments.map((assignment) => assignment.receiverId));
  if (receiverIds.size !== assignments.length) {
    return "Hay al menos una persona recibiendo dos regalos.";
  }

  if (receiverIds.size !== activeReceivers.length) {
    return "El número de personas que regalan y reciben no coincide.";
  }

  for (const assignment of assignments) {
    const giver = byId.get(assignment.giverId);
    const receiver = byId.get(assignment.receiverId);
    if (!giver || !receiver || !canAssign(giver, receiver, config, new Set())) {
      return "Hay una asignación que incumple las reglas del sorteo.";
    }
  }

  return null;
}
