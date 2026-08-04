import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import "./ParticipantForm.css";

export type ParticipantDraft = {
  name: string;
  email: string;
  phone: string;
  preferredChannel: "email" | "whatsapp" | "both";
  isBaby: boolean;
};

type Props = {
  value: ParticipantDraft;
  onChange: (value: ParticipantDraft) => void;
  onSubmit: () => void;
};

export default function ParticipantForm({ value, onChange, onSubmit }: Props) {
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
        />
      </label>
      <label className="form-field">
        <span><input
          type="checkbox"
          checked={value.isBaby}
          onChange={(event) => onChange({
            ...value,
            isBaby: event.target.checked,
            email: event.target.checked ? "" : value.email,
            phone: event.target.checked ? "" : value.phone
          })}
        /> Bebé</span>
      </label>
      <label className="form-field">
        Email
        <Input
          className="h-10"
          value={value.email}
          onChange={(event) => onChange({ ...value, email: event.target.value })}
          placeholder="nombre@email.com"
          type="email"
          disabled={value.isBaby}
        />
      </label>
      <label className="form-field">
        Teléfono
        <Input
          className="h-10"
          value={value.phone}
          onChange={(event) => onChange({ ...value, phone: event.target.value })}
          placeholder="+34600000000"
          disabled={value.isBaby}
        />
      </label>
      <label className="form-field">
        Contacto preferido
        <NativeSelect
          className="w-full"
          value={value.preferredChannel}
          disabled={value.isBaby}
          onChange={(event) =>
            onChange({ ...value, preferredChannel: event.target.value as ParticipantDraft["preferredChannel"] })
          }
        >
          <NativeSelectOption value="email">Email</NativeSelectOption>
          <NativeSelectOption value="whatsapp">WhatsApp</NativeSelectOption>
          <NativeSelectOption value="both">Email y WhatsApp</NativeSelectOption>
        </NativeSelect>
      </label>
      <Button className="min-h-10 w-full" size="lg" type="submit">
        Añadir persona
      </Button>
    </form>
  );
}
