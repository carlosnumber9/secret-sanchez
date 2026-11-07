import { availableDeliveryChannel } from "@/lib/contact";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useMemo, useState } from "react";
import "./EditionConfigurator.css";

type DeliveryChannel = "email" | "whatsapp" | "both" | null;
type Island = { id: string; name: string; color: string | null; enabled: boolean; representativeParticipantId: string | null };
type Person = {
  id: string;
  islandId: string;
  name: string;
  enabled: boolean;
  canGive: boolean;
  canReceive: boolean;
  isBaby: boolean;
  preferredChannel: DeliveryChannel;
  hasEmail: boolean;
  hasPhone: boolean;
};

function channelFromChecks(email: boolean, whatsapp: boolean): DeliveryChannel {
  if (email && whatsapp) return "both";
  if (email) return "email";
  if (whatsapp) return "whatsapp";
  return null;
}

export default function EditionConfigurator({ editionId, initialIslands, initialPeople, locked }: {
  editionId: string;
  initialIslands: Island[];
  initialPeople: Person[];
  locked: boolean;
}) {
  const [islands, setIslands] = useState(initialIslands);
  const [people, setPeople] = useState(() => initialPeople.map((person) => ({
    ...person,
    preferredChannel: person.isBaby ? null : availableDeliveryChannel(person.preferredChannel, person.hasEmail, person.hasPhone)
  })));
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const enabledPeople = useMemo(() => people.filter((person) => person.enabled && islands.find((island) => island.id === person.islandId)?.enabled), [people, islands]);
  const adults = enabledPeople.filter((person) => !person.isBaby);
  const babies = enabledPeople.filter((person) => person.isBaby);
  const giverCount = adults.filter((person) => person.canGive).length;
  const receiverCount = adults.filter((person) => person.canReceive).length;
  const preparedIslandCount = islands.filter((island) => island.enabled && island.representativeParticipantId).length;

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

  async function changeIsland(island: Island, changes: Partial<Island>) {
    if (await patch(`/api/admin/editions/${editionId}/islands/${island.id}`, changes)) {
      setIslands((current) => current.map((item) => item.id === island.id ? { ...item, ...changes } : item));
    }
  }

  async function changePerson(person: Person, changes: Partial<Person>) {
    const next = { ...person, ...changes };
    if (next.enabled && !next.isBaby && !next.canGive && !next.canReceive) {
      setMessage("Una persona adulta activa debe regalar, recibir o ambas cosas.");
      return;
    }
    const body = {
      enabled: next.enabled,
      canGive: next.isBaby ? false : next.canGive,
      canReceive: next.isBaby ? true : next.canReceive,
      preferredChannel: next.isBaby ? null : next.preferredChannel
    };
    if (await patch(`/api/admin/editions/${editionId}/participants/${person.id}`, body)) {
      setPeople((current) => current.map((item) => item.id === person.id ? { ...next, ...body } : item));
    }
  }

  return <section className="stack">
    <div className="edition-configurator__summary">
      <strong>{adults.length} adultos</strong>
      <span>{babies.length} bebés</span>
      <span>{giverCount} regaladores</span>
      <span>{receiverCount} receptores adultos</span>
      <span>{preparedIslandCount}/{islands.filter((island) => island.enabled).length} unidades preparadas</span>
      {giverCount !== receiverCount && <strong className="text-destructive">El reparto adulto está desequilibrado</strong>}
    </div>
    {locked && <p>Revoca el reparto vigente para modificar esta configuración.</p>}
    {islands.map((island) => {
      const islandDisabled = !island.enabled;
      const islandAdults = people.filter((person) => person.islandId === island.id && !person.isBaby && person.enabled);
      return <article className="family-editor__island" key={island.id} style={{ borderTopColor: island.color ?? "#d6a84f" }}>
        <div className="cluster cluster--actions">
          <h2>{island.name}</h2>
          <Button variant={island.enabled ? "default" : "secondary"} size="sm" disabled={locked || busy} onClick={() => changeIsland(island, { enabled: !island.enabled })}>{island.enabled ? "Unidad activa" : "Unidad desactivada"}</Button>
        </div>
        <label className="edition-configurator__representative">
          Representante de la unidad
          <select
            value={island.representativeParticipantId ?? ""}
            disabled={locked || busy || islandDisabled}
            onChange={(event) => changeIsland(island, { representativeParticipantId: event.target.value || null })}
          >
            <option value="">Seleccionar representante</option>
            {islandAdults.map((person) => <option value={person.id} key={person.id}>{person.name}</option>)}
          </select>
        </label>
        <div className="stack">
          {people.filter((person) => person.islandId === island.id).map((person) => {
            const usesEmail = person.preferredChannel === "email" || person.preferredChannel === "both";
            const usesWhatsapp = person.preferredChannel === "whatsapp" || person.preferredChannel === "both";
            return <div className="delivery-panel__row edition-configurator__person" key={person.id}>
              <div>
                <strong>{person.name}</strong>
                {person.isBaby && <Badge variant="secondary">Bebé</Badge>}
                {!person.isBaby && !person.hasEmail && !person.hasPhone && <Badge variant="outline">Sin contacto</Badge>}
              </div>
              <label><input type="checkbox" checked={person.enabled} disabled={locked || busy || islandDisabled} onChange={(event) => changePerson(person, { enabled: event.target.checked })} /> Participa</label>
              <label><input type="checkbox" checked={person.canGive} disabled={locked || busy || islandDisabled || !person.enabled || person.isBaby} onChange={(event) => changePerson(person, { canGive: event.target.checked })} /> Regala</label>
              <label><input type="checkbox" checked={person.canReceive} disabled={locked || busy || islandDisabled || !person.enabled || person.isBaby} onChange={(event) => changePerson(person, { canReceive: event.target.checked })} /> Recibe</label>
              <label title={!person.hasEmail ? "Añade el email en Familia" : undefined}><input type="checkbox" checked={usesEmail} disabled={locked || busy || islandDisabled || !person.enabled || person.isBaby || !person.hasEmail} onChange={(event) => changePerson(person, { preferredChannel: channelFromChecks(event.target.checked, usesWhatsapp) })} /> Email</label>
              <label title={!person.hasPhone ? "Añade el teléfono en Familia" : undefined}><input type="checkbox" checked={usesWhatsapp} disabled={locked || busy || islandDisabled || !person.enabled || person.isBaby || !person.hasPhone} onChange={(event) => changePerson(person, { preferredChannel: channelFromChecks(usesEmail, event.target.checked) })} /> WhatsApp</label>
            </div>;
          })}
        </div>
      </article>;
    })}
    {message && <p role="status">{message}</p>}
  </section>;
}
