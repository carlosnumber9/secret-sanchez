import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  Baby,
  Check,
  CircleAlert,
  GripVertical,
  Pencil,
  Plus,
  Save,
  Trash2
} from "lucide-react";
import { useEffect, useMemo, useState, type DragEvent, type KeyboardEvent } from "react";
import ParticipantForm, { type ParticipantDraft } from "../ParticipantForm/ParticipantForm";
import "./FamilyEditor.css";

type Participant = Omit<ParticipantDraft, "preferredChannel"> & {
  id: string;
  preferredChannel: "email" | "whatsapp" | "both" | null;
  sortOrder: number;
};
type Island = { id: string; name: string; color: string; participants: Participant[] };
type Props = { familyId: string; initialIslands: Island[] };
type ApiResponse<T> = { ok: boolean; data?: T; message?: string };
type DraggedItem = { type: "island" | "participant"; id: string } | null;

const emptyParticipant: ParticipantDraft = { name: "", email: "", phone: "", preferredChannel: "email", isBaby: false };
const colors = ["#d6a84f", "#b83232", "#2f7d59", "#3d6f9f", "#8b5a2b"];

function savedParticipantLayout(islands: Island[]) {
  return Object.fromEntries(islands.flatMap((island) => island.participants.map((person, index) => [
    person.id,
    `${island.id}:${index}:${person.isBaby}`
  ])));
}

function layoutIsDirty(islands: Island[], saved: Record<string, string>) {
  const current = savedParticipantLayout(islands);
  const ids = Object.keys(current);
  return ids.length !== Object.keys(saved).length || ids.some((id) => current[id] !== saved[id]);
}

