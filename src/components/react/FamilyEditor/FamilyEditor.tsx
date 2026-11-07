import { Popover } from "@base-ui/react/popover";
import { availableDeliveryChannel } from "@/lib/contact";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
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
  type UniqueIdentifier
} from "@dnd-kit/core";
import { SortableContext, arrayMove, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  Baby,
  CircleAlert,
  GripVertical,
  HousePlus,
  Pencil,
  Save,
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

function SortableIsland({ island, disabled, children }: {
  island: Island;
  disabled: boolean;
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
  >
    {children({ attributes, listeners, setActivatorNodeRef })}
  </article>;
}

function SortableParticipant({ island, person, disabled, children }: {
  island: Island;
  person: Participant;
  disabled: boolean;
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

  return <TableRow
    ref={setNodeRef}
    className={`${person.isBaby ? "is-baby" : ""}${babyTransition ? ` is-baby-changing-${babyTransition}` : ""}${isOver ? " is-drag-target" : ""}${isDragging ? " is-dragging" : ""}`}
    style={style}
    data-participant-row
  >
    {children({ attributes, listeners, setActivatorNodeRef })}
  </TableRow>;
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
      aria-label={`${person.isBaby ? "Desmarcar" : "Marcar"} a ${person.name} como bebé`}
      title={`${person.isBaby ? "Desmarcar" : "Marcar"} como bebé`}
      disabled={disabled}
    ><Baby aria-hidden="true" /></Popover.Trigger>
    <Popover.Portal>
      <Popover.Positioner className="family-editor__baby-positioner" side="top" align="end" sideOffset={10} collisionPadding={16}>
        <Popover.Popup className="family-editor__baby-popover">
          <Popover.Arrow className="family-editor__baby-arrow" />
          <Popover.Title className="family-editor__baby-title">{person.isBaby ? "¿Dejar de ser bebé?" : "¿Marcar como bebé?"}</Popover.Title>
          <Popover.Description className="family-editor__baby-description">
            {person.isBaby
              ? `Al guardar la familia, ${person.name} pasará a ser adulto y podrá regalar. Podrás añadir su contacto en la fila.`
              : `Al guardar la familia, ${person.name} recibirá sin regalar y se eliminarán sus datos de contacto.`}
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
  const [revision, setRevision] = useState(initialRevision);
  const [savedSnapshot, setSavedSnapshot] = useState(() => familySnapshot(preparedInitialIslands));
  const [selectedIslandId, setSelectedIslandId] = useState(preparedInitialIslands[0]?.clientId ?? "");
  const [newIslandName, setNewIslandName] = useState("");
  const [participant, setParticipant] = useState(emptyParticipant);
  const [confirmedParticipantDeletionIds, setConfirmedParticipantDeletionIds] = useState<string[]>([]);
  const [confirmedIslandDeletionIds, setConfirmedIslandDeletionIds] = useState<string[]>([]);
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
  const dirty = useMemo(() => familySnapshot(islands) !== savedSnapshot, [islands, savedSnapshot]);
  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 180, tolerance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
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

    if (overData.type === "participant") {
      setIslands((current) => {
        const target = findParticipantLocation(current, overData.participantId);
        return target
          ? moveParticipantInIslands(current, activeData.participantId, target.island.clientId, target.participantIndex)
          : current;
      });
    } else {
      setIslands((current) => {
        const target = current.find(({ clientId }) => clientId === overData.islandId);
        return target
          ? moveParticipantInIslands(current, activeData.participantId, target.clientId, target.participants.length)
          : current;
      });
    }
    setMessage("Cambio pendiente. Pulsa Guardar familia para confirmarlo.");
    finishDrag();
  }

  function handleDragCancel(_event: DragCancelEvent) {
    restoreDragSnapshot();
    setMessage("Movimiento cancelado.");
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
        revision,
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
      const updated = await api<{ revision: string; islands: Array<Island & { id: string }> }>(`/api/admin/families/${familyId}/layout`, "PATCH", payload);
      const next: Island[] = updated.islands.map((island) => ({
        ...island,
        id: island.id,
        participants: island.participants.map((person) => ({ ...person, id: person.id }))
      }));
      setIslands(next);
      setSavedSnapshot(familySnapshot(next));
      setRevision(updated.revision);
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
      <p>Arrastra unidades completas o personas para ordenarlas y cambiarlas de unidad. También puedes usar espacio, las flechas y Escape desde cada tirador.</p>
    </div>

    <div className="family-editor__create-actions" aria-label="Añadir a la familia">
      <Button size="icon-lg" onClick={showIslandDialog} disabled={busy} aria-label="Añadir unidad" title="Añadir unidad"><HousePlus /></Button>
      <Button size="icon-lg" variant="secondary" onClick={() => showParticipantDialog()} disabled={busy || !islands.length} aria-label="Añadir persona" title={islands.length ? "Añadir persona" : "Crea una unidad primero"}><UserPlus /></Button>
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
          {islands.map((island) => <SortableIsland island={island} disabled={busy} key={island.clientId}>
            {({ attributes, listeners, setActivatorNodeRef }) => <>
              <header className="family-editor__island-header">
                <button
                  ref={setActivatorNodeRef}
                  className="family-editor__drag-handle"
                  type="button"
                  disabled={busy}
                  {...attributes}
                  {...listeners}
                  aria-label={`Mover la unidad ${island.name}`}
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
                  <SortableContext
                    items={island.participants.map(({ clientId }) => participantDndId(clientId))}
                    strategy={verticalListSortingStrategy}
                  >
                    {island.participants.map((person) => <SortableParticipant
                      island={island}
                      person={person}
                      disabled={busy}
                      key={person.clientId}
                    >
                      {({ attributes: participantAttributes, listeners: participantListeners, setActivatorNodeRef: setParticipantActivatorNodeRef }) => <>
                        <TableCell className="family-editor__handle-cell">
                          <button
                            ref={setParticipantActivatorNodeRef}
                            className="family-editor__drag-handle"
                            type="button"
                            disabled={busy}
                            {...participantAttributes}
                            {...participantListeners}
                            aria-label={`Mover a ${person.name}`}
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
                          <BabyToggle person={person} disabled={busy} onConfirm={() => toggleBaby(person)} />
                        </TableCell>
                        <TableCell className="family-editor__actions-cell"><div className="family-editor__row-actions">
                          <Button variant="ghost" size="icon" disabled={busy || person.isBaby} onClick={() => editPerson(person)} aria-label={`Editar ${person.name}`}><Pencil /></Button>
                          <Button variant="destructive" size="icon" disabled={busy} onClick={() => deletePerson(person)} aria-label={`Eliminar ${person.name}`}><Trash2 /></Button>
                        </div></TableCell>
                      </>}
                    </SortableParticipant>)}
                  </SortableContext>
                  {!island.participants.length && <TableRow>
                    <TableCell colSpan={6} className="family-editor__empty">Arrastra aquí el primer familiar de esta unidad.</TableCell>
                  </TableRow>}
                </TableBody>
              </Table>
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
