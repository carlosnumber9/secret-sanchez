import { Button } from "@/components/ui/button";
import { useMemo, useState } from "react";
import "./EditionConfigurator.css";

type Island = { id: string; name: string; color: string | null; enabled: boolean };
type Person = { id: string; islandId: string; name: string; enabled: boolean; canGive: boolean; canReceive: boolean };

export default function EditionConfigurator({ editionId, initialIslands, initialPeople, locked }: {
  editionId: string;
  initialIslands: Island[];
  initialPeople: Person[];
  locked: boolean;
}) {
  const [islands, setIslands] = useState(initialIslands);
  const [people, setPeople] = useState(initialPeople);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const enabledPeople = useMemo(() => people.filter((person) => person.enabled && islands.find((island) => island.id === person.islandId)?.enabled), [people, islands]);
  const giverCount = enabledPeople.filter((person) => person.canGive).length;
  const receiverCount = enabledPeople.filter((person) => person.canReceive).length;

  async function patch(url: string, body: unknown) {
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch(url, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const payload = await response.json() as { message?: string };
      if (!response.ok) throw new Error(payload.message);
      setMessage("Configuración guardada.");
      return true;
    } catch (error) {
      setMessage(error instanceof Error && error.message ? error.message : "No se pudo guardar.");
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function toggleIsland(island: Island) {
    const enabled = !island.enabled;
    if (await patch(`/api/admin/editions/${editionId}/islands/${island.id}`, { enabled })) {
      setIslands((current) => current.map((item) => item.id === island.id ? { ...item, enabled } : item));
    }
  }

  async function changePerson(person: Person, changes: Partial<Person>) {
    const next = { ...person, ...changes };
    if (next.enabled && !next.canGive && !next.canReceive) {
      setMessage("Una persona activa debe regalar, recibir o ambas cosas.");
      return;
    }
    if (await patch(`/api/admin/editions/${editionId}/participants/${person.id}`, { enabled: next.enabled, canGive: next.canGive, canReceive: next.canReceive })) {
      setPeople((current) => current.map((item) => item.id === person.id ? next : item));
    }
  }

  return <section className="stack">
    <div className="cluster">
      <strong>{enabledPeople.length} participantes</strong>
      <span>{giverCount} regalan</span>
      <span>{receiverCount} reciben</span>
      {giverCount !== receiverCount && <strong className="text-destructive">El reparto está desequilibrado</strong>}
    </div>
    {locked && <p>Revoca el reparto vigente para modificar esta configuración.</p>}
    {islands.map((island) => {
      const islandDisabled = !island.enabled;
      return <article className="family-editor__island" key={island.id} style={{ borderTopColor: island.color ?? "#d6a84f" }}>
        <div className="cluster cluster--actions">
          <h2>{island.name}</h2>
          <Button variant={island.enabled ? "default" : "secondary"} size="sm" disabled={locked || busy} onClick={() => toggleIsland(island)}>{island.enabled ? "Núcleo activo" : "Núcleo desactivado"}</Button>
        </div>
        <div className="stack">
          {people.filter((person) => person.islandId === island.id).map((person) => <div className="delivery-panel__row" key={person.id}>
            <strong>{person.name}</strong>
            <label><input type="checkbox" checked={person.enabled} disabled={locked || busy || islandDisabled} onChange={(event) => changePerson(person, { enabled: event.target.checked })} /> Participa</label>
            <label><input type="checkbox" checked={person.canGive} disabled={locked || busy || islandDisabled || !person.enabled} onChange={(event) => changePerson(person, { canGive: event.target.checked })} /> Regala</label>
            <label><input type="checkbox" checked={person.canReceive} disabled={locked || busy || islandDisabled || !person.enabled} onChange={(event) => changePerson(person, { canReceive: event.target.checked })} /> Recibe</label>
          </div>)}
        </div>
      </article>;
    })}
    {message && <p role="status">{message}</p>}
  </section>;
}
