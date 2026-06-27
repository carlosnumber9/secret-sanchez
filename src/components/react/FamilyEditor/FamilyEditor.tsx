import { Plus, UserRound } from "lucide-react";
import { useMemo, useState } from "react";
import ParticipantForm, { type ParticipantDraft } from "../ParticipantForm/ParticipantForm";
import "./FamilyEditor.css";

type Participant = ParticipantDraft & {
  id: string;
  active: boolean;
};

type Island = {
  id: string;
  name: string;
  color: string;
  participants: Participant[];
};

type Props = {
  initialIslands: Island[];
};

const emptyParticipant: ParticipantDraft = {
  name: "",
  email: "",
  phone: "",
  preferredChannel: "email"
};

const colors = ["#d6a84f", "#b83232", "#2f7d59", "#3d6f9f", "#8b5a2b"];

export default function FamilyEditor({ initialIslands }: Props) {
  const [islands, setIslands] = useState(initialIslands);
  const [selectedIslandId, setSelectedIslandId] = useState(initialIslands[0]?.id ?? "");
  const [newIslandName, setNewIslandName] = useState("");
  const [participant, setParticipant] = useState(emptyParticipant);

  const selectedIsland = useMemo(
    () => islands.find((island) => island.id === selectedIslandId) ?? islands[0],
    [islands, selectedIslandId]
  );

  function addIsland() {
    const cleanName = newIslandName.trim();
    if (!cleanName) return;
    const nextIsland = {
      id: crypto.randomUUID(),
      name: cleanName,
      color: colors[islands.length % colors.length],
      participants: []
    };
    setIslands((current) => [...current, nextIsland]);
    setSelectedIslandId(nextIsland.id);
    setNewIslandName("");
  }

  function addParticipant() {
    if (!selectedIsland || !participant.name.trim()) return;
    setIslands((current) =>
      current.map((island) =>
        island.id === selectedIsland.id
          ? {
              ...island,
              participants: [
                ...island.participants,
                { ...participant, id: crypto.randomUUID(), name: participant.name.trim(), active: true }
              ]
            }
          : island
      )
    );
    setParticipant(emptyParticipant);
  }

  function toggleParticipant(islandId: string, participantId: string) {
    setIslands((current) =>
      current.map((island) =>
        island.id === islandId
          ? {
              ...island,
              participants: island.participants.map((person) =>
                person.id === participantId ? { ...person, active: !person.active } : person
              )
            }
          : island
      )
    );
  }

  return (
    <div className="family-editor">
      <section className="family-editor__board" aria-label="Núcleos familiares">
        {islands.map((island) => (
          <article className="family-editor__island" key={island.id} style={{ borderTopColor: island.color }}>
            <button
              className="family-editor__island-title"
              type="button"
              onClick={() => setSelectedIslandId(island.id)}
              aria-pressed={selectedIslandId === island.id}
            >
              <span style={{ background: island.color }} />
              {island.name}
            </button>
            <div className="family-editor__people">
              {island.participants.map((person) => (
                <div className="family-editor__person" key={person.id}>
                  <UserRound size={20} />
                  <div>
                    <strong>{person.name}</strong>
                    <small>{person.email || person.phone || "Falta contacto"}</small>
                  </div>
                  <button type="button" onClick={() => toggleParticipant(island.id, person.id)}>
                    {person.active ? "Activo" : "Inactivo"}
                  </button>
                </div>
              ))}
              {island.participants.length === 0 && <p>Este núcleo todavía está vacío.</p>}
            </div>
          </article>
        ))}
      </section>

      <aside className="family-editor__side">
        <div className="family-editor__panel">
          <h2>Añadir núcleo</h2>
          <div className="family-editor__inline">
            <input
              className="input"
              value={newIslandName}
              onChange={(event) => setNewIslandName(event.target.value)}
              placeholder="Ej. Núcleo Juan"
            />
            <button type="button" onClick={addIsland} aria-label="Añadir núcleo familiar">
              <Plus size={22} />
            </button>
          </div>
        </div>
        <div className="family-editor__panel">
          <h2>Añadir persona</h2>
          <p>{selectedIsland ? `Se añadirá a ${selectedIsland.name}.` : "Crea un núcleo primero."}</p>
          <ParticipantForm value={participant} onChange={setParticipant} onSubmit={addParticipant} />
        </div>
      </aside>
    </div>
  );
}
