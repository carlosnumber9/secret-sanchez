import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import "./ParticipantForm.css";

export type ParticipantDraft = {
  name: string;
  email: string;
  phone: string;
  preferredChannel: "email" | "manual";
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
        Email
        <Input
          className="h-10"
          value={value.email}
          onChange={(event) => onChange({ ...value, email: event.target.value })}
          placeholder="nombre@email.com"
          type="email"
        />
      </label>
      <label className="form-field">
        Teléfono
        <Input
          className="h-10"
          value={value.phone}
          onChange={(event) => onChange({ ...value, phone: event.target.value })}
          placeholder="+34 600 000 000"
        />
      </label>
      <label className="form-field">
        Contacto preferido
        <NativeSelect
          className="w-full"
          value={value.preferredChannel}
          onChange={(event) =>
            onChange({ ...value, preferredChannel: event.target.value as ParticipantDraft["preferredChannel"] })
          }
        >
          <NativeSelectOption value="email">Email</NativeSelectOption>
          <NativeSelectOption value="manual">Manual</NativeSelectOption>
        </NativeSelect>
      </label>
      <Button className="min-h-10 w-full" size="lg" type="submit">
        Añadir persona
      </Button>
    </form>
  );
}
