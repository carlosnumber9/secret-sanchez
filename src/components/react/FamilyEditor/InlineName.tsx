import { Input } from "@/components/ui/input";
import { Check, CheckCircle2, LoaderCircle, Pencil } from "lucide-react";
import { useEffect, useId, useRef, useState, type SubmitEvent } from "react";

type Props = {
  name: string;
  label: string;
  disabled: boolean;
  heading?: boolean;
  onSave: (name: string) => Promise<void>;
};

export default function InlineName({ name, label, disabled, heading, onSave }: Props) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(name);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const savedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const submittingRef = useRef(false);
  const errorId = useId();

  useEffect(() => () => { if (savedTimerRef.current) clearTimeout(savedTimerRef.current); }, []);

  useEffect(() => {
    if (!editing) return;
    const cancelOutside = (event: PointerEvent) => {
      if (!submittingRef.current && event.target instanceof Node && !containerRef.current?.contains(event.target)) {
        setEditing(false);
      }
    };
    document.addEventListener("pointerdown", cancelOutside, true);
    return () => document.removeEventListener("pointerdown", cancelOutside, true);
  }, [editing]);

  async function submit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmed = draft.trim();
    if (disabled || submittingRef.current || !trimmed) return;
    if (trimmed === name) {
      setEditing(false);
      return;
    }
    submittingRef.current = true;
    setSaving(true);
    setError("");
    try {
      await onSave(trimmed);
      setEditing(false);
      setSaved(true);
      if (savedTimerRef.current) clearTimeout(savedTimerRef.current);
      savedTimerRef.current = setTimeout(() => setSaved(false), 3000);
    } catch (error) {
      setError(error instanceof Error ? error.message : "No se pudo guardar el nombre.");
    } finally {
      submittingRef.current = false;
      setSaving(false);
    }
  }

  const nameButton = <button
    className="family-editor__name-trigger"
    type="button"
    disabled={disabled}
    aria-label={`Editar ${label.toLowerCase()}: ${name}`}
    title="Haz clic para editar el nombre"
    onClick={() => { setDraft(name); setError(""); setSaved(false); setEditing(true); }}
  ><span>{name}</span><Pencil className="family-editor__name-hint" aria-hidden="true" /></button>;

  return <div
    ref={containerRef}
    className="family-editor__inline-name"
    onBlur={(event) => {
      if (!submittingRef.current && !event.currentTarget.contains(event.relatedTarget)) setEditing(false);
    }}
  >
    {editing ? <form className="family-editor__name-form" onSubmit={submit} aria-busy={saving}>
      <Input
        autoFocus
        aria-label={label}
        aria-describedby={error ? errorId : undefined}
        aria-invalid={Boolean(error)}
        value={draft}
        maxLength={180}
        required
        disabled={disabled || saving}
        onChange={(event) => { setDraft(event.target.value); setError(""); }}
        onKeyDown={(event) => {
          if (event.key === "Escape" && !submittingRef.current) {
            event.preventDefault();
            setEditing(false);
          }
        }}
      />
      <button
        type="submit"
        className="family-editor__name-save"
        disabled={disabled || saving || !draft.trim()}
        aria-label={saving ? "Guardando nombre" : "Guardar nombre"}
      >{saving ? <LoaderCircle className="family-editor__name-spinner" aria-hidden="true" /> : <Check aria-hidden="true" />}</button>
    </form> : heading ? <h2>{nameButton}</h2> : nameButton}
    <span className="family-editor__saved" role="status">{saved && <><CheckCircle2 aria-hidden="true" /><span className="sr-only">Nombre guardado</span></>}</span>
    {editing && error && <span id={errorId} className="family-editor__name-error" role="alert">{error}</span>}
  </div>;
}
