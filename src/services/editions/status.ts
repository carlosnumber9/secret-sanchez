export const editionStatuses = ["ready", "drawn", "sent", "archived"] as const;

export type EditionStatus = (typeof editionStatuses)[number];

const editionStatusLabels: Record<EditionStatus, string> = {
  ready: "En preparación",
  drawn: "Reparto generado",
  sent: "Enviada",
  archived: "Archivada"
};

export function getEditionStatusLabel(status: EditionStatus) {
  return editionStatusLabels[status];
}
