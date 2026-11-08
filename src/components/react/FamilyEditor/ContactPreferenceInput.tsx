import { Input } from "@/components/ui/input";
import { normalizePhone, participantEmailIsValid, participantPhoneIsValid } from "@/lib/contact";
import { CheckCircle2, LoaderCircle, Mail, MailCheck, MessageCircle, MessageCircleCheck, RotateCcw } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";

type Props = {
  channel: "email" | "whatsapp";
  name: string;
  value: string;
  selected: boolean;
  disabled: boolean;
  onCommit: (value: string, toggle: boolean) => Promise<void>;
  onDirtyChange: (dirty: boolean) => void;
};

export default function ContactPreferenceInput({ channel, name, value, selected, disabled, onCommit, onDirtyChange }: Props) {
  const email = channel === "email";
  const [draft, setDraft] = useState(value);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [focused, setFocused] = useState(false);
  const [saved, setSaved] = useState(false);
  const savedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inputId = useId();
  const errorId = useId();
  const pendingRef = useRef<Promise<boolean> | null>(null);
  const queuedToggleRef = useRef(false);
  const failedToggleRef = useRef(false);
  const dirtyCallbackRef = useRef(onDirtyChange);
  dirtyCallbackRef.current = onDirtyChange;
  const normalized = email ? draft.trim() : normalizePhone(draft);
  const valid = email ? participantEmailIsValid(normalized) : participantPhoneIsValid(normalized);
  const channelName = email ? "Email" : "WhatsApp";
  const label = `${selected ? "Quitar" : "Marcar"} ${channelName} como canal preferido de ${name}`;
  const Icon = email ? (selected ? MailCheck : Mail) : (selected ? MessageCircleCheck : MessageCircle);

  useEffect(() => { dirtyCallbackRef.current(draft !== value); }, [draft, value]);
  useEffect(() => () => {
    dirtyCallbackRef.current(false);
    if (savedTimerRef.current) clearTimeout(savedTimerRef.current);
  }, []);

  async function commit(toggle = false): Promise<void> {
    if (disabled) return;
    if (pendingRef.current) {
      if (toggle && !queuedToggleRef.current) {
        queuedToggleRef.current = true;
        const saved = await pendingRef.current;
        queuedToggleRef.current = false;
        if (saved) await commit(true);
      }
      return;
    }
    if (normalized && !valid) {
      setError(email ? "Introduce un email válido." : "Incluye el prefijo internacional, por ejemplo +34 600 000 000.");
      return;
    }
    if (!toggle && normalized === value) {
      setDraft(normalized);
      return;
    }
    setSaving(true);
    setSaved(false);
    setError("");
    const pending = (async () => {
      try {
        await onCommit(normalized, toggle);
        failedToggleRef.current = false;
        setDraft(normalized);
        setSaved(true);
        if (savedTimerRef.current) clearTimeout(savedTimerRef.current);
        savedTimerRef.current = setTimeout(() => setSaved(false), 3000);
        return true;
      } catch (error) {
        failedToggleRef.current = toggle;
        setError(error instanceof Error ? error.message : "No se pudo guardar el contacto.");
        return false;
      } finally {
        setSaving(false);
      }
    })();
    pendingRef.current = pending;
    await pending;
    pendingRef.current = null;
  }

  return <div className={`family-editor__contact-field${selected ? " is-preferred" : ""}`} aria-busy={saving}>
    <div className="family-editor__contact-label">
      <label htmlFor={inputId}>{email ? "Email" : "Teléfono"}</label>
      <span className="family-editor__saved" role="status">{saved && <><CheckCircle2 aria-hidden="true" /><span className="sr-only">Guardado</span></>}</span>
    </div>
    <div className="family-editor__contact-control">
      <Input
        id={inputId}
        type={email ? "email" : "tel"}
        inputMode={email ? "email" : "tel"}
        value={draft}
        placeholder="Opcional"
        aria-label={`${email ? "Email" : "Teléfono"} de ${name}`}
        aria-invalid={Boolean(error)}
        aria-describedby={error || (!email && focused) ? errorId : undefined}
        disabled={disabled || saving}
        onFocus={() => setFocused(true)}
        onChange={(event) => { setDraft(event.target.value); setError(""); setSaved(false); failedToggleRef.current = false; }}
        onBlur={() => { setFocused(false); void commit(); }}
      />
      <button
        className="family-editor__contact-preference"
        type="button"
        aria-label={label}
        aria-pressed={selected}
        title={valid ? label : `Introduce ${email ? "un email válido" : "un teléfono con prefijo internacional"} para elegir ${channelName}.`}
        disabled={disabled || !valid}
        onPointerDown={(event) => event.preventDefault()}
        onClick={() => void commit(true)}
      >
        {saving ? <LoaderCircle className="family-editor__name-spinner" aria-hidden="true" /> : <Icon aria-hidden="true" />}
        <span className="family-editor__desktop-label">{selected ? "Preferido" : "Preferir"}</span>
      </button>
    </div>
    {error ? <div className="family-editor__contact-feedback">
      <span id={errorId} className="family-editor__contact-error" role="alert">{error}</span>
      {(!normalized || valid) && <button type="button" className="family-editor__action" disabled={disabled || saving} onClick={() => void commit(failedToggleRef.current)} aria-label={`Reintentar guardar ${email ? "email" : "teléfono"} de ${name}`} title="Reintentar guardado"><RotateCcw aria-hidden="true" /><span className="family-editor__desktop-label">Reintentar</span></button>}
    </div> : !email && focused && <span id={errorId} className="family-editor__contact-help">Prefijo internacional, por ejemplo +34 600 000 000.</span>}
  </div>;
}
