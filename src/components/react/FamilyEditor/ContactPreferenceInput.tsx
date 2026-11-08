import { Input } from "@/components/ui/input";
import { participantEmailIsValid, participantPhoneIsValid, phonePattern } from "@/lib/contact";
import { Mail, MailCheck, MessageCircle, MessageCircleCheck } from "lucide-react";

type Props = {
  channel: "email" | "whatsapp";
  name: string;
  value: string;
  selected: boolean;
  disabled: boolean;
  onChange: (value: string) => void;
  onToggle: () => void;
};

export default function ContactPreferenceInput({ channel, name, value, selected, disabled, onChange, onToggle }: Props) {
  const email = channel === "email";
  const valid = email ? participantEmailIsValid(value) : participantPhoneIsValid(value);
  const channelName = email ? "Email" : "WhatsApp";
  const label = `${selected ? "Quitar" : "Marcar"} ${channelName} como canal preferido de ${name}`;
  const Icon = email ? (selected ? MailCheck : Mail) : (selected ? MessageCircleCheck : MessageCircle);

  return <div className={`family-editor__contact-field${selected ? " is-preferred" : ""}`}>
    <Input
      type={email ? "email" : "tel"}
      inputMode={email ? "email" : "tel"}
      pattern={email ? undefined : phonePattern.source}
      value={value}
      placeholder={email ? "Email opcional" : "Teléfono opcional"}
      aria-label={`${email ? "Email" : "Teléfono"} de ${name}`}
      disabled={disabled}
      onChange={(event) => onChange(event.target.value)}
    />
    <button
      className="family-editor__contact-preference"
      type="button"
      aria-label={label}
      aria-pressed={selected}
      title={valid ? label : `Introduce ${email ? "un email válido" : "un teléfono con prefijo internacional"} para elegir ${channelName}.`}
      disabled={disabled || !valid}
      onClick={onToggle}
    ><Icon aria-hidden="true" /></button>
  </div>;
}
