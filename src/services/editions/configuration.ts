export type EditionConfiguredParticipant = {
  id: string;
  familyIslandId: string;
  enabled: boolean;
  islandEnabled: boolean;
  canGive: boolean;
  canReceive: boolean;
};

export function resolveEditionParticipants<T extends EditionConfiguredParticipant>(participants: T[]) {
  return participants.filter((participant) => participant.enabled && participant.islandEnabled);
}

export function validateEditionRoles(participants: EditionConfiguredParticipant[]) {
  const enabled = resolveEditionParticipants(participants);
  if (enabled.some((participant) => !participant.canGive && !participant.canReceive)) {
    return "Una persona activa debe regalar, recibir o ambas cosas.";
  }
  const giverCount = enabled.filter((participant) => participant.canGive).length;
  const receiverCount = enabled.filter((participant) => participant.canReceive).length;
  if (giverCount < 2) return "Se necesitan al menos dos personas que regalen.";
  if (giverCount !== receiverCount) return "El número de personas que regalan y reciben debe coincidir.";
  return null;
}

export function nextAttemptNumber(attemptNumbers: number[]) {
  return attemptNumbers.length ? Math.max(...attemptNumbers) + 1 : 1;
}
