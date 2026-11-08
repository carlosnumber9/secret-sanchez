import { Popover } from "@base-ui/react/popover";
import { availableDeliveryChannel, normalizePhone } from "@/lib/contact";
import { createSerialQueue } from "@/lib/serial-queue";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  MeasuringStrategy,
  MouseSensor,
  TouchSensor,
  closestCenter,
  getFirstCollision,
  pointerWithin,
  rectIntersection,
  useSensor,
  useSensors,
  type Announcements,
  type CollisionDetection,
  type DragCancelEvent,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
  type KeyboardCoordinateGetter,
  type UniqueIdentifier
} from "@dnd-kit/core";
import { SortableContext, arrayMove, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  Baby,
  CircleAlert,
  GripVertical,
  HousePlus,
  Trash2,
  UserPlus
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from "react";
import CreateDialog from "../CreateDialog/CreateDialog";
import ParticipantForm, {
  participantDraftIsValid,
  participantEmailIsValid,
  participantPhoneIsValid,
  type ParticipantDraft
} from "../ParticipantForm/ParticipantForm";
import InlineName from "./InlineName";
import ContactPreferenceInput from "./ContactPreferenceInput";
import MoveMenu from "./MoveMenu";
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
type Props = { familyId: string; initialIslands: InitialIsland[]; initialRevision: string };
type ApiResponse<T> = { ok: boolean; data?: T; message?: string };
type IslandDragData = { type: "island"; islandId: string; name: string; participantCount: number };
type ParticipantDragData = { type: "participant"; participantId: string; islandId: string; name: string; islandName: string };
type DragData = IslandDragData | ParticipantDragData;
type SortableHandleProps = Pick<ReturnType<typeof useSortable>, "attributes" | "listeners" | "setActivatorNodeRef">;

const emptyParticipant: ParticipantDraft = { name: "", email: "", phone: "", preferredChannel: null, isBaby: false };
const colors = ["#d6a84f", "#b83232", "#2f7d59", "#3d6f9f", "#8b5a2b"];

const islandDndId = (id: string) => `island:${id}`;
const participantDndId = (id: string) => `participant:${id}`;

function isDragData(value: unknown): value is DragData {
  if (!value || typeof value !== "object" || !("type" in value)) return false;
  return value.type === "island" || value.type === "participant";
}

function dragData(value: unknown): DragData | null {
  return isDragData(value) ? value : null;
}

const familyKeyboardCoordinates: KeyboardCoordinateGetter = (event, args) => {
  if (dragData(args.context.active?.data.current)?.type !== "island") {
    return sortableKeyboardCoordinates(event, args);
  }
  const droppableRects = new Map([...args.context.droppableRects].filter(([id]) =>
    dragData(args.context.droppableContainers.get(id)?.data.current)?.type === "island"
  ));
  return sortableKeyboardCoordinates(event, { ...args, context: { ...args.context, droppableRects } });
};

function findParticipantLocation(islands: Island[], participantId: string) {
  for (const island of islands) {
    const participantIndex = island.participants.findIndex(({ clientId }) => clientId === participantId);
    if (participantIndex >= 0) return { island, participantIndex };
  }
  return null;
}

function moveParticipantInIslands(islands: Island[], participantId: string, targetIslandId: string, requestedIndex: number) {
  const source = findParticipantLocation(islands, participantId);
  const target = islands.find(({ clientId }) => clientId === targetIslandId);
  if (!source || !target) return islands;

  if (source.island.clientId === targetIslandId) {
    const targetIndex = Math.max(0, Math.min(requestedIndex, source.island.participants.length - 1));
    if (source.participantIndex === targetIndex) return islands;
    return islands.map((island) => island.clientId === targetIslandId
      ? { ...island, participants: arrayMove(island.participants, source.participantIndex, targetIndex) }
      : island);
  }

  const participant = source.island.participants[source.participantIndex];
  return islands.map((island) => {
    if (island.clientId === source.island.clientId) {
      return { ...island, participants: island.participants.filter(({ clientId }) => clientId !== participantId) };
    }
    if (island.clientId === targetIslandId) {
      const targetIndex = Math.max(0, Math.min(requestedIndex, island.participants.length));
      const participants = [...island.participants];
      participants.splice(targetIndex, 0, participant);
      return { ...island, participants };
    }
    return island;
  });
}

function compatibleChannel(channel: PreferredChannel, email: string, phone: string): PreferredChannel {
  return availableDeliveryChannel(channel, participantEmailIsValid(email), participantPhoneIsValid(phone));
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

function SortableIsland({ island, disabled, saving, children }: {
  island: Island;
  disabled: boolean;
  saving: boolean;
  children: (handle: SortableHandleProps) => ReactNode;
}) {
  const {
    attributes,
    listeners,
    setActivatorNodeRef,
    setNodeRef,
    transform,
    transition,
    isDragging,
    isOver
  } = useSortable({
    id: islandDndId(island.clientId),
    data: {
      type: "island",
      islandId: island.clientId,
      name: island.name,
      participantCount: island.participants.length
    } satisfies IslandDragData,
    disabled
  });
  const style = {
    borderTopColor: island.color,
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 2 : undefined
  } satisfies CSSProperties;

  return <article
    ref={setNodeRef}
    className={`family-editor__island${isOver ? " is-drag-target" : ""}${isDragging ? " is-dragging" : ""}`}
    style={style}
    aria-busy={saving}
  >
    {children({ attributes, listeners, setActivatorNodeRef })}
  </article>;
}

function SortableParticipant({ island, person, disabled, saving, children }: {
  island: Island;
  person: Participant;
  disabled: boolean;
  saving: boolean;
  children: (handle: SortableHandleProps) => ReactNode;
}) {
  const {
    attributes,
    listeners,
    setActivatorNodeRef,
    setNodeRef,
    transform,
    transition,
    isDragging,
    isOver
  } = useSortable({
    id: participantDndId(person.clientId),
    data: {
      type: "participant",
      participantId: person.clientId,
      islandId: island.clientId,
      name: person.name,
      islandName: island.name
    } satisfies ParticipantDragData,
    disabled
  });
  const previousBaby = useRef(person.isBaby);
  const [babyTransition, setBabyTransition] = useState<"on" | "off" | null>(null);
  useEffect(() => {
    if (previousBaby.current === person.isBaby) return;
    previousBaby.current = person.isBaby;
    setBabyTransition(person.isBaby ? "on" : "off");
    const timeout = window.setTimeout(() => setBabyTransition(null), 1000);
    return () => window.clearTimeout(timeout);
  }, [person.isBaby]);
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 1 : undefined,
    position: "relative"
  } satisfies CSSProperties;

  return <li
    ref={setNodeRef}
    className={`family-editor__participant-row${person.isBaby ? " is-baby" : ""}${babyTransition ? ` is-baby-changing-${babyTransition}` : ""}${isOver ? " is-drag-target" : ""}${isDragging ? " is-dragging" : ""}`}
    style={style}
    data-participant-row
    aria-busy={saving}
  >
    {children({ attributes, listeners, setActivatorNodeRef })}
  </li>;
}

function BabyToggle({ person, disabled, onConfirm }: {
  person: Participant;
  disabled: boolean;
  onConfirm: () => void;
}) {
  const [open, setOpen] = useState(false);

  return <Popover.Root modal open={open} onOpenChange={setOpen}>
    <Popover.Trigger
      className="family-editor__baby-check"
      type="button"
      aria-pressed={person.isBaby}
      aria-label={`Marcar a ${person.name} como ${person.isBaby ? "adulto" : "bebé"}`}
      title={person.isBaby ? "Marcar como adulto" : "Marcar como bebé"}
      disabled={disabled}
    ><Baby aria-hidden="true" /></Popover.Trigger>
    <Popover.Portal>
      <Popover.Positioner className="family-editor__baby-positioner" side="top" align="end" sideOffset={10} collisionPadding={16}>
        <Popover.Popup className="family-editor__baby-popover">
          <Popover.Arrow className="family-editor__baby-arrow" />
          <Popover.Title className="family-editor__baby-title">{person.isBaby ? "¿Dejar de ser bebé?" : "¿Marcar como bebé?"}</Popover.Title>
          <Popover.Description className="family-editor__baby-description">
            {person.isBaby
              ? `${person.name} pasará a ser adulto y podrá regalar. Podrás añadir su contacto en la fila.`
              : `${person.name} recibirá sin regalar y se eliminarán sus datos de contacto.`}
          </Popover.Description>
          <div className="family-editor__baby-confirm-actions">
            <Popover.Close render={<Button variant="ghost" />}>Cancelar</Popover.Close>
            <Button onClick={() => { setOpen(false); onConfirm(); }} disabled={disabled}>Confirmar</Button>
          </div>
        </Popover.Popup>
      </Popover.Positioner>
    </Popover.Portal>
  </Popover.Root>;
}

const announcements: Announcements = {
  onDragStart({ active }) {
    const data = dragData(active.data.current);
    if (!data) return;
    return data.type === "island"
      ? `Has empezado a mover la unidad ${data.name}.`
      : `Has empezado a mover a ${data.name}.`;
  },
  onDragOver({ active, over }) {
    const activeData = dragData(active.data.current);
    const overData = dragData(over?.data.current);
    if (!activeData || !overData) return;
    if (activeData.type === "island" && overData.type === "island") {
      return `${activeData.name} está sobre la unidad ${overData.name}.`;
    }
    if (activeData.type === "participant") {
      return overData.type === "participant"
        ? `${activeData.name} está sobre ${overData.name}, en ${overData.islandName}.`
        : `${activeData.name} está sobre la unidad ${overData.name}.`;
    }
  },
  onDragEnd({ active, over }) {
    const activeData = dragData(active.data.current);
    const overData = dragData(over?.data.current);
    if (!activeData) return;
    if (!overData) return `No se ha movido ${activeData.name}.`;
    return activeData.type === "island"
      ? `La unidad ${activeData.name} ha cambiado de posición.`
      : `${activeData.name} se ha movido correctamente.`;
  },
  onDragCancel({ active }) {
    const data = dragData(active.data.current);
    return data ? `Se ha cancelado el movimiento de ${data.name}.` : undefined;
  }
};

const screenReaderInstructions = {
  draggable: "Para empezar a mover, pulsa espacio o Intro. Usa las flechas para elegir una posición, espacio o Intro para soltar y Escape para cancelar."
};

export default function FamilyEditor({ familyId, initialIslands, initialRevision }: Props) {
  const preparedInitialIslands = useMemo(() => prepareInitialIslands(initialIslands), [initialIslands]);
  const [islands, setIslands] = useState(preparedInitialIslands);
  const savedIslandsRef = useRef(preparedInitialIslands);
  const revisionRef = useRef(initialRevision);
  const [enqueue] = useState(createSerialQueue);
  const [pendingCount, setPendingCount] = useState(0);
  const [dirtyContacts, setDirtyContacts] = useState<Set<string>>(() => new Set());
  const busyRef = useRef(false);
  const [dialogError, setDialogError] = useState("");
  const [selectedIslandId, setSelectedIslandId] = useState(preparedInitialIslands[0]?.clientId ?? "");
  const [newIslandName, setNewIslandName] = useState("");
  const [participant, setParticipant] = useState(emptyParticipant);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [activeDrag, setActiveDrag] = useState<DragData | null>(null);
  const islandDialogRef = useRef<HTMLDialogElement>(null);
  const participantDialogRef = useRef<HTMLDialogElement>(null);
  const dragStartSnapshotRef = useRef<Island[] | null>(null);
  const lastOverIdRef = useRef<UniqueIdentifier | null>(null);
  const recentlyMovedRef = useRef(false);
  const formIslands = useMemo(() => islands.map(({ clientId, name }) => ({ id: clientId, name })), [islands]);
  const selectedIsland = useMemo(
    () => islands.find((island) => island.clientId === selectedIslandId) ?? islands[0],
    [islands, selectedIslandId]
  );
  const totals = useMemo(() => {
    const people = islands.flatMap(({ participants }) => participants);
    return { units: islands.length, people: people.length, babies: people.filter(({ isBaby }) => isBaby).length };
  }, [islands]);
  const dirty = pendingCount > 0 || dirtyContacts.size > 0;
  const editingDisabled = busy || activeDrag !== null;
  const setContactDirty = useCallback((key: string, changed: boolean) => {
    setDirtyContacts((current) => {
      if (current.has(key) === changed) return current;
      const next = new Set(current);
      if (changed) next.add(key);
      else next.delete(key);
      return next;
    });
  }, []);
  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 180, tolerance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: familyKeyboardCoordinates })
  );
  const collisionDetectionStrategy = useCallback<CollisionDetection>((args) => {
    const activeData = dragData(args.active.data.current);
    if (!activeData) return [];

    if (activeData.type === "island") {
      return closestCenter({
        ...args,
        droppableContainers: args.droppableContainers.filter(
          (container) => dragData(container.data.current)?.type === "island"
        )
      });
    }

    const droppableContainers = args.droppableContainers.filter((container) => {
      const data = dragData(container.data.current);
      return data?.type === "participant" || data?.type === "island";
    });
    const collisionArgs = { ...args, droppableContainers };
    const pointerIntersections = pointerWithin(collisionArgs);
    const intersections = pointerIntersections.length > 0
      ? pointerIntersections
      : rectIntersection(collisionArgs);
    let overId = getFirstCollision(intersections, "id");

    if (overId != null) {
      const overContainer = droppableContainers.find((container) => container.id === overId);
      const overData = dragData(overContainer?.data.current);
      if (overData?.type === "island") {
        const targetIsland = islands.find(({ clientId }) => clientId === overData.islandId);
        if (targetIsland?.participants.length) {
          overId = closestCenter({
            ...args,
            droppableContainers: droppableContainers.filter((container) => {
              const data = dragData(container.data.current);
              return data?.type === "participant" && data.islandId === targetIsland.clientId;
            })
          })[0]?.id ?? overId;
        }
      }
      lastOverIdRef.current = overId;
      return [{ id: overId }];
    }

    if (recentlyMovedRef.current) lastOverIdRef.current = args.active.id;
    return lastOverIdRef.current ? [{ id: lastOverIdRef.current }] : [];
  }, [islands]);

  useEffect(() => {
    const warnBeforeLeaving = (event: BeforeUnloadEvent) => {
      if (!dirty) return;
      event.preventDefault();
      event.returnValue = "Hay cambios sin guardar.";
    };
    window.addEventListener("beforeunload", warnBeforeLeaving);
    return () => window.removeEventListener("beforeunload", warnBeforeLeaving);
  }, [dirty]);

  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      recentlyMovedRef.current = false;
    });
    return () => cancelAnimationFrame(frame);
  }, [islands]);

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
    setDialogError("");
    islandDialogRef.current?.showModal();
  }

  function showParticipantDialog(islandId = selectedIsland?.clientId ?? islands[0]?.clientId ?? "") {
    if (!islands.length) return;
    setParticipant(emptyParticipant);
    setDialogError("");
    setSelectedIslandId(islandId);
    participantDialogRef.current?.showModal();
  }

  async function persistChange(update: (current: Island[]) => Island[], deletions: {
    participants?: string[]; islands?: string[];
  } = {}) {
    setPendingCount((count) => count + 1);
    try {
      return await enqueue(async () => {
        const next = update(savedIslandsRef.current);
        const payload = {
          revision: revisionRef.current,
          islands: next.map(({ clientId, id, name, color }) => ({ clientId, id, name, color })),
          participants: next.flatMap((island) => island.participants.map((person, sortOrder) => ({
            clientId: person.clientId, id: person.id, familyIslandClientId: island.clientId,
            name: person.name, email: person.isBaby ? "" : person.email, phone: person.isBaby ? "" : person.phone,
            preferredChannel: person.isBaby ? null : person.preferredChannel, isBaby: person.isBaby, sortOrder
          }))),
          confirmedParticipantDeletionIds: deletions.participants ?? [],
          confirmedIslandDeletionIds: deletions.islands ?? []
        };
        const updated = await api<{ revision: string; islands: Island[] }>(`/api/admin/families/${familyId}/layout`, "PATCH", payload);
        savedIslandsRef.current = updated.islands;
        revisionRef.current = updated.revision;
        setIslands(updated.islands);
        setSelectedIslandId((current) => updated.islands.some(({ clientId }) => clientId === current) ? current : updated.islands[0]?.clientId ?? "");
        setMessage("Cambios guardados.");
        return updated.islands;
      });
    } catch (error) {
      showError(error);
      throw error;
    } finally {
      setPendingCount((count) => count - 1);
    }
  }

  async function locked<T>(work: () => Promise<T>) {
    if (busyRef.current) throw new Error("Espera a que termine la operación actual.");
    busyRef.current = true;
    setBusy(true);
    try { return await work(); }
    finally { busyRef.current = false; setBusy(false); }
  }

  function showError(error: unknown) {
    setMessage(error instanceof Error ? error.message : "No se pudo guardar el cambio.");
  }

  async function addIsland() {
    const name = newIslandName.trim();
    if (!name) return;
    const created: Island = { id: null, clientId: `island-${crypto.randomUUID()}`, name, color: colors[islands.length % colors.length], participants: [] };
    try {
      await locked(() => persistChange((current) => [...current, created]));
      setSelectedIslandId(created.clientId);
      setNewIslandName("");
      islandDialogRef.current?.close();
    } catch (error) {
      setDialogError(error instanceof Error ? error.message : "No se pudo añadir la unidad.");
    }
  }

  async function addParticipant() {
    const draft = { ...participant, email: participant.email.trim(), phone: normalizePhone(participant.phone) };
    if (!selectedIsland || !participantDraftIsValid(draft, selectedIsland.clientId, formIslands)) return;
    const created: Participant = { ...draft, id: null, clientId: `participant-${crypto.randomUUID()}`, preferredChannel: draft.isBaby ? null : draft.preferredChannel, sortOrder: selectedIsland.participants.length };
    const islandId = selectedIsland.clientId;
    try {
      await locked(() => persistChange((current) => current.map((island) => island.clientId === islandId
        ? { ...island, participants: [...island.participants, created] } : island)));
      setParticipant(emptyParticipant);
      participantDialogRef.current?.close();
    } catch (error) {
      setDialogError(error instanceof Error ? error.message : "No se pudo añadir la persona.");
    }
  }

  function updatePerson(current: Island[], clientId: string, update: (person: Participant) => Participant) {
    return current.map((island) => ({ ...island, participants: island.participants.map((person) => person.clientId === clientId ? update(person) : person) }));
  }

  async function saveName(kind: "island" | "participant", target: Island | Participant, name: string) {
    await locked(() => persistChange((current) => kind === "island"
      ? current.map((island) => island.clientId === target.clientId ? { ...island, name } : island)
      : updatePerson(current, target.clientId, (person) => ({ ...person, name }))));
  }

  async function saveContact(person: Participant, field: "email" | "phone", value: string, toggle: boolean) {
    await persistChange((current) => updatePerson(current, person.clientId, (saved) => {
      if (saved.isBaby) throw new Error("Los bebés no tienen contacto propio.");
      const email = field === "email" ? value : saved.email;
      const phone = field === "phone" ? value : saved.phone;
      let preferredChannel = compatibleChannel(saved.preferredChannel, email, phone);
      if (toggle) {
        const usesEmail = preferredChannel === "email" || preferredChannel === "both";
        const usesWhatsapp = preferredChannel === "whatsapp" || preferredChannel === "both";
        const nextEmail = field === "email" ? !usesEmail : usesEmail;
        const nextWhatsapp = field === "phone" ? !usesWhatsapp : usesWhatsapp;
        preferredChannel = nextEmail ? (nextWhatsapp ? "both" : "email") : (nextWhatsapp ? "whatsapp" : null);
      }
      return { ...saved, email, phone, preferredChannel };
    }));
  }

  async function toggleBaby(person: Participant) {
    try {
      await locked(() => persistChange((current) => updatePerson(current, person.clientId, (saved) => ({
        ...saved, isBaby: !saved.isBaby, email: "", phone: "", preferredChannel: null
      }))));
    } catch (error) { showError(error); }
  }

  async function deletePerson(person: Participant) {
    try {
      await locked(async () => {
        const impact = await api<{ draws: number; assignments: number; notifications: number; opened: number }>(`/api/admin/participants/${person.id}/deletion-impact`, "GET");
        const warning = `Se eliminará a ${person.name}. Se eliminarán ${impact.draws} repartos completos, ${impact.assignments} asignaciones, ${impact.notifications} logs y ${impact.opened} aperturas. Escribe ELIMINAR PERSONA para continuar.`;
        if (window.prompt(warning) !== "ELIMINAR PERSONA") return;
        await persistChange((current) => current.map((island) => ({ ...island,
          participants: island.participants.filter(({ clientId }) => clientId !== person.clientId)
        })), { participants: person.id ? [person.id] : [] });
      });
    } catch (error) { showError(error); }
  }

  async function deleteIsland(island: Island) {
    try {
      await locked(async () => {
        const impact = await api<{ draws: number }>(`/api/admin/islands/${island.id}/deletion-impact`, "GET");
        const alternatives = savedIslandsRef.current.filter(({ clientId }) => clientId !== island.clientId);
        let targetId: string | undefined;
        if (island.participants.length && alternatives.length) {
          const answer = window.prompt(`La unidad ${island.name} contiene ${island.participants.length} personas. Escribe MOVER para trasladarlas o ELIMINAR UNIDAD para borrarlas con ${impact.draws} repartos afectados.`);
          if (answer === "MOVER") {
            const destination = window.prompt(`Destino: ${alternatives.map(({ name }) => name).join(", ")}`);
            targetId = alternatives.find(({ name }) => name.toLowerCase() === destination?.trim().toLowerCase())?.clientId;
            if (!targetId) throw new Error("No se ha encontrado la unidad de destino.");
          } else if (answer !== "ELIMINAR UNIDAD") return;
        } else if (island.participants.length) {
          if (window.prompt(`Escribe ELIMINAR UNIDAD para borrar ${island.name}, sus ${island.participants.length} integrantes y ${impact.draws} repartos afectados.`) !== "ELIMINAR UNIDAD") return;
        } else if (!window.confirm(`¿Eliminar la unidad ${island.name}?`)) return;
        await persistChange((current) => {
          const source = current.find(({ clientId }) => clientId === island.clientId)!;
          return current.filter(({ clientId }) => clientId !== island.clientId).map((item) => item.clientId === targetId
            ? { ...item, participants: [...item.participants, ...source.participants] } : item);
        }, { islands: island.id ? [island.id] : [], participants: targetId ? [] : island.participants.flatMap(({ id }) => id ? [id] : []) });
      });
    } catch (error) { showError(error); }
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
      savedIslandsRef.current = next;
      return next;
    });
    setMessage("Orden visual actualizado. Este orden no se guarda en la base de datos.");
  }

  async function movePerson(personId: string, direction: -1 | 1, destinationId?: string) {
    await locked(() => persistChange((current) => {
      const source = findParticipantLocation(current, personId);
      if (!source) throw new Error("La persona ya no está disponible.");
      const target = destinationId ? current.find(({ clientId }) => clientId === destinationId) : source.island;
      if (!target) throw new Error("La unidad de destino ya no está disponible.");
      const index = destinationId ? target.participants.length : source.participantIndex + direction;
      return moveParticipantInIslands(current, personId, target.clientId, index);
    }));
  }

  async function moveUnit(islandId: string, direction: -1 | 1) {
    if (busyRef.current) return;
    const index = islands.findIndex(({ clientId }) => clientId === islandId);
    const target = islands[index + direction];
    if (target) reorderIsland(islandId, target.clientId);
  }

  function finishDrag() {
    setActiveDrag(null);
    dragStartSnapshotRef.current = null;
    lastOverIdRef.current = null;
    recentlyMovedRef.current = false;
  }

  function restoreDragSnapshot() {
    if (dragStartSnapshotRef.current) setIslands(dragStartSnapshotRef.current);
    finishDrag();
  }

  function handleDragStart(event: DragStartEvent) {
    const data = dragData(event.active.data.current);
    if (!data) return;
    dragStartSnapshotRef.current = islands;
    lastOverIdRef.current = event.active.id;
    setActiveDrag(data);
  }

  function handleDragOver(event: DragOverEvent) {
    const activeData = dragData(event.active.data.current);
    const overData = dragData(event.over?.data.current);
    if (activeData?.type !== "participant" || !overData) return;

    setIslands((current) => {
      const source = findParticipantLocation(current, activeData.participantId);
      const targetIslandId = overData.type === "island"
        ? overData.islandId
        : findParticipantLocation(current, overData.participantId)?.island.clientId;
      if (!source || !targetIslandId || source.island.clientId === targetIslandId) return current;

      const targetIsland = current.find(({ clientId }) => clientId === targetIslandId);
      if (!targetIsland) return current;
      let targetIndex = targetIsland.participants.length;
      if (overData.type === "participant") {
        const overIndex = targetIsland.participants.findIndex(({ clientId }) => clientId === overData.participantId);
        const isBelowOverItem = Boolean(
          event.active.rect.current.translated && event.over &&
          event.active.rect.current.translated.top > event.over.rect.top + event.over.rect.height
        );
        targetIndex = overIndex >= 0 ? overIndex + (isBelowOverItem ? 1 : 0) : targetIsland.participants.length;
      }
      recentlyMovedRef.current = true;
      return moveParticipantInIslands(current, activeData.participantId, targetIslandId, targetIndex);
    });
  }

  function handleDragEnd(event: DragEndEvent) {
    const activeData = dragData(event.active.data.current);
    const overData = dragData(event.over?.data.current);
    if (!activeData) {
      finishDrag();
      return;
    }
    if (!overData) {
      if (activeData.type === "participant") restoreDragSnapshot();
      else finishDrag();
      setMessage("Movimiento cancelado: no había un destino válido.");
      return;
    }

    if (activeData.type === "island") {
      if (overData.type === "island") reorderIsland(activeData.islandId, overData.islandId);
      finishDrag();
      return;
    }

    let next = islands;
    if (overData.type === "participant") {
      const target = findParticipantLocation(islands, overData.participantId);
      if (target) next = moveParticipantInIslands(islands, activeData.participantId, target.island.clientId, target.participantIndex);
    } else {
      const target = islands.find(({ clientId }) => clientId === overData.islandId);
      if (target) next = moveParticipantInIslands(islands, activeData.participantId, target.clientId, target.participants.length);
    }
    setIslands(next);
    finishDrag();
    void locked(() => persistChange(() => next)).catch((error) => {
      setIslands(savedIslandsRef.current);
      showError(error);
    });
  }

  function handleDragCancel(_event: DragCancelEvent) {
    restoreDragSnapshot();
    setMessage("Movimiento cancelado.");
  }

  return <div className="family-editor">
    <div className="family-editor__hint">
      <GripVertical aria-hidden="true" />
      <div>
        <p>Mueve personas y unidades desde sus opciones o arrastrando el borde izquierdo.</p>
        <p>El sobre y el bocadillo eligen canales preferidos; no envían mensajes. El teléfono necesita prefijo internacional, por ejemplo +34.</p>
      </div>
    </div>

    <div className="family-editor__toolbar">
      <p className="family-editor__totals" aria-label="Resumen de la familia" aria-live="polite" aria-atomic="true">
        <span><strong>{totals.units}</strong> {totals.units === 1 ? "unidad" : "unidades"}</span>
        <span aria-hidden="true">·</span>
        <span><strong>{totals.people}</strong> {totals.people === 1 ? "persona" : "personas"} en total, con <strong>{totals.babies}</strong> {totals.babies === 1 ? "bebé" : "bebés"}</span>
      </p>
      <div className="family-editor__create-actions" aria-label="Añadir a la familia">
        <Button className="family-editor__create-button" size="icon-lg" onClick={showIslandDialog} disabled={editingDisabled} aria-label="Añadir unidad" title="Añadir unidad"><HousePlus /><span className="family-editor__desktop-label">Añadir unidad</span></Button>
        <Button className="family-editor__create-button" size="icon-lg" variant="secondary" onClick={() => showParticipantDialog()} disabled={editingDisabled || !islands.length} aria-label="Añadir persona" title={islands.length ? "Añadir persona" : "Crea una unidad primero"}><UserPlus /><span className="family-editor__desktop-label">Añadir persona</span></Button>
      </div>
    </div>

    <DndContext
      sensors={sensors}
      collisionDetection={collisionDetectionStrategy}
      measuring={{ droppable: { strategy: MeasuringStrategy.Always } }}
      accessibility={{ announcements, screenReaderInstructions }}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
      onDragCancel={handleDragCancel}
    >
      <section className="family-editor__board" aria-label="Unidades familiares">
        <SortableContext items={islands.map(({ clientId }) => islandDndId(clientId))} strategy={verticalListSortingStrategy}>
          {islands.map((island, islandIndex) => <SortableIsland island={island} disabled={busy || dirty} saving={busy || pendingCount > 0} key={island.clientId}>
            {({ attributes, listeners, setActivatorNodeRef }) => <>
              <header className="family-editor__island-header">
                <button
                  ref={setActivatorNodeRef}
                  className="family-editor__drag-edge"
                  type="button"
                  disabled={busy || dirty}
                  {...attributes}
                  {...listeners}
                  aria-label={`Mover la unidad ${island.name}`}
                  title={`Arrastrar para mover la unidad ${island.name}`}
                ><GripVertical aria-hidden="true" /></button>
                <span className="family-editor__island-color" style={{ background: island.color }} />
                <div>
                  <InlineName heading name={island.name} label="Nombre de la unidad" disabled={editingDisabled} onSave={(name) => saveName("island", island, name)} />
                  <p>{island.participants.length} {island.participants.length === 1 ? "persona" : "personas"}</p>
                </div>
                <div className="family-editor__island-actions">
                  <MoveMenu
                    name={island.name}
                    unit
                    disabled={editingDisabled || dirty}
                    canMoveUp={islandIndex > 0}
                    canMoveDown={islandIndex < islands.length - 1}
                    onMove={(direction) => moveUnit(island.clientId, direction)}
                  />
                  <button type="button" className="family-editor__action family-editor__action--delete" disabled={editingDisabled} onClick={() => deleteIsland(island)} aria-label={`Eliminar ${island.name}`} title={`Eliminar la unidad ${island.name}`}><Trash2 aria-hidden="true" /><span className="family-editor__desktop-label">Eliminar</span></button>
                </div>
              </header>

              <ul role="list" className="family-editor__participants" aria-label={`Familiares de ${island.name}`}>
                <SortableContext
                  items={island.participants.map(({ clientId }) => participantDndId(clientId))}
                  strategy={verticalListSortingStrategy}
                >
                  {island.participants.map((person, personIndex) => <SortableParticipant
                    island={island}
                    person={person}
                    disabled={busy || dirty}
                    saving={busy || pendingCount > 0}
                    key={person.clientId}
                  >
                    {({ attributes: participantAttributes, listeners: participantListeners, setActivatorNodeRef: setParticipantActivatorNodeRef }) => <>
                      <button
                        ref={setParticipantActivatorNodeRef}
                        className="family-editor__drag-edge"
                        type="button"
                        disabled={busy || dirty}
                        {...participantAttributes}
                        {...participantListeners}
                        aria-label={`Mover a ${person.name}`}
                        title={`Arrastrar para mover a ${person.name}`}
                      ><GripVertical aria-hidden="true" /></button>
                      <div className="family-editor__baby-cell">
                        <BabyToggle person={person} disabled={editingDisabled} onConfirm={() => toggleBaby(person)} />
                      </div>
                      <div className="family-editor__identity">
                        <InlineName name={person.name} label="Nombre del familiar" disabled={editingDisabled} onSave={(name) => saveName("participant", person, name)} />
                      </div>
                      <div className="family-editor__contact-fields" aria-hidden={person.isBaby || undefined}>
                        {!person.isBaby && <>
                          <ContactPreferenceInput
                            channel="email"
                            name={person.name}
                            value={person.email}
                            selected={person.preferredChannel === "email" || person.preferredChannel === "both"}
                            disabled={editingDisabled}
                            onCommit={(value, toggle) => saveContact(person, "email", value, toggle)}
                            onDirtyChange={(changed) => setContactDirty(`${person.clientId}:email`, changed)}
                          />
                          <ContactPreferenceInput
                            channel="whatsapp"
                            name={person.name}
                            value={person.phone}
                            selected={person.preferredChannel === "whatsapp" || person.preferredChannel === "both"}
                            disabled={editingDisabled}
                            onCommit={(value, toggle) => saveContact(person, "phone", value, toggle)}
                            onDirtyChange={(changed) => setContactDirty(`${person.clientId}:phone`, changed)}
                          />
                        </>}
                      </div>
                      <div className="family-editor__row-actions">
                        <MoveMenu
                          name={person.name}
                          disabled={editingDisabled || dirty}
                          canMoveUp={personIndex > 0}
                          canMoveDown={personIndex < island.participants.length - 1}
                          onMove={(direction) => movePerson(person.clientId, direction)}
                          destinations={islands.filter(({ clientId }) => clientId !== island.clientId).map(({ clientId, name }) => ({ id: clientId, name }))}
                          onMoveTo={(destination) => movePerson(person.clientId, 1, destination)}
                        />
                        <button type="button" className="family-editor__action family-editor__action--delete" disabled={editingDisabled} onClick={() => deletePerson(person)} aria-label={`Eliminar ${person.name}`} title={`Eliminar a ${person.name}`}><Trash2 aria-hidden="true" /><span className="family-editor__desktop-label">Eliminar</span></button>
                      </div>
                    </>}
                  </SortableParticipant>)}
                </SortableContext>
                {!island.participants.length && <li className="family-editor__empty">Añade una persona o muévela aquí desde otra unidad.</li>}
              </ul>
            </>}
          </SortableIsland>)}
        </SortableContext>
        {!islands.length && <div className="family-editor__empty-state">
          <CircleAlert />
          <h2>La familia todavía no tiene unidades</h2>
          <p>Crea la primera unidad para empezar a añadir familiares.</p>
        </div>}
      </section>

      <DragOverlay adjustScale={false}>
        {activeDrag?.type === "island" && <div className="family-editor__drag-preview family-editor__drag-preview--island">
          <GripVertical aria-hidden="true" />
          <div><strong>{activeDrag.name}</strong><small>{activeDrag.participantCount} {activeDrag.participantCount === 1 ? "persona" : "personas"}</small></div>
        </div>}
        {activeDrag?.type === "participant" && <div className="family-editor__drag-preview family-editor__drag-preview--participant">
          <GripVertical aria-hidden="true" />
          <div><strong>{activeDrag.name}</strong><small>{activeDrag.islandName}</small></div>
        </div>}
      </DragOverlay>
    </DndContext>

    <p className="family-editor__status" role="status" aria-live="polite">{pendingCount > 0 ? "Guardando cambios…" : message}</p>

    <CreateDialog ref={islandDialogRef} title="Añadir unidad" description="Crea un hogar o núcleo familiar.">
      <form className="create-dialog__form" onSubmit={(event) => { event.preventDefault(); addIsland(); }}>
        <label className="form-field">
          Nombre de la unidad
          <Input autoFocus disabled={editingDisabled} value={newIslandName} onChange={(event) => setNewIslandName(event.target.value)} placeholder="Ej. Casa de Juan" required maxLength={180} />
        </label>
        <Button className="min-h-10 w-full" size="lg" type="submit" disabled={editingDisabled || !newIslandName.trim()}>Añadir unidad</Button>
      </form>
      {dialogError && <p role="alert">{dialogError}</p>}
    </CreateDialog>

    <CreateDialog ref={participantDialogRef} title="Añadir persona" description="Completa sus datos y elige una unidad.">
      <ParticipantForm
        value={participant}
        islandId={selectedIsland?.clientId ?? ""}
        islands={formIslands}
        disabled={editingDisabled}
        onChange={setParticipant}
        onIslandChange={setSelectedIslandId}
        onSubmit={addParticipant}
      />
      {dialogError && <p role="alert">{dialogError}</p>}
    </CreateDialog>
  </div>;
}
