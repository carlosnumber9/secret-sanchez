import { Popover } from "@base-ui/react/popover";
import { ArrowDown, ArrowRight, ArrowUp, ArrowUpDown, LoaderCircle, X } from "lucide-react";
import { useId, useRef, useState } from "react";

type Props = {
  name: string;
  unit?: boolean;
  disabled: boolean;
  canMoveUp: boolean;
  canMoveDown: boolean;
  onMove: (direction: -1 | 1) => Promise<void>;
  destinations?: { id: string; name: string }[];
  onMoveTo?: (id: string) => Promise<void>;
};

export default function MoveMenu({ name, unit, disabled, canMoveUp, canMoveDown, onMove, destinations = [], onMoveTo }: Props) {
  const [open, setOpen] = useState(false);
  const [destination, setDestination] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const pendingRef = useRef(false);
  const selectId = useId();
  const subject = unit ? `la unidad ${name}` : name;

  async function move(work: () => Promise<void>) {
    if (disabled || pendingRef.current) return;
    pendingRef.current = true;
    setSaving(true);
    setError("");
    try {
      await work();
      setOpen(false);
    } catch (error) {
      setError(error instanceof Error ? error.message : "No se pudo completar el movimiento.");
    } finally {
      pendingRef.current = false;
      setSaving(false);
    }
  }

  return <Popover.Root open={open} onOpenChange={(next) => {
    if (pendingRef.current) return;
    setOpen(next);
    if (next) { setDestination(""); setError(""); }
  }}>
    <Popover.Trigger className="family-editor__action" disabled={disabled} aria-label={`Opciones para mover ${subject}`} title={`Mover ${subject}`}>
      <ArrowUpDown aria-hidden="true" /><span className="family-editor__desktop-label">Mover</span>
    </Popover.Trigger>
    <Popover.Portal>
      <Popover.Positioner className="family-editor__baby-positioner" side="bottom" align="end" sideOffset={8} collisionPadding={12}>
        <Popover.Popup className="family-editor__move-popover" aria-busy={saving}>
          <div className="family-editor__move-heading">
            <Popover.Title>Mover {subject}</Popover.Title>
            <Popover.Close className="family-editor__action" disabled={saving} aria-label="Cerrar opciones de movimiento" title="Cerrar"><X aria-hidden="true" /></Popover.Close>
          </div>
          <div className="family-editor__move-directions">
            <button type="button" className="family-editor__action" disabled={disabled || saving || !canMoveUp} onClick={() => void move(() => onMove(-1))} aria-label="Subir una posición" title="Subir una posición"><ArrowUp aria-hidden="true" /><span className="family-editor__desktop-label">Subir</span></button>
            <button type="button" className="family-editor__action" disabled={disabled || saving || !canMoveDown} onClick={() => void move(() => onMove(1))} aria-label="Bajar una posición" title="Bajar una posición"><ArrowDown aria-hidden="true" /><span className="family-editor__desktop-label">Bajar</span></button>
          </div>
          {onMoveTo && destinations.length > 0 && <div className="family-editor__move-destination">
            <label htmlFor={selectId}>Cambiar de unidad</label>
            <div>
              <select id={selectId} value={destination} disabled={disabled || saving} onChange={(event) => setDestination(event.target.value)}>
                <option value="">Elige una unidad</option>
                {destinations.map(({ id, name }) => <option key={id} value={id}>{name}</option>)}
              </select>
              <button type="button" className="family-editor__action" disabled={disabled || saving || !destination} onClick={() => void move(() => onMoveTo(destination))} aria-label="Confirmar cambio de unidad" title="Confirmar cambio de unidad"><ArrowRight aria-hidden="true" /><span className="family-editor__desktop-label">Mover</span></button>
            </div>
          </div>}
          {unit && <p className="family-editor__contact-help">El orden de las unidades solo se mantiene en esta vista.</p>}
          {saving && <p className="family-editor__move-status" role="status"><LoaderCircle className="family-editor__name-spinner" aria-hidden="true" />Guardando movimiento…</p>}
          {error && <p className="family-editor__contact-error" role="alert">{error}</p>}
        </Popover.Popup>
      </Popover.Positioner>
    </Popover.Portal>
  </Popover.Root>;
}
