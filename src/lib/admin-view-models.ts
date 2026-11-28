import type { getAdminAppState } from "@/actions/adminData";
import type { getEditionAppState } from "@/actions/editionData";

/** Explicit browser projections exclude internal rows, contacts from editions, and reveal secrets. */
export function familyView(state: Awaited<ReturnType<typeof getAdminAppState>>) {
  return {
    familyId: state.family?.id ?? null,
    revision: state.revision,
    islands: state.islands.map(island => ({
      id: island.id, name: island.name, color: island.color ?? "#d6a84f",
      participants: state.participants.filter(person => person.familyIslandId === island.id).map(person => ({
        id: person.id, name: person.name, email: person.email ?? "", phone: person.phone ?? "",
        preferredChannel: person.preferredChannel === "manual" ? null : person.preferredChannel,
        isBaby: person.isBaby, sortOrder: person.sortOrder
      }))
    }))
  };
}

export function editionView(state: Awaited<ReturnType<typeof getEditionAppState>>) {
  return {
    edition: { id: state.edition.id, name: state.edition.name, year: state.edition.year, kind: state.edition.kind, status: state.edition.status },
    currentDraw: state.currentDraw ? { id: state.currentDraw.id, attemptNumber: state.currentDraw.attemptNumber } : null,
    islands: state.islands.map(({ island, config }) => ({ id: island.id, name: island.name, color: island.color, enabled: config.enabled, representativeParticipantId: config.representativeParticipantId })),
    people: state.participants.map(({ participant, config }) => ({
      id: participant.id, islandId: participant.familyIslandId, name: participant.name,
      enabled: config.enabled, canGive: config.canGive, canReceive: config.canReceive, isBaby: config.isBaby,
      preferredChannel: config.preferredChannel === "manual" ? null : config.preferredChannel,
      hasEmail: Boolean(participant.email), hasPhone: Boolean(participant.phone)
    })),
    noSameIsland: state.rules.find(rule => rule.type === "NO_SAME_ISLAND")?.enabled ?? true,
    exclusions: state.exclusions.map(({ fromParticipantId, toParticipantId }) => ({ fromParticipantId, toParticipantId })),
    revokedAttempts: state.attempts.filter(attempt => attempt.status === "revoked").map(attempt => ({ id: attempt.id, attemptNumber: attempt.attemptNumber, revokedAt: attempt.revokedAt?.toISOString() ?? null })),
    exposure: state.exposure
  };
}
export type FamilyView = ReturnType<typeof familyView>;
export type EditionView = ReturnType<typeof editionView>;
