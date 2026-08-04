import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Pencil, Plus, Trash2, UserRound } from "lucide-react";
import { useMemo, useState } from "react";
import ParticipantForm, { type ParticipantDraft } from "../ParticipantForm/ParticipantForm";
import "./FamilyEditor.css";

type Participant = Omit<ParticipantDraft, "preferredChannel"> & {
  id: string;
  preferredChannel: "email" | "whatsapp" | "both" | "manual";
};
type Island = { id: string; name: string; color: string; participants: Participant[] };
type Props = { familyId: string; initialIslands: Island[] };
type ApiResponse<T> = { ok: boolean; data?: T; message?: string };

const emptyParticipant: ParticipantDraft = { name: "", email: "", phone: "", preferredChannel: "email" };
const colors = ["#d6a84f", "#b83232", "#2f7d59", "#3d6f9f", "#8b5a2b"];

export default function FamilyEditor({ familyId, initialIslands }: Props) {
  const [islands, setIslands] = useState(initialIslands);
  const [selectedIslandId, setSelectedIslandId] = useState(initialIslands[0]?.id ?? "");
  const [newIslandName, setNewIslandName] = useState("");
  const [participant, setParticipant] = useState(emptyParticipant);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const selectedIsland = useMemo(() => islands.find((island) => island.id === selectedIslandId) ?? islands[0], [islands, selectedIslandId]);

  async function api<T>(url: string, method: string, body?: unknown) {
    const response = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: body ? JSON.stringify(body) : undefined });
    const payload = await response.json() as ApiResponse<T>;
    if (!response.ok || !payload.data) throw new Error(payload.message);
    return payload.data;
  }

  async function addIsland() {
    if (!newIslandName.trim()) return;
    setBusy(true);
    try {
      const created = await api<Omit<Island, "participants">>("/api/admin/islands", "POST", { familyId, name: newIslandName.trim(), color: colors[islands.length % colors.length] });
      const next = { ...created, color: created.color ?? colors[0], participants: [] } as Island;
      setIslands((current) => [...current, next]);
      setSelectedIslandId(next.id);
      setNewIslandName("");
      setMessage("Núcleo guardado.");
    } catch (error) { setMessage(error instanceof Error ? error.message : "No se pudo guardar."); }
    finally { setBusy(false); }
  }

  async function addParticipant() {
    if (!selectedIsland || !participant.name.trim()) return;
    setBusy(true);
    try {
      const created = await api<Participant & { familyIslandId: string }>("/api/admin/participants", "POST", { ...participant, familyId, familyIslandId: selectedIsland.id, name: participant.name.trim() });
      setIslands((current) => current.map((island) => island.id === selectedIsland.id ? { ...island, participants: [...island.participants, created] } : island));
      setParticipant(emptyParticipant);
      setMessage("Persona guardada y añadida desactivada a las ediciones existentes.");
    } catch (error) { setMessage(error instanceof Error ? error.message : "No se pudo guardar."); }
    finally { setBusy(false); }
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
      setIslands((current) => current.map((island) => ({ ...island, participants: island.participants.map((item) => item.id === person.id ? updated : item) })));
      setMessage("Ficha actualizada.");
    } catch (error) { setMessage(error instanceof Error ? error.message : "No se pudo actualizar."); }
    finally { setBusy(false); }
  }

  async function changeChannel(person: Participant, preferredChannel: "email" | "manual") {
    setBusy(true);
    try {
      const updated = await api<Participant>(`/api/admin/participants/${person.id}`, "PATCH", { preferredChannel });
      setIslands((current) => current.map((island) => ({ ...island, participants: island.participants.map((item) => item.id === person.id ? updated : item) })));
      setMessage("Canal actualizado.");
    } catch (error) { setMessage(error instanceof Error ? error.message : "No se pudo actualizar."); }
    finally { setBusy(false); }
  }

  async function renameIsland(island: Island) {
    const name = window.prompt("Nombre del núcleo", island.name);
    if (!name?.trim()) return;
    setBusy(true);
    try {
      const updated = await api<Omit<Island, "participants">>(`/api/admin/islands/${island.id}`, "PATCH", { name: name.trim() });
      setIslands((current) => current.map((item) => item.id === island.id ? { ...item, ...updated } : item));
      setMessage("Núcleo actualizado.");
    } catch (error) { setMessage(error instanceof Error ? error.message : "No se pudo actualizar."); }
    finally { setBusy(false); }
  }

  async function movePerson(person: Participant, targetIslandId: string) {
    if (!targetIslandId) return;
    setBusy(true);
    try {
      const updated = await api<Participant & { familyIslandId: string }>(`/api/admin/participants/${person.id}`, "PATCH", { familyIslandId: targetIslandId });
      setIslands((current) => current.map((island) => {
        const without = island.participants.filter((item) => item.id !== person.id);
        return island.id === targetIslandId ? { ...island, participants: [...without, updated] } : { ...island, participants: without };
      }));
      setMessage("Persona movida. Los repartos ya creados conservan su snapshot.");
    } catch (error) { setMessage(error instanceof Error ? error.message : "No se pudo mover."); }
    finally { setBusy(false); }
  }

  async function deletePerson(person: Participant) {
    setBusy(true);
    try {
      const impact = await api<{ editions: number; draws: number; assignments: number; notifications: number; opened: number }>(`/api/admin/participants/${person.id}/deletion-impact`, "GET");
      const warning = `Se eliminarán ${impact.draws} repartos completos, ${impact.assignments} asignaciones, ${impact.notifications} logs y ${impact.opened} aperturas. Escribe ELIMINAR PERSONA para continuar.`;
      const confirmation = window.prompt(warning);
      if (confirmation !== "ELIMINAR PERSONA") { setMessage("Borrado cancelado. Puedes desactivarla dentro de cada edición."); return; }
      await api(`/api/admin/participants/${person.id}`, "DELETE", { confirmation });
      setIslands((current) => current.map((island) => ({ ...island, participants: island.participants.filter((item) => item.id !== person.id) })));
      setMessage("Persona y repartos afectados eliminados.");
    } catch (error) { setMessage(error instanceof Error ? error.message : "No se pudo eliminar."); }
    finally { setBusy(false); }
  }

  async function deleteIsland(island: Island) {
    setBusy(true);
    try {
      const impact = await api<{ participants: number; draws: number; notifications: number; opened: number }>(`/api/admin/islands/${island.id}/deletion-impact`, "GET");
      if (impact.participants && islands.length > 1) {
        const answer = window.prompt(`La unidad contiene ${impact.participants} personas. Escribe MOVER para trasladarlas o ELIMINAR UNIDAD para borrarlas con ${impact.draws} repartos afectados.`);
        if (answer === "MOVER") {
          const destinationName = window.prompt(`Destino: ${islands.filter((item) => item.id !== island.id).map((item) => item.name).join(", ")}`);
          const target = islands.find((item) => item.id !== island.id && item.name.toLowerCase() === destinationName?.trim().toLowerCase());
          if (!target) throw new Error("No se ha encontrado el núcleo de destino.");
          await api(`/api/admin/islands/${island.id}`, "DELETE", { strategy: "move", targetIslandId: target.id });
          setIslands((current) => current.filter((item) => item.id !== island.id).map((item) => item.id === target.id ? { ...item, participants: [...item.participants, ...island.participants] } : item));
        } else if (answer === "ELIMINAR UNIDAD") {
          await api(`/api/admin/islands/${island.id}`, "DELETE", { strategy: "cascade", confirmation: answer });
          setIslands((current) => current.filter((item) => item.id !== island.id));
        } else return;
      } else {
        const confirmation = impact.participants ? window.prompt("Escribe ELIMINAR UNIDAD para borrar también a sus integrantes.") : "ELIMINAR UNIDAD";
        if (impact.participants && confirmation !== "ELIMINAR UNIDAD") return;
        await api(`/api/admin/islands/${island.id}`, "DELETE", { strategy: "cascade", confirmation });
        setIslands((current) => current.filter((item) => item.id !== island.id));
      }
      setSelectedIslandId(islands.find((item) => item.id !== island.id)?.id ?? "");
      setMessage("Unidad eliminada.");
    } catch (error) { setMessage(error instanceof Error ? error.message : "No se pudo eliminar."); }
    finally { setBusy(false); }
  }

  return <div className="family-editor">
    <section className="family-editor__board" aria-label="Núcleos familiares">
      {islands.map((island) => <article className="family-editor__island" key={island.id} style={{ borderTopColor: island.color }}>
        <div className="cluster cluster--actions">
          <Button className="family-editor__island-title" variant="ghost" onClick={() => setSelectedIslandId(island.id)}><span style={{ background: island.color }} />{island.name}</Button>
          <Button variant="ghost" size="icon" disabled={busy} onClick={() => renameIsland(island)} aria-label={`Renombrar ${island.name}`}><Pencil size={18} /></Button>
          <Button variant="ghost" size="icon" disabled={busy} onClick={() => deleteIsland(island)} aria-label={`Eliminar ${island.name}`}><Trash2 size={18} /></Button>
        </div>
        <div className="family-editor__people">
          {island.participants.map((person) => <div className="family-editor__person" key={person.id}>
            <UserRound size={20} /><div><strong>{person.name}</strong><small>{person.email || person.phone || "Falta contacto"}</small><small>Canal: {person.preferredChannel}</small></div>
            <select aria-label={`Mover a ${person.name}`} value={island.id} disabled={busy || islands.length < 2} onChange={(event) => movePerson(person, event.target.value)}>{islands.map((target) => <option value={target.id} key={target.id}>{target.name}</option>)}</select>
            <select aria-label={`Canal de ${person.name}`} value={person.preferredChannel === "manual" ? "manual" : "email"} disabled={busy} onChange={(event) => changeChannel(person, event.target.value as "email" | "manual")}><option value="email">Email</option><option value="manual">Manual</option></select>
            <Button variant="secondary" size="icon" disabled={busy} onClick={() => editPerson(person)} aria-label={`Editar ${person.name}`}><Pencil size={17} /></Button>
            <Button variant="destructive" size="icon" disabled={busy} onClick={() => deletePerson(person)} aria-label={`Eliminar ${person.name}`}><Trash2 size={17} /></Button>
          </div>)}
          {!island.participants.length && <p className="family-editor__empty">Este núcleo todavía está vacío.</p>}
        </div>
      </article>)}
    </section>
    <aside className="family-editor__side">
      <div className="family-editor__panel"><h2>Añadir núcleo</h2><div className="family-editor__inline"><Input value={newIslandName} onChange={(event) => setNewIslandName(event.target.value)} placeholder="Ej. Núcleo Juan" /><Button size="icon" onClick={addIsland} disabled={busy}><Plus size={22} /></Button></div></div>
      <div className="family-editor__panel"><h2>Añadir persona</h2><p>{selectedIsland ? `Se añadirá a ${selectedIsland.name}.` : "Crea un núcleo primero."}</p><ParticipantForm value={participant} onChange={setParticipant} onSubmit={addParticipant} />{message && <p role="status">{message}</p>}</div>
    </aside>
  </div>;
}