export default function FamilyEditor({ familyId, initialIslands }: Props) {
  const [islands, setIslands] = useState(initialIslands);
  const [savedLayout, setSavedLayout] = useState(() => savedParticipantLayout(initialIslands));
  const [selectedIslandId, setSelectedIslandId] = useState(initialIslands[0]?.id ?? "");
  const [newIslandName, setNewIslandName] = useState("");
  const [participant, setParticipant] = useState(emptyParticipant);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [draggedItem, setDraggedItem] = useState<DraggedItem>(null);
  const [dragTarget, setDragTarget] = useState("");
  const selectedIsland = useMemo(
    () => islands.find((island) => island.id === selectedIslandId) ?? islands[0],
    [islands, selectedIslandId]
  );
  const dirty = useMemo(() => layoutIsDirty(islands, savedLayout), [islands, savedLayout]);

  useEffect(() => {
    const warnBeforeLeaving = (event: BeforeUnloadEvent) => {
      if (!dirty) return;
      event.preventDefault();
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

  function replaceParticipant(updated: Participant) {
    setIslands((current) => current.map((island) => ({
      ...island,
      participants: island.participants.map((item) => item.id === updated.id ? { ...item, ...updated } : item)
    })));
  }

  async function addIsland() {
    if (!newIslandName.trim()) return;
    setBusy(true);
    try {
      const created = await api<Omit<Island, "participants">>("/api/admin/islands", "POST", {
        familyId,
        name: newIslandName.trim(),
        color: colors[islands.length % colors.length]
      });
      const next = { ...created, color: created.color ?? colors[0], participants: [] } as Island;
      setIslands((current) => [...current, next]);
      setSelectedIslandId(next.id);
      setNewIslandName("");
      setMessage("Unidad creada. Ya puedes arrastrar personas hasta ella.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "No se pudo guardar.");
    } finally {
      setBusy(false);
    }
  }

  async function addParticipant() {
    if (!selectedIsland || !participant.name.trim()) return;
    setBusy(true);
    try {
      const created = await api<Participant & { familyIslandId: string }>("/api/admin/participants", "POST", {
        ...participant,
        familyId,
        familyIslandId: selectedIsland.id,
        name: participant.name.trim()
      });
      setIslands((current) => current.map((island) => island.id === selectedIsland.id
        ? { ...island, participants: [...island.participants, created] }
        : island));
      setSavedLayout((current) => ({
        ...current,
        [created.id]: `${selectedIsland.id}:${selectedIsland.participants.length}:${created.isBaby}`
      }));
      setParticipant(emptyParticipant);
      setMessage("Persona creada y añadida desactivada a las ediciones existentes.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "No se pudo guardar.");
    } finally {
      setBusy(false);
    }
  }

  async function editPerson(person: Participant) {
    const name = window.prompt("Nombre", person.name);
    if (name === null || !name.trim()) return;
    const email = window.prompt("Email (vacío para quitarlo)", person.email ?? "");
    if (email === null) return;
    const phone = window.prompt("Teléfono (vacío para quitarlo)", person.phone ?? "");
    if (phone === null) return;
    setBusy(true);
    try {
      const updated = await api<Participant>(`/api/admin/participants/${person.id}`, "PATCH", { name: name.trim(), email, phone });
      replaceParticipant(updated);
      setMessage("Ficha actualizada.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "No se pudo actualizar.");
    } finally {
      setBusy(false);
    }
  }

  async function changeChannel(person: Participant, preferredChannel: "email" | "whatsapp" | "both") {
    setBusy(true);
    try {
      const updated = await api<Participant>(`/api/admin/participants/${person.id}`, "PATCH", { preferredChannel });
      replaceParticipant(updated);
      setMessage("Canal actualizado.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "No se pudo actualizar.");
    } finally {
      setBusy(false);
    }
  }

  function toggleBaby(person: Participant) {
    if (!person.isBaby && !window.confirm(`Al guardar, ${person.name} se marcará como bebé y se eliminarán sus datos de contacto. ¿Continuar?`)) return;
    setIslands((current) => current.map((island) => ({
      ...island,
      participants: island.participants.map((item) => item.id === person.id ? { ...item, isBaby: !item.isBaby } : item)
    })));
    setMessage(!person.isBaby
      ? `${person.name} se marcará como bebé al guardar la familia.`
      : `${person.name} se marcará como adulto al guardar la familia.`);
  }

  async function renameIsland(island: Island) {
    const name = window.prompt("Nombre de la unidad", island.name);
    if (!name?.trim()) return;
    setBusy(true);
    try {
      const updated = await api<Omit<Island, "participants">>(`/api/admin/islands/${island.id}`, "PATCH", { name: name.trim() });
      setIslands((current) => current.map((item) => item.id === island.id ? { ...item, ...updated } : item));
      setMessage("Unidad actualizada.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "No se pudo actualizar.");
    } finally {
      setBusy(false);
    }
  }

  async function deletePerson(person: Participant) {
    setBusy(true);
    try {
      const impact = await api<{ editions: number; draws: number; assignments: number; notifications: number; opened: number }>(`/api/admin/participants/${person.id}/deletion-impact`, "GET");
      const warning = `Se eliminarán ${impact.draws} repartos completos, ${impact.assignments} asignaciones, ${impact.notifications} logs y ${impact.opened} aperturas. Escribe ELIMINAR PERSONA para continuar.`;
      const confirmation = window.prompt(warning);
      if (confirmation !== "ELIMINAR PERSONA") {
        setMessage("Borrado cancelado. Puedes desactivarla dentro de cada edición.");
        return;
      }
      await api(`/api/admin/participants/${person.id}`, "DELETE", { confirmation });
      setIslands((current) => current.map((island) => ({
        ...island,
        participants: island.participants.filter((item) => item.id !== person.id)
      })));
      setSavedLayout((current) => {
        const next = { ...current };
        delete next[person.id];
        return next;
      });
      setMessage("Persona y repartos afectados eliminados.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "No se pudo eliminar.");
    } finally {
      setBusy(false);
    }
  }

  async function deleteIsland(island: Island) {
    setBusy(true);
    try {
      const impact = await api<{ participants: number; draws: number; notifications: number; opened: number }>(`/api/admin/islands/${island.id}/deletion-impact`, "GET");
      let removedParticipantIds: string[] = [];
      if (impact.participants && islands.length > 1) {
        const answer = window.prompt(`La unidad contiene ${impact.participants} personas. Escribe MOVER para trasladarlas o ELIMINAR UNIDAD para borrarlas con ${impact.draws} repartos afectados.`);
        if (answer === "MOVER") {
          const destinationName = window.prompt(`Destino: ${islands.filter((item) => item.id !== island.id).map((item) => item.name).join(", ")}`);
          const target = islands.find((item) => item.id !== island.id && item.name.toLowerCase() === destinationName?.trim().toLowerCase());
          if (!target) throw new Error("No se ha encontrado la unidad de destino.");
          await api(`/api/admin/islands/${island.id}`, "DELETE", { strategy: "move", targetIslandId: target.id });
          setIslands((current) => current.filter((item) => item.id !== island.id).map((item) => item.id === target.id
            ? { ...item, participants: [...item.participants, ...island.participants] }
            : item));
          setSavedLayout((current) => {
            const next = { ...current };
            island.participants.forEach((person, index) => {
              const persistedBaby = current[person.id]?.endsWith(":true") ?? person.isBaby;
              next[person.id] = `${target.id}:${target.participants.length + index}:${persistedBaby}`;
            });
            return next;
          });
        } else if (answer === "ELIMINAR UNIDAD") {
          await api(`/api/admin/islands/${island.id}`, "DELETE", { strategy: "cascade", confirmation: answer });
          removedParticipantIds = island.participants.map(({ id }) => id);
          setIslands((current) => current.filter((item) => item.id !== island.id));
        } else {
          setMessage("Borrado cancelado.");
          return;
        }
      } else {
        const confirmation = impact.participants ? window.prompt("Escribe ELIMINAR UNIDAD para borrar también a sus integrantes.") : "ELIMINAR UNIDAD";
        if (impact.participants && confirmation !== "ELIMINAR UNIDAD") {
          setMessage("Borrado cancelado.");
          return;
        }
        await api(`/api/admin/islands/${island.id}`, "DELETE", { strategy: "cascade", confirmation });
        removedParticipantIds = island.participants.map(({ id }) => id);
        setIslands((current) => current.filter((item) => item.id !== island.id));
      }
      if (removedParticipantIds.length) {
        setSavedLayout((current) => {
          const next = { ...current };
          removedParticipantIds.forEach((id) => delete next[id]);
          return next;
        });
      }
      setSelectedIslandId(islands.find((item) => item.id !== island.id)?.id ?? "");
      setMessage("Unidad eliminada.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "No se pudo eliminar.");
    } finally {
      setBusy(false);
    }
  }

  function reorderIsland(sourceId: string, targetId: string) {
    if (sourceId === targetId) return;
    setIslands((current) => {
      const sourceIndex = current.findIndex(({ id }) => id === sourceId);
      const targetIndex = current.findIndex(({ id }) => id === targetId);
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
      const sourceIsland = current.find((island) => island.participants.some(({ id }) => id === personId));
      const targetIsland = current.find(({ id }) => id === targetIslandId);
      const person = sourceIsland?.participants.find(({ id }) => id === personId);
      if (!sourceIsland || !targetIsland || !person) return current;
      const next = current.map((island) => ({
        ...island,
        participants: island.participants.filter(({ id }) => id !== personId)
      }));
      const destination = next.find(({ id }) => id === targetIslandId)!;
      destination.participants.splice(Math.max(0, Math.min(requestedIndex, destination.participants.length)), 0, person);
      return next;
    });
    setMessage("Cambio pendiente. Pulsa Guardar familia para confirmarlo.");
  }

  function handleIslandKey(event: KeyboardEvent<HTMLButtonElement>, islandId: string) {
    if (event.key !== "ArrowUp" && event.key !== "ArrowDown") return;
    event.preventDefault();
    const index = islands.findIndex(({ id }) => id === islandId);
    const target = islands[index + (event.key === "ArrowUp" ? -1 : 1)];
    if (target) reorderIsland(islandId, target.id);
  }

  function handleParticipantKey(event: KeyboardEvent<HTMLButtonElement>, islandId: string, personId: string, index: number) {
    const directions = ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"];
    if (!directions.includes(event.key)) return;
    event.preventDefault();
    const islandIndex = islands.findIndex(({ id }) => id === islandId);
    if (event.key === "ArrowUp") moveParticipant(personId, islandId, index - 1);
    if (event.key === "ArrowDown") moveParticipant(personId, islandId, index + 1);
    if (event.key === "ArrowLeft" && islands[islandIndex - 1]) {
      moveParticipant(personId, islands[islandIndex - 1].id, islands[islandIndex - 1].participants.length);
    }
    if (event.key === "ArrowRight" && islands[islandIndex + 1]) {
      moveParticipant(personId, islands[islandIndex + 1].id, islands[islandIndex + 1].participants.length);
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
    setBusy(true);
    try {
      const payload = islands.flatMap((island) => island.participants.map((person, sortOrder) => ({
        id: person.id,
        familyIslandId: island.id,
        sortOrder,
        isBaby: person.isBaby
      })));
      const updated = await api<Array<Participant & { familyIslandId: string }>>(`/api/admin/families/${familyId}/layout`, "PATCH", { participants: payload });
      const byId = new Map(updated.map((person) => [person.id, person]));
      const next = islands.map((island) => ({
        ...island,
        participants: island.participants.map((person) => ({ ...person, ...byId.get(person.id) }))
      }));
      setIslands(next);
      setSavedLayout(savedParticipantLayout(next));
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
      <p>Arrastra personas para ordenarlas o cambiarlas de unidad. Arrastra las unidades para ordenar esta vista; ese orden visual no se guardará.</p>
    </div>

    <section className="family-editor__board" aria-label="Unidades familiares">
      {islands.map((island) => <article
        className={`family-editor__island${dragTarget === `island:${island.id}` ? " is-drag-target" : ""}`}
        key={island.id}
        style={{ borderTopColor: island.color }}
        onDragOver={(event) => {
          if (draggedItem?.type !== "island") return;
          event.preventDefault();
          setDragTarget(`island:${island.id}`);
        }}
        onDrop={(event) => {
          event.preventDefault();
          if (draggedItem?.type === "island") reorderIsland(draggedItem.id, island.id);
          endDrag();
        }}
      >
        <header className="family-editor__island-header">
          <button
            className="family-editor__drag-handle"
            type="button"
            draggable={!busy}
            disabled={busy}
            onDragStart={(event) => beginDrag(event, { type: "island", id: island.id })}
            onDragEnd={endDrag}
            onKeyDown={(event) => handleIslandKey(event, island.id)}
            aria-label={`Reordenar ${island.name}. Usa las flechas arriba y abajo con el teclado.`}
          ><GripVertical /></button>
          <span className="family-editor__island-color" style={{ background: island.color }} />
          <div>
            <h2>{island.name}</h2>
            <p>{island.participants.length} {island.participants.length === 1 ? "persona" : "personas"}</p>
          </div>
          <div className="family-editor__island-actions">
            <Button variant="secondary" size="sm" disabled={busy} onClick={() => setSelectedIslandId(island.id)}>
              <Plus /> Persona
            </Button>
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
              className={`${person.isBaby ? "is-baby" : ""}${dragTarget === `participant:${person.id}` ? " is-drag-target" : ""}`}
              key={person.id}
              draggable={!busy}
              data-participant-row
              onDragStart={(event) => {
                event.stopPropagation();
                beginDrag(event, { type: "participant", id: person.id });
              }}
              onDragEnd={endDrag}
              onDragOver={(event) => {
                if (draggedItem?.type !== "participant") return;
                event.preventDefault();
                event.stopPropagation();
                setDragTarget(`participant:${person.id}`);
              }}
              onDrop={(event) => {
                event.preventDefault();
                event.stopPropagation();
                if (draggedItem?.type === "participant") moveParticipant(draggedItem.id, island.id, index);
                endDrag();
              }}
            >
              <TableCell className="family-editor__handle-cell">
                <button
                  className="family-editor__drag-handle"
                  type="button"
                  disabled={busy}
                  onKeyDown={(event) => handleParticipantKey(event, island.id, person.id, index)}
                  aria-label={`Mover a ${person.name}. Usa arriba y abajo para ordenar, izquierda y derecha para cambiar de unidad.`}
                ><GripVertical /></button>
              </TableCell>
              <TableCell><strong>{person.name}</strong>{person.isBaby && <small>Bebé · recibe, no regala</small>}</TableCell>
              <TableCell>{person.isBaby
                ? <span className="family-editor__muted">Sin contacto propio</span>
                : <><span>{person.email || person.phone || "Falta contacto"}</span>{person.email && person.phone && <small>{person.phone}</small>}</>}</TableCell>
              <TableCell>
                {person.isBaby ? <span className="family-editor__muted">Sin canal</span> : <select
                    aria-label={`Canal de ${person.name}`}
                    value={person.preferredChannel ?? "email"}
                    disabled={busy}
                    onChange={(event) => changeChannel(person, event.target.value as "email" | "whatsapp" | "both")}
                  >
                    <option value="email">Email</option>
                    <option value="whatsapp">WhatsApp</option>
                    <option value="both">Email y WhatsApp</option>
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
              className={dragTarget === `empty:${island.id}` ? "is-drag-target" : ""}
              onDragOver={(event) => {
                if (draggedItem?.type !== "participant") return;
                event.preventDefault();
                event.stopPropagation();
                setDragTarget(`empty:${island.id}`);
              }}
              onDrop={(event) => {
                event.preventDefault();
                event.stopPropagation();
                if (draggedItem?.type === "participant") moveParticipant(draggedItem.id, island.id, 0);
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

    <section className="family-editor__creation" aria-label="Añadir a la familia">
      <div className="family-editor__panel">
        <h2>Añadir unidad</h2>
        <p>Crea un hogar o núcleo familiar.</p>
        <div className="family-editor__inline">
          <Input value={newIslandName} onChange={(event) => setNewIslandName(event.target.value)} placeholder="Ej. Casa de Juan" />
          <Button size="icon" onClick={addIsland} disabled={busy || !newIslandName.trim()} aria-label="Añadir unidad"><Plus /></Button>
        </div>
      </div>
      <div className="family-editor__panel">
        <h2>Añadir persona</h2>
        <p>{selectedIsland ? `Se añadirá a ${selectedIsland.name}.` : "Crea una unidad primero."}</p>
        <ParticipantForm value={participant} onChange={setParticipant} onSubmit={addParticipant} />
      </div>
    </section>

    <footer className="family-editor__save">
      <div>
        <strong>{dirty ? "Hay cambios sin guardar" : "La familia está al día"}</strong>
        <p>{dirty ? "Se guardarán los grupos, el orden de las personas y los cambios de bebé." : "El orden visual de las unidades solo dura durante esta visita."}</p>
      </div>
      <Button size="lg" onClick={saveFamily} disabled={busy || !dirty}><Save />{busy ? "Guardando…" : "Guardar familia"}</Button>
    </footer>
    <p className="family-editor__status" role="status" aria-live="polite">{message}</p>
  </div>;
}
