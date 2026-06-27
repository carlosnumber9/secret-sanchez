export const DRAW_RULES = {
  NO_SAME_ISLAND: "NO_SAME_ISLAND"
} as const;

export type DrawParticipant = {
  id: string;
  name: string;
  familyIslandId: string;
  active: boolean;
  canGive: boolean;
  canReceive: boolean;
};

export type ManualExclusion = {
  fromParticipantId: string;
  toParticipantId: string;
};

export type DrawRuleConfig = {
  noSameIsland: boolean;
  exclusions: ManualExclusion[];
};

export function canAssign(
  giver: DrawParticipant,
  receiver: DrawParticipant,
  config: DrawRuleConfig,
  usedReceiverIds: Set<string>
) {
  if (giver.id === receiver.id) return false;
  if (!giver.active || !receiver.active) return false;
  if (!giver.canGive || !receiver.canReceive) return false;
  if (usedReceiverIds.has(receiver.id)) return false;
  if (config.noSameIsland && giver.familyIslandId === receiver.familyIslandId) return false;
  return !config.exclusions.some(
    (exclusion) => exclusion.fromParticipantId === giver.id && exclusion.toParticipantId === receiver.id
  );
}
