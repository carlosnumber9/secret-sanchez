import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, UserRound } from "lucide-react";
import { useMemo, useState } from "react";
import ParticipantForm, { type ParticipantDraft } from "../ParticipantForm/ParticipantForm";
import "./FamilyEditor.css";

type Participant = Omit<ParticipantDraft, "preferredChannel"> & {
  id: string;
  active: boolean;
  canGive: boolean;
  canReceive: boolean;
  preferredChannel: "email" | "whatsapp" | "both" | "manual";
};

type Island = {
  id: string;
  name: string;
  color: string;
  participants: Participant[];
};

type Props = {
  groupId: string;
  initialIslands: Island[];
};

const emptyParticipant: ParticipantDraft = {
  name: "",
  email: "",
  phone: "",
  preferredChannel: "email"
};

const colors = ["#d6a84f", "#b83232", "#2f7d59", "#3d6f9f", "#8b5a2b"];

type ApiResponse<T> = { ok: boolean; data?: T; message?: string };

export default function FamilyEditor({ groupId, initialIslands }: Props) {
  const [islands, setIslands] = useState(initialIslands);
  const [selectedIslandId, setSelectedIslandId] = useState(initialIslands[0]?.id ?? "");
  const [newIslandName, setNewIslandName] = useState("");
  const [participant, setParticipant] = useState(emptyParticipant);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  const selectedIsland = useMemo(
    () => islands.find((island) => island.id === selectedIslandId) ?? islands[0],
    [islands, selectedIslandId]
  );

  async function addIsland() {
    const cleanName = newIslandName.trim();
    if (!cleanName) return;
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch("/api/admin/islands", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          groupId,
          name: cleanName,
          color: colors[islands.length % colors.length]
        })
      });
      const payload = (await response.json()) as ApiResponse<Omit<Island, "participants">>;
      if (!response.ok || !payload.data) throw new Error(payload.message);
      const nextIsland = { ...payload.data, color: payload.data.color ?? colors[0], participants: [] };
      setIslands((current) => [...current, nextIsland]);
      setSelectedIslandId(nextIsland.id);
      setNewIslandName("");
      setMessage("Núcleo guardado.");
    } catch {
      setMessage("No se pudo guardar el núcleo.");
    } finally {
      setBusy(false);
    }
  }

  async function addParticipant() {
    if (!selectedIsland || !participant.name.trim()) return;
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch("/api/admin/participants", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...participant,
          groupId,
          familyIslandId: selectedIsland.id,
          name: participant.name.trim()
        })
      });
      const payload = (await response.json()) as ApiResponse<Participant & { familyIslandId: string }>;
      if (!response.ok || !payload.data) throw new Error(payload.message);
      setIslands((current) =>
        current.map((island) =>
          island.id === selectedIsland.id
            ? { ...island, participants: [...island.participants, payload.data as Participant] }
            : island
        )
      );
      setParticipant(emptyParticipant);
      setMessage("Persona guardada.");
    } catch {
      setMessage("No se pudo guardar la persona.");
    } finally {
      setBusy(false);
    }
  }

  async function toggleParticipant(islandId: string, person: Participant) {
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch(`/api/admin/participants/${person.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ active: !person.active })
      });
      const payload = (await response.json()) as ApiResponse<Participant>;
      if (!response.ok || !payload.data) throw new Error(payload.message);
      setIslands((current) =>
        current.map((island) =>
          island.id === islandId
            ? {
                ...island,
                participants: island.participants.map((currentPerson) =>
                  currentPerson.id === person.id ? { ...currentPerson, active: payload.data!.active } : currentPerson
                )
              }
            : island
        )
      );
      setMessage("Estado actualizado.");
    } catch {
      setMessage("No se pudo actualizar la persona.");
    } finally {
      setBusy(false);
    }
  }

  async function useManualChannel(islandId: string, person: Participant) {
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch(`/api/admin/participants/${person.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ preferredChannel: "manual" })
      });
      const payload = (await response.json()) as ApiResponse<Participant>;
      if (!response.ok || !payload.data) throw new Error(payload.message);
      setIslands((current) =>
        current.map((island) =>
          island.id === islandId
            ? {
                ...island,
                participants: island.participants.map((currentPerson) =>
                  currentPerson.id === person.id
                    ? { ...currentPerson, preferredChannel: "manual" }
                    : currentPerson
                )
              }
            : island
        )
      );
      setMessage("Canal cambiado a entrega manual.");
    } catch {
      setMessage("No se pudo actualizar el canal.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="family-editor">
      <section className="family-editor__board" aria-label="Núcleos familiares">
        {islands.map((island) => (
          <article className="family-editor__island" key={island.id} style={{ borderTopColor: island.color }}>
            <Button
              className="family-editor__island-title"
              variant="ghost"
              type="button"
              onClick={() => setSelectedIslandId(island.id)}
              aria-pressed={selectedIslandId === island.id}
            >
              <span style={{ background: island.color }} />
              {island.name}
            </Button>
            <div className="family-editor__people">
              {island.participants.map((person) => (
                <div className="family-editor__person" key={person.id}>
                  <UserRound size={20} />
                  <div>
                    <strong>{person.name}</strong>
                    <small>{person.email || person.phone || "Falta contacto"}</small>
                    <small>Canal: {person.preferredChannel}</small>
                  </div>
                  {(
                    person.preferredChannel === "whatsapp" ||
                    person.preferredChannel === "both" ||
                    (person.preferredChannel === "email" && !person.email)
                  ) && (
                    <Button
                      variant="secondary"
                      size="sm"
                      type="button"
                      disabled={busy}
                      onClick={() => useManualChannel(island.id, person)}
                    >
                      Usar manual
                    </Button>
                  )}
                  <Button
                    variant="secondary"
                    size="sm"
                    type="button"
                    disabled={busy}
                    onClick={() => toggleParticipant(island.id, person)}
                  >
                    {person.active ? "Activo" : "Inactivo"}
                  </Button>
                </div>
              ))}
              {island.participants.length === 0 && (
                <p className="family-editor__empty">Este núcleo todavía está vacío.</p>
              )}
            </div>
          </article>
        ))}
      </section>

      <aside className="family-editor__side">
        <div className="family-editor__panel">
          <h2>Añadir núcleo</h2>
          <div className="family-editor__inline">
            <Input
              className="h-10"
              value={newIslandName}
              onChange={(event) => setNewIslandName(event.target.value)}
              placeholder="Ej. Núcleo Juan"
            />
            <Button
              className="size-10"
              size="icon"
              type="button"
              onClick={addIsland}
              disabled={busy}
              aria-label="Añadir núcleo familiar"
            >
              <Plus size={22} />
            </Button>
          </div>
        </div>
        <div className="family-editor__panel">
          <h2>Añadir persona</h2>
          <p>{selectedIsland ? `Se añadirá a ${selectedIsland.name}.` : "Crea un núcleo primero."}</p>
          <ParticipantForm value={participant} onChange={setParticipant} onSubmit={addParticipant} />
          {message && <p role="status">{message}</p>}
        </div>
      </aside>
    </div>
  );
}
