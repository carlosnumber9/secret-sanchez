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

  if (assignments.length !== activeGivers.length) {
    return "No todos los participantes activos tienen receptor.";
  }

  const receiverIds = new Set(assignments.map((assignment) => assignment.receiverId));
  if (receiverIds.size !== assignments.length) {
    return "Hay al menos una persona recibiendo dos regalos.";
  }

  if (receiverIds.size !== activeReceivers.length) {
    return "El número de personas que regalan y reciben no coincide.";
  }

  for (const assignment of assignments) {
    const giver = participants.find((participant) => participant.id === assignment.giverId);
    const receiver = participants.find((participant) => participant.id === assignment.receiverId);
    if (!giver || !receiver || !canAssign(giver, receiver, config, new Set())) {
      return "Hay una asignación que incumple las reglas del sorteo.";
    }
  }

  return null;
}
