import { Input } from "@/components/ui/input";
import { normalizePhone, participantEmailIsValid, participantPhoneIsValid } from "@/lib/contact";
import { LoaderCircle, Mail, MailCheck, MessageCircle, MessageCircleCheck } from "lucide-react";
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
  const errorId = useId();
  const pendingRef = useRef<Promise<boolean> | null>(null);
  const queuedToggleRef = useRef(false);
  const dirtyCallbackRef = useRef(onDirtyChange);
  dirtyCallbackRef.current = onDirtyChange;
  const normalized = email ? draft.trim() : normalizePhone(draft);
  const valid = email ? participantEmailIsValid(normalized) : participantPhoneIsValid(normalized);
  const channelName = email ? "Email" : "WhatsApp";
  const label = `${selected ? "Quitar" : "Marcar"} ${channelName} como canal preferido de ${name}`;
  const Icon = email ? (selected ? MailCheck : Mail) : (selected ? MessageCircleCheck : MessageCircle);

  useEffect(() => { dirtyCallbackRef.current(draft !== value); }, [draft, value]);
  useEffect(() => () => dirtyCallbackRef.current(false), []);

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
    setError("");
    const pending = (async () => {
      try {
        await onCommit(normalized, toggle);
        setDraft(normalized);
        return true;
      } catch (error) {
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
    <Input
      type={email ? "email" : "tel"}
      inputMode={email ? "email" : "tel"}
      value={draft}
      placeholder={email ? "Email opcional" : "+34 600 000 000"}
      aria-label={`${email ? "Email" : "Teléfono"} de ${name}`}
      aria-invalid={Boolean(error)}
      aria-describedby={error || (!email && focused) ? errorId : undefined}
      disabled={disabled || saving}
      onFocus={() => setFocused(true)}
      onChange={(event) => { setDraft(event.target.value); setError(""); }}
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
    >{saving ? <LoaderCircle className="family-editor__name-spinner" aria-hidden="true" /> : <Icon aria-hidden="true" />}</button>
    {error ? <span id={errorId} className="family-editor__contact-error" role="alert">{error}</span>
      : !email && focused && <span id={errorId} className="family-editor__contact-help">Incluye prefijo internacional, por ejemplo +34.</span>}
  </div>;
}
