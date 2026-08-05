import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  Baby,
  Check,
  CircleAlert,
  GripVertical,
  HousePlus,
  Pencil,
  Save,
  Trash2,
  UserPlus
} from "lucide-react";
import { useEffect, useMemo, useRef, useState, type DragEvent, type KeyboardEvent } from "react";
import CreateDialog from "../CreateDialog/CreateDialog";
import ParticipantForm, {
  participantDraftIsValid,
  participantEmailIsValid,
  participantPhoneIsValid,
  type ParticipantDraft
} from "../ParticipantForm/ParticipantForm";
import "./FamilyEditor.css";

type PreferredChannel = "email" | "whatsapp" | "both" | null;
type InitialParticipant = Omit<ParticipantDraft, "preferredChannel"> & {
  id: string;
  preferredChannel: PreferredChannel;
  sortOrder: number;
};
type InitialIsland = { id: string; name: string; color: string; participants: InitialParticipant[] };
type Participant = Omit<InitialParticipant, "id"> & { id: string | null; clientId: string };
type Island = Omit<InitialIsland, "id" | "participants"> & {
  id: string | null;
  clientId: string;
  participants: Participant[];
};
type Props = { familyId: string; initialIslands: InitialIsland[] };
type ApiResponse<T> = { ok: boolean; data?: T; message?: string };
type DraggedItem = { type: "island" | "participant"; id: string } | null;

const emptyParticipant: ParticipantDraft = { name: "", email: "", phone: "", preferredChannel: null, isBaby: false };
const colors = ["#d6a84f", "#b83232", "#2f7d59", "#3d6f9f", "#8b5a2b"];

function compatibleChannel(channel: PreferredChannel, email: string, phone: string): PreferredChannel {
  const hasEmail = participantEmailIsValid(email);
  const hasPhone = participantPhoneIsValid(phone);
  if (channel === "both") return hasEmail ? (hasPhone ? "both" : "email") : (hasPhone ? "whatsapp" : null);
  if (channel === "email") return hasEmail ? "email" : null;
  if (channel === "whatsapp") return hasPhone ? "whatsapp" : null;
  return null;
}

function prepareInitialIslands(initialIslands: InitialIsland[]): Island[] {
  return initialIslands.map((island) => ({
    ...island,
    clientId: island.id,
    participants: island.participants.map((person) => ({
      ...person,
      clientId: person.id,
      preferredChannel: person.isBaby ? null : compatibleChannel(person.preferredChannel, person.email, person.phone)
    }))
  }));
}

function familySnapshot(islands: Island[]) {
  return JSON.stringify([...islands]
    .sort((a, b) => a.clientId.localeCompare(b.clientId))
    .map((island) => ({
      id: island.id,
      clientId: island.clientId,
      name: island.name,
      color: island.color,
      participants: island.participants.map((person) => ({
        id: person.id,
        clientId: person.clientId,
        name: person.name,
        email: person.email,
        phone: person.phone,
        preferredChannel: person.preferredChannel,
        isBaby: person.isBaby
      }))
    })));
}

