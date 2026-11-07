import { useState } from "react";
import { Button } from "@/components/ui/button";

type Pair = { fromParticipantId: string; toParticipantId: string };
export default function EditionRules({ editionId, people, initialNoSameIsland, initialExclusions, locked }: {
  editionId: string; people: Array<{ id: string; name: string }>;
  initialNoSameIsland: boolean; initialExclusions: Pair[]; locked: boolean;
}) {
  const [noSameIsland, setNoSameIsland] = useState(initialNoSameIsland);
  const [exclusions, setExclusions] = useState(initialExclusions);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const names = new Map(people.map((p) => [p.id, p.name]));
  const disabled = busy || locked;
  function add() {
    if (!from || !to || from === to || exclusions.some((p) => p.fromParticipantId === from && p.toParticipantId === to)) {
      setMessage("Selecciona dos adultos distintos y un par no repetido."); return;
    }
    setExclusions((current) => [...current, { fromParticipantId: from, toParticipantId: to }]);
    setMessage("Cambios pendientes de guardar.");
  }
  async function save() {
    setBusy(true); setMessage("");
    try {
      const response = await fetch(`/api/admin/editions/${editionId}/rules`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ noSameIsland, exclusions }) });
      const payload = await response.json() as { message?: string };
      if (!response.ok) throw new Error(payload.message || "No se pudieron guardar las reglas.");
      setMessage("Reglas guardadas.");
    } catch (error) { setMessage(error instanceof Error ? error.message : "No se pudieron guardar las reglas."); }
    finally { setBusy(false); }
  }
  return <section className="stack">
    <p>Las reglas afectan al reparto entre adultos. La autoasignación siempre está prohibida. Las exclusiones tienen una sola dirección.</p>
    {locked && <p>Esta edición está bloqueada para cambios.</p>}
    <label><input type="checkbox" checked={noSameIsland} disabled={disabled} onChange={(event) => { setNoSameIsland(event.target.checked); setMessage("Cambios pendientes de guardar."); }} /> Evitar regalos dentro del mismo núcleo</label>
    <div className="cluster">
      <label className="form-field">Regalador<select value={from} disabled={disabled} onChange={(event) => setFrom(event.target.value)}><option value="">Seleccionar adulto</option>{people.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select></label>
      <label className="form-field">No puede regalar a<select value={to} disabled={disabled} onChange={(event) => setTo(event.target.value)}><option value="">Seleccionar adulto</option>{people.filter((p) => p.id !== from).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select></label>
      <Button variant="secondary" disabled={disabled || exclusions.length >= 500} onClick={add}>Añadir exclusión</Button>
    </div>
    {exclusions.length > 0 && <ul className="stack">{exclusions.map((pair) => <li key={`${pair.fromParticipantId}:${pair.toParticipantId}`} className="cluster"><span>{names.get(pair.fromParticipantId) ?? "Adulto eliminado"} no regala a {names.get(pair.toParticipantId) ?? "Adulto eliminado"}</span><Button variant="secondary" size="sm" disabled={disabled} onClick={() => { setExclusions((current) => current.filter((p) => p !== pair)); setMessage("Cambios pendientes de guardar."); }}>Quitar</Button></li>)}</ul>}
    <Button disabled={disabled} onClick={save}>{busy ? "Guardando…" : "Guardar reglas"}</Button>
    <p role="status">{message}</p>
  </section>;
}
