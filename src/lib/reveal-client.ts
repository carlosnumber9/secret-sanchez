export type RevealPreparation = { giverName: string; giverKind: "participant" | "familyIsland"; giverIslandName: string | null; alreadyOpened: boolean };
type RevealReceiver = { receiverName: string };

export class RevealRequestError extends Error {
  constructor(message: string, public readonly invalid = false) { super(message); }
}

export function requestReveal(phase: "resolve", token: string, signal?: AbortSignal, send?: typeof fetch): Promise<RevealPreparation>;
export function requestReveal(phase: "open", token: string, signal?: AbortSignal, send?: typeof fetch): Promise<RevealReceiver>;
export async function requestReveal(phase: "resolve" | "open", token: string, signal?: AbortSignal, send = fetch): Promise<RevealPreparation | RevealReceiver> {
  const response = await send(`/api/reveal/${phase}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token }), signal });
  if (response.status === 404) throw new RevealRequestError("Este enlace no parece válido.", true);
  if (response.status === 429) throw new RevealRequestError("Demasiados intentos. Espera unos segundos y vuelve a intentarlo.");
  const payload = await response.json().catch(() => null) as { ok?: boolean; data?: Record<string, unknown> } | null;
  const data = payload?.data;
  const valid = phase === "open" ? typeof data?.receiverName === "string" :
    typeof data?.giverName === "string" && ["participant", "familyIsland"].includes(String(data.giverKind)) &&
    (data.giverIslandName === null || typeof data.giverIslandName === "string") && typeof data.alreadyOpened === "boolean";
  if (!response.ok || !payload?.ok || !valid) throw new RevealRequestError("No se pudo conectar. Puedes volver a intentarlo.");
  return data as RevealPreparation | RevealReceiver;
}