export default function FamilyEditor({ familyId, initialIslands }: Props) {
  const preparedInitialIslands = useMemo(() => prepareInitialIslands(initialIslands), [initialIslands]);
  const [islands, setIslands] = useState(preparedInitialIslands);
  const [savedSnapshot, setSavedSnapshot] = useState(() => familySnapshot(preparedInitialIslands));
  const [selectedIslandId, setSelectedIslandId] = useState(preparedInitialIslands[0]?.clientId ?? "");
  const [newIslandName, setNewIslandName] = useState("");
  const [participant, setParticipant] = useState(emptyParticipant);
  const [confirmedParticipantDeletionIds, setConfirmedParticipantDeletionIds] = useState<string[]>([]);
  const [confirmedIslandDeletionIds, setConfirmedIslandDeletionIds] = useState<string[]>([]);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [draggedItem, setDraggedItem] = useState<DraggedItem>(null);
  const [dragTarget, setDragTarget] = useState("");
  const islandDialogRef = useRef<HTMLDialogElement>(null);
  const participantDialogRef = useRef<HTMLDialogElement>(null);
  const formIslands = useMemo(() => islands.map(({ clientId, name }) => ({ id: clientId, name })), [islands]);
  const selectedIsland = useMemo(
    () => islands.find((island) => island.clientId === selectedIslandId) ?? islands[0],
    [islands, selectedIslandId]
  );
  const dirty = useMemo(() => familySnapshot(islands) !== savedSnapshot, [islands, savedSnapshot]);

  useEffect(() => {
    const warnBeforeLeaving = (event: BeforeUnloadEvent) => {
      if (!dirty) return;
      event.preventDefault();
      event.returnValue = "Hay cambios sin guardar.";
    };
    window.addEventListener("beforeunload", warnBeforeLeaving);
    return () => window.removeEventListener("beforeunload", warnBeforeLeaving);
  }, [dirty]);

  async function api<T>(url: string, method: string, body?: unknown) {
    const response = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: body ? JSON.stringify(body) : undefined
    });
    const payload = await response.json() as ApiResponse<T>;
    if (!response.ok || payload.data === undefined) throw new Error(payload.message || "No se pudo completar la operación.");
    return payload.data;
  }

  function showIslandDialog() {
    setNewIslandName("");
    islandDialogRef.current?.showModal();
  }

  function showParticipantDialog(islandId = selectedIsland?.clientId ?? islands[0]?.clientId ?? "") {
    if (!islands.length) return;
    setParticipant(emptyParticipant);
    setSelectedIslandId(islandId);
    participantDialogRef.current?.showModal();
  }

  function addIsland() {
    const name = newIslandName.trim();
    if (!name) return;
    const clientId = `island-${crypto.randomUUID()}`;
    const next: Island = {
      id: null,
      clientId,
      name,
      color: colors[islands.length % colors.length],
      participants: []
    };
    setIslands((current) => [...current, next]);
    setSelectedIslandId(clientId);
    setNewIslandName("");
    islandDialogRef.current?.close();
    setMessage("Unidad añadida al borrador. Pulsa Guardar familia para confirmarla.");
  }

  function addParticipant() {
    if (!selectedIsland || !participantDraftIsValid(participant, selectedIsland.clientId, formIslands)) return;
    const created: Participant = {
      ...participant,
      id: null,
      clientId: `participant-${crypto.randomUUID()}`,
      preferredChannel: participant.isBaby ? null : participant.preferredChannel,
      sortOrder: selectedIsland.participants.length
    };
    setIslands((current) => current.map((island) => island.clientId === selectedIsland.clientId
      ? { ...island, participants: [...island.participants, created] }
      : island));
    setParticipant(emptyParticipant);
    participantDialogRef.current?.close();
    setMessage("Persona añadida al borrador. Pulsa Guardar familia para confirmarla.");
  }

  function replaceParticipant(updated: Participant) {
    setIslands((current) => current.map((island) => ({
      ...island,
      participants: island.participants.map((item) => item.clientId === updated.clientId ? updated : item)
    })));
  }

  function editPerson(person: Participant) {
    const name = window.prompt("Nombre", person.name);
    if (name === null || !name.trim()) return;
    replaceParticipant({ ...person, name: name.trim() });
    setMessage("Nombre actualizado en el borrador.");
  }

  function changeChannel(person: Participant, preferredChannel: PreferredChannel) {
    replaceParticipant({ ...person, preferredChannel });
    setMessage("Canal actualizado en el borrador.");
  }

  function changeContact(person: Participant, field: "email" | "phone", value: string) {
    const email = field === "email" ? value : person.email;
    const phone = field === "phone" ? value : person.phone;
    replaceParticipant({
      ...person,
      [field]: value,
      preferredChannel: compatibleChannel(person.preferredChannel, email, phone)
    });
    setMessage("Contacto actualizado en el borrador.");
  }

  function toggleBaby(person: Participant) {
    if (!person.isBaby && !window.confirm(`Al guardar, ${person.name} se marcará como bebé y se eliminarán sus datos de contacto. ¿Continuar?`)) return;
    replaceParticipant({
      ...person,
      isBaby: !person.isBaby,
      email: person.isBaby ? person.email : "",
      phone: person.isBaby ? person.phone : "",
      preferredChannel: null
    });
    setMessage(!person.isBaby
      ? `${person.name} se marcará como bebé al guardar la familia.`
      : `${person.name} se marcará como adulto al guardar la familia.`);
  }

  function renameIsland(island: Island) {
    const name = window.prompt("Nombre de la unidad", island.name);
    if (!name?.trim()) return;
    setIslands((current) => current.map((item) => item.clientId === island.clientId ? { ...item, name: name.trim() } : item));
    setMessage("Unidad actualizada en el borrador.");
  }

  async function deletePerson(person: Participant) {
    if (!person.id) {
      if (!window.confirm(`¿Quitar a ${person.name} del borrador?`)) return;
    } else {
      setBusy(true);
      try {
        const impact = await api<{ editions: number; draws: number; assignments: number; notifications: number; opened: number }>(`/api/admin/participants/${person.id}/deletion-impact`, "GET");
        const warning = `Al guardar se eliminarán ${impact.draws} repartos completos, ${impact.assignments} asignaciones, ${impact.notifications} logs y ${impact.opened} aperturas. Escribe ELIMINAR PERSONA para continuar.`;
        if (window.prompt(warning) !== "ELIMINAR PERSONA") {
          setMessage("Borrado cancelado. Puedes desactivarla dentro de cada edición.");
          return;
        }
        setConfirmedParticipantDeletionIds((current) => [...new Set([...current, person.id!])]);
      } catch (error) {
        setMessage(error instanceof Error ? error.message : "No se pudo comprobar el impacto.");
        return;
      } finally {
        setBusy(false);
      }
    }
    setIslands((current) => current.map((island) => ({
      ...island,
      participants: island.participants.filter((item) => item.clientId !== person.clientId)
    })));
    setMessage("Persona eliminada del borrador. El cambio se aplicará al guardar.");
  }

  async function deleteIsland(island: Island) {
    let impact = { participants: 0, draws: 0, notifications: 0, opened: 0 };
    if (island.id) {
      setBusy(true);
      try {
        impact = await api<typeof impact>(`/api/admin/islands/${island.id}/deletion-impact`, "GET");
      } catch (error) {
        setMessage(error instanceof Error ? error.message : "No se pudo comprobar el impacto.");
        return;
      } finally {
        setBusy(false);
      }
    }

    const alternatives = islands.filter((item) => item.clientId !== island.clientId);
    if (island.participants.length && alternatives.length) {
      const answer = window.prompt(`La unidad contiene ${island.participants.length} personas. Escribe MOVER para trasladarlas o ELIMINAR UNIDAD para borrarlas con ${impact.draws} repartos afectados.`);
      if (answer === "MOVER") {
        const destinationName = window.prompt(`Destino: ${alternatives.map((item) => item.name).join(", ")}`);
        const target = alternatives.find((item) => item.name.toLowerCase() === destinationName?.trim().toLowerCase());
        if (!target) {
          setMessage("No se ha encontrado la unidad de destino.");
          return;
        }
        setIslands((current) => current
          .filter((item) => item.clientId !== island.clientId)
          .map((item) => item.clientId === target.clientId
            ? { ...item, participants: [...item.participants, ...island.participants] }
            : item));
      } else if (answer === "ELIMINAR UNIDAD") {
        setConfirmedParticipantDeletionIds((current) => [...new Set([
          ...current,
          ...island.participants.flatMap(({ id }) => id ? [id] : [])
        ])]);
        setIslands((current) => current.filter((item) => item.clientId !== island.clientId));
      } else {
        setMessage("Borrado cancelado.");
        return;
      }
    } else if (island.participants.length) {
      if (window.prompt("Escribe ELIMINAR UNIDAD para borrar también a sus integrantes al guardar.") !== "ELIMINAR UNIDAD") {
        setMessage("Borrado cancelado.");
        return;
      }
      setConfirmedParticipantDeletionIds((current) => [...new Set([
        ...current,
        ...island.participants.flatMap(({ id }) => id ? [id] : [])
      ])]);
      setIslands((current) => current.filter((item) => item.clientId !== island.clientId));
    } else {
      if (!window.confirm(`¿Quitar la unidad ${island.name}${island.id ? " al guardar" : " del borrador"}?`)) return;
      setIslands((current) => current.filter((item) => item.clientId !== island.clientId));
    }

    if (island.id) setConfirmedIslandDeletionIds((current) => [...new Set([...current, island.id!])]);
    setSelectedIslandId(alternatives[0]?.clientId ?? "");
    setMessage("Unidad eliminada del borrador. El cambio se aplicará al guardar.");
  }

  function reorderIsland(sourceId: string, targetId: string) {
    if (sourceId === targetId) return;
    setIslands((current) => {
      const sourceIndex = current.findIndex(({ clientId }) => clientId === sourceId);
      const targetIndex = current.findIndex(({ clientId }) => clientId === targetId);
      if (sourceIndex < 0 || targetIndex < 0) return current;
      const next = [...current];
      const [source] = next.splice(sourceIndex, 1);
      next.splice(targetIndex, 0, source);
      return next;
    });
    setMessage("Orden visual actualizado. Este orden no se guarda en la base de datos.");
  }

  function moveParticipant(personId: string, targetIslandId: string, requestedIndex: number) {
    setIslands((current) => {
      const sourceIsland = current.find((island) => island.participants.some(({ clientId }) => clientId === personId));
      const targetIsland = current.find(({ clientId }) => clientId === targetIslandId);
      const person = sourceIsland?.participants.find(({ clientId }) => clientId === personId);
      if (!sourceIsland || !targetIsland || !person) return current;
      const next = current.map((island) => ({
        ...island,
        participants: island.participants.filter(({ clientId }) => clientId !== personId)
      }));
      const destination = next.find(({ clientId }) => clientId === targetIslandId)!;
      destination.participants.splice(Math.max(0, Math.min(requestedIndex, destination.participants.length)), 0, person);
      return next;
    });
    setMessage("Cambio pendiente. Pulsa Guardar familia para confirmarlo.");
  }

  function handleIslandKey(event: KeyboardEvent<HTMLButtonElement>, islandId: string) {
    if (event.key !== "ArrowUp" && event.key !== "ArrowDown") return;
    event.preventDefault();
    const index = islands.findIndex(({ clientId }) => clientId === islandId);
    const target = islands[index + (event.key === "ArrowUp" ? -1 : 1)];
    if (target) reorderIsland(islandId, target.clientId);
  }

  function handleParticipantKey(event: KeyboardEvent<HTMLButtonElement>, islandId: string, personId: string, index: number) {
    const directions = ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"];
    if (!directions.includes(event.key)) return;
    event.preventDefault();
    const islandIndex = islands.findIndex(({ clientId }) => clientId === islandId);
    if (event.key === "ArrowUp") moveParticipant(personId, islandId, index - 1);
    if (event.key === "ArrowDown") moveParticipant(personId, islandId, index + 1);
    if (event.key === "ArrowLeft" && islands[islandIndex - 1]) {
      moveParticipant(personId, islands[islandIndex - 1].clientId, islands[islandIndex - 1].participants.length);
    }
    if (event.key === "ArrowRight" && islands[islandIndex + 1]) {
      moveParticipant(personId, islands[islandIndex + 1].clientId, islands[islandIndex + 1].participants.length);
    }
  }

  function beginDrag(event: DragEvent, item: Exclude<DraggedItem, null>) {
    setDraggedItem(item);
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", `${item.type}:${item.id}`);
  }

  function endDrag() {
    setDraggedItem(null);
    setDragTarget("");
  }

  async function saveFamily() {
    const invalidPerson = islands.flatMap((island) => island.participants.map((person) => ({ island, person })))
      .find(({ island, person }) => !participantDraftIsValid({
        name: person.name,
        email: person.email,
        phone: person.phone,
        preferredChannel: person.preferredChannel,
        isBaby: person.isBaby
      }, island.clientId, formIslands));
    if (invalidPerson) {
      setMessage(`Revisa los datos de contacto de ${invalidPerson.person.name} antes de guardar.`);
      return;
    }

    setBusy(true);
    try {
      const payload = {
        islands: islands.map((island) => ({
          clientId: island.clientId,
          id: island.id,
          name: island.name,
          color: island.color
        })),
        participants: islands.flatMap((island) => island.participants.map((person, sortOrder) => ({
          clientId: person.clientId,
          id: person.id,
          familyIslandClientId: island.clientId,
          name: person.name,
          email: person.isBaby ? "" : person.email,
          phone: person.isBaby ? "" : person.phone,
          preferredChannel: person.isBaby ? null : person.preferredChannel,
          isBaby: person.isBaby,
          sortOrder
        }))),
        confirmedParticipantDeletionIds,
        confirmedIslandDeletionIds
      };
      const updated = await api<{ islands: Array<Island & { id: string }> }>(`/api/admin/families/${familyId}/layout`, "PATCH", payload);
      const next: Island[] = updated.islands.map((island) => ({
        ...island,
        id: island.id,
        participants: island.participants.map((person) => ({ ...person, id: person.id }))
      }));
      setIslands(next);
      setSavedSnapshot(familySnapshot(next));
      setConfirmedParticipantDeletionIds([]);
      setConfirmedIslandDeletionIds([]);
      setSelectedIslandId((current) => next.some(({ clientId }) => clientId === current) ? current : next[0]?.clientId ?? "");
      setMessage("Familia guardada.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "No se pudo guardar la familia.");
    } finally {
      setBusy(false);
    }
  }

  return <div className="family-editor">
    <div className="family-editor__hint">
      <GripVertical aria-hidden="true" />
      <p>Arrastra personas para ordenarlas o cambiarlas de unidad. Todos los cambios se aplicarán juntos al pulsar Guardar familia.</p>
    </div>

    <div className="family-editor__create-actions" aria-label="Añadir a la familia">
      <Button size="icon-lg" onClick={showIslandDialog} disabled={busy} aria-label="Añadir unidad" title="Añadir unidad"><HousePlus /></Button>
      <Button size="icon-lg" variant="secondary" onClick={() => showParticipantDialog()} disabled={busy || !islands.length} aria-label="Añadir persona" title={islands.length ? "Añadir persona" : "Crea una unidad primero"}><UserPlus /></Button>
    </div>

    <section className="family-editor__board" aria-label="Unidades familiares">
      {islands.map((island) => <article
        className={`family-editor__island${dragTarget === `island:${island.clientId}` ? " is-drag-target" : ""}`}
        key={island.clientId}
        style={{ borderTopColor: island.color }}
        onDragOver={(event) => {
          if (draggedItem?.type !== "island") return;
          event.preventDefault();
          setDragTarget(`island:${island.clientId}`);
        }}
        onDrop={(event) => {
          event.preventDefault();
          if (draggedItem?.type === "island") reorderIsland(draggedItem.id, island.clientId);
          endDrag();
        }}
      >
        <header className="family-editor__island-header">
          <button
            className="family-editor__drag-handle"
            type="button"
            draggable={!busy}
            disabled={busy}
            onDragStart={(event) => beginDrag(event, { type: "island", id: island.clientId })}
            onDragEnd={endDrag}
            onKeyDown={(event) => handleIslandKey(event, island.clientId)}
            aria-label={`Reordenar ${island.name}. Usa las flechas arriba y abajo con el teclado.`}
          ><GripVertical /></button>
          <span className="family-editor__island-color" style={{ background: island.color }} />
          <div>
            <h2>{island.name}</h2>
            <p>{island.participants.length} {island.participants.length === 1 ? "persona" : "personas"}</p>
          </div>
          <div className="family-editor__island-actions">
            <Button variant="ghost" size="icon" disabled={busy} onClick={() => renameIsland(island)} aria-label={`Renombrar ${island.name}`}><Pencil /></Button>
            <Button variant="ghost" size="icon" disabled={busy} onClick={() => deleteIsland(island)} aria-label={`Eliminar ${island.name}`}><Trash2 /></Button>
          </div>
        </header>

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="family-editor__handle-cell"><span className="sr-only">Mover</span></TableHead>
              <TableHead>Familiar</TableHead>
              <TableHead>Contacto</TableHead>
              <TableHead>Canal</TableHead>
              <TableHead className="family-editor__baby-heading">Bebé</TableHead>
              <TableHead className="family-editor__actions-heading"><span className="sr-only">Acciones</span></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {island.participants.map((person, index) => <TableRow
              className={`${person.isBaby ? "is-baby" : ""}${dragTarget === `participant:${person.clientId}` ? " is-drag-target" : ""}`}
              key={person.clientId}
              data-participant-row
              onDragOver={(event) => {
                if (draggedItem?.type !== "participant") return;
                event.preventDefault();
                event.stopPropagation();
                setDragTarget(`participant:${person.clientId}`);
              }}
              onDrop={(event) => {
                event.preventDefault();
                event.stopPropagation();
                if (draggedItem?.type === "participant") moveParticipant(draggedItem.id, island.clientId, index);
                endDrag();
              }}
            >
              <TableCell className="family-editor__handle-cell">
                <button
                  className="family-editor__drag-handle"
                  type="button"
                  draggable={!busy}
                  disabled={busy}
                  onDragStart={(event) => {
                    event.stopPropagation();
                    beginDrag(event, { type: "participant", id: person.clientId });
                  }}
                  onDragEnd={endDrag}
                  onKeyDown={(event) => handleParticipantKey(event, island.clientId, person.clientId, index)}
                  aria-label={`Mover a ${person.name}. Usa arriba y abajo para ordenar, izquierda y derecha para cambiar de unidad.`}
                ><GripVertical /></button>
              </TableCell>
              <TableCell><strong>{person.name}</strong>{person.isBaby && <small>Bebé · recibe, no regala</small>}</TableCell>
              <TableCell>{person.isBaby
                ? <span className="family-editor__muted">Sin contacto propio</span>
                : <div className="family-editor__contact-fields">
                    <Input
                      type="email"
                      value={person.email}
                      placeholder="Email opcional"
                      aria-label={`Email de ${person.name}`}
                      disabled={busy}
                      onChange={(event) => changeContact(person, "email", event.target.value)}
                    />
                    <Input
                      type="tel"
                      inputMode="tel"
                      pattern="^\\+[1-9]\\d{7,14}$"
                      value={person.phone}
                      placeholder="Teléfono opcional"
                      aria-label={`Teléfono de ${person.name}`}
                      disabled={busy}
                      onChange={(event) => changeContact(person, "phone", event.target.value)}
                    />
                  </div>}</TableCell>
              <TableCell>
                {person.isBaby ? <span className="family-editor__muted">Sin canal</span> : <select
                    aria-label={`Canal de ${person.name}`}
                    value={person.preferredChannel ?? ""}
                    disabled={busy}
                    onChange={(event) => changeChannel(person, event.target.value ? event.target.value as Exclude<PreferredChannel, null> : null)}
                  >
                    <option value="">Sin canal</option>
                    <option value="email" disabled={!participantEmailIsValid(person.email)}>Email</option>
                    <option value="whatsapp" disabled={!participantPhoneIsValid(person.phone)}>WhatsApp</option>
                    <option value="both" disabled={!participantEmailIsValid(person.email) || !participantPhoneIsValid(person.phone)}>Email y WhatsApp</option>
                  </select>}
              </TableCell>
              <TableCell className="family-editor__baby-cell">
                <button
                  className="family-editor__baby-check"
                  type="button"
                  role="checkbox"
                  aria-checked={person.isBaby}
                  aria-label={`${person.isBaby ? "Desmarcar" : "Marcar"} a ${person.name} como bebé`}
                  title={`${person.isBaby ? "Desmarcar" : "Marcar"} como bebé`}
                  disabled={busy}
                  onClick={() => toggleBaby(person)}
                ><Baby /><Check className="family-editor__baby-checkmark" /></button>
              </TableCell>
              <TableCell className="family-editor__row-actions">
                <Button variant="ghost" size="icon" disabled={busy || person.isBaby} onClick={() => editPerson(person)} aria-label={`Editar ${person.name}`}><Pencil /></Button>
                <Button variant="destructive" size="icon" disabled={busy} onClick={() => deletePerson(person)} aria-label={`Eliminar ${person.name}`}><Trash2 /></Button>
              </TableCell>
            </TableRow>)}
            {!island.participants.length && <TableRow
              className={dragTarget === `empty:${island.clientId}` ? "is-drag-target" : ""}
              onDragOver={(event) => {
                if (draggedItem?.type !== "participant") return;
                event.preventDefault();
                event.stopPropagation();
                setDragTarget(`empty:${island.clientId}`);
              }}
              onDrop={(event) => {
                event.preventDefault();
                event.stopPropagation();
                if (draggedItem?.type === "participant") moveParticipant(draggedItem.id, island.clientId, 0);
                endDrag();
              }}
            ><TableCell colSpan={6} className="family-editor__empty">Arrastra aquí el primer familiar de esta unidad.</TableCell></TableRow>}
          </TableBody>
        </Table>
      </article>)}
      {!islands.length && <div className="family-editor__empty-state">
        <CircleAlert />
        <h2>La familia todavía no tiene unidades</h2>
        <p>Crea la primera unidad para empezar a añadir familiares.</p>
      </div>}
    </section>

    <footer className="family-editor__save">
      <div>
        <strong>{dirty ? "Hay cambios sin guardar" : "La familia está al día"}</strong>
        <p>{dirty ? "Altas, ediciones, borrados y movimientos se aplicarán juntos." : "El orden visual de las unidades solo dura durante esta visita."}</p>
      </div>
      <Button size="lg" onClick={saveFamily} disabled={busy || !dirty}><Save />{busy ? "Guardando…" : "Guardar familia"}</Button>
    </footer>
    <p className="family-editor__status" role="status" aria-live="polite">{message}</p>

    <CreateDialog ref={islandDialogRef} title="Añadir unidad" description="Crea un hogar o núcleo familiar.">
      <form className="create-dialog__form" onSubmit={(event) => { event.preventDefault(); addIsland(); }}>
        <label className="form-field">
          Nombre de la unidad
          <Input autoFocus value={newIslandName} onChange={(event) => setNewIslandName(event.target.value)} placeholder="Ej. Casa de Juan" required maxLength={180} />
        </label>
        <Button className="min-h-10 w-full" size="lg" type="submit" disabled={!newIslandName.trim()}>Añadir unidad</Button>
      </form>
    </CreateDialog>

    <CreateDialog ref={participantDialogRef} title="Añadir persona" description="Completa sus datos y elige una unidad.">
      <ParticipantForm
        value={participant}
        islandId={selectedIsland?.clientId ?? ""}
        islands={formIslands}
        disabled={busy}
        onChange={setParticipant}
        onIslandChange={setSelectedIslandId}
        onSubmit={addParticipant}
      />
    </CreateDialog>
  </div>;
}
