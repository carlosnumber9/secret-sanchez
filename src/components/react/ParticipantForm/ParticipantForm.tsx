import { normalizePhone, participantEmailIsValid, participantPhoneIsValid, phonePattern } from "@/lib/contact";
export { participantEmailIsValid, participantPhoneIsValid } from "@/lib/contact";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import "./ParticipantForm.css";

export type ParticipantDraft = {
  name: string;
  email: string;
  phone: string;
  preferredChannel: "email" | "whatsapp" | "both" | null;
  isBaby: boolean;
};

type Props = {
  value: ParticipantDraft;
  islandId: string;
  islands: Array<{ id: string; name: string }>;
  disabled?: boolean;
  onChange: (value: ParticipantDraft) => void;
  onIslandChange: (islandId: string) => void;
  onSubmit: () => void;
};

export function participantDraftIsValid(value: ParticipantDraft, islandId: string, islands: Props["islands"]) {
  if (!value.name.trim() || !islands.some(({ id }) => id === islandId)) return false;
  if (value.email && !participantEmailIsValid(value.email)) return false;
  if (value.phone && !participantPhoneIsValid(value.phone)) return false;
  if (value.isBaby) return true;
  if ((value.preferredChannel === "email" || value.preferredChannel === "both") && !participantEmailIsValid(value.email)) return false;
  if ((value.preferredChannel === "whatsapp" || value.preferredChannel === "both") && !participantPhoneIsValid(value.phone)) return false;
  return true;
}

export default function ParticipantForm({
  value,
  islandId,
  islands,
  disabled = false,
  onChange,
  onIslandChange,
  onSubmit
}: Props) {
  const valid = participantDraftIsValid(value, islandId, islands);
  return (
    <form
      className="participant-form"
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit();
      }}
    >
      <label className="form-field">
        Nombre
        <Input
          className="h-10"
          value={value.name}
          onChange={(event) => onChange({ ...value, name: event.target.value })}
          placeholder="Ej. Mari Carmen"
          required
          maxLength={180}
          disabled={disabled}
        />
      </label>
      <label className="form-field">
        Unidad familiar
        <NativeSelect
          className="w-full"
          value={islandId}
          required
          disabled={disabled || !islands.length}
          onChange={(event) => onIslandChange(event.target.value)}
        >
          {islands.map((island) => <NativeSelectOption key={island.id} value={island.id}>{island.name}</NativeSelectOption>)}
        </NativeSelect>
      </label>
      <label className="form-field">
        <span className="participant-form__baby"><input
          type="checkbox"
          checked={value.isBaby}
          disabled={disabled}
          onChange={(event) => onChange({
            ...value,
            isBaby: event.target.checked,
            email: event.target.checked ? "" : value.email,
            phone: event.target.checked ? "" : value.phone,
            preferredChannel: event.target.checked ? null : value.preferredChannel
          })}
        /><span>Bebé</span></span>
      </label>
      <label className="form-field">
        Email
        <Input
          className="h-10"
          value={value.email}
          onChange={(event) => onChange({ ...value, email: event.target.value })}
          placeholder="nombre@email.com"
          type="email"
          required={!value.isBaby && (value.preferredChannel === "email" || value.preferredChannel === "both")}
          disabled={disabled || value.isBaby}
        />
      </label>
      <label className="form-field">
        Teléfono
        <Input
          className="h-10"
          value={value.phone}
          onChange={(event) => onChange({ ...value, phone: normalizePhone(event.target.value) })}
          placeholder="+34600000000"
          inputMode="tel"
          pattern={phonePattern.source}
          required={!value.isBaby && (value.preferredChannel === "whatsapp" || value.preferredChannel === "both")}
          disabled={disabled || value.isBaby}
        />
      </label>
      <label className="form-field">
        Contacto preferido
        <NativeSelect
          className="w-full"
          value={value.preferredChannel ?? ""}
          disabled={disabled || value.isBaby}
          onChange={(event) =>
            onChange({ ...value, preferredChannel: event.target.value ? event.target.value as Exclude<ParticipantDraft["preferredChannel"], null> : null })
          }
        >
          <NativeSelectOption value="">Sin canal</NativeSelectOption>
          <NativeSelectOption value="email" disabled={!participantEmailIsValid(value.email)}>Email</NativeSelectOption>
          <NativeSelectOption value="whatsapp" disabled={!participantPhoneIsValid(value.phone)}>WhatsApp</NativeSelectOption>
          <NativeSelectOption value="both" disabled={!participantEmailIsValid(value.email) || !participantPhoneIsValid(value.phone)}>Email y WhatsApp</NativeSelectOption>
        </NativeSelect>
      </label>
      <Button className="min-h-10 w-full" size="lg" type="submit" disabled={disabled || !valid}>
        Añadir persona
      </Button>
    </form>
  );
}
