import { randomInt } from "node:crypto";
import { canAssign, type DrawParticipant, type DrawRuleConfig } from "./rules";
import { validateDraw, type AssignmentResult } from "./validateDraw";

export type GenerateDrawResult =
  | {
      ok: true;
      assignments: AssignmentResult[];
    }
  | {
      ok: false;
      message: string;
    };

function shuffle<T>(items: T[]) {
  const copy = [...items];
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const swapIndex = randomInt(index + 1);
    [copy[index], copy[swapIndex]] = [copy[swapIndex], copy[index]];
  }
  return copy;
}

export function generateDraw(participants: DrawParticipant[], config: DrawRuleConfig): GenerateDrawResult {
  const givers = shuffle(participants.filter((participant) => participant.active && participant.canGive));
  const receivers = participants.filter((participant) => participant.active && participant.canReceive);

  if (givers.length < 2) {
    return { ok: false, message: "Hace falta al menos dos personas activas para repartir." };
  }

  if (givers.length !== receivers.length) {
    return {
      ok: false,
      message: "El número de personas que pueden regalar y recibir debe coincidir."
    };
  }

  const assignments: AssignmentResult[] = [];
  const usedReceiverIds = new Set<string>();

  function place(giverIndex: number): boolean {
    if (giverIndex === givers.length) return true;

    const giver = givers[giverIndex];
    const candidates = shuffle(receivers).filter((receiver) => canAssign(giver, receiver, config, usedReceiverIds));

    for (const receiver of candidates) {
      assignments.push({ giverId: giver.id, receiverId: receiver.id });
      usedReceiverIds.add(receiver.id);

      if (place(giverIndex + 1)) return true;

      assignments.pop();
      usedReceiverIds.delete(receiver.id);
    }

    return false;
  }

  const solved = place(0);
  if (!solved) {
    return {
      ok: false,
      message:
        "No hay un reparto posible con las reglas actuales. Prueba a revisar núcleos familiares o exclusiones manuales."
    };
  }

  const error = validateDraw(participants, assignments, config);
  if (error) return { ok: false, message: error };

  return { ok: true, assignments };
}
