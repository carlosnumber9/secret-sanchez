import "./ParticipantForm.css";

export type ParticipantDraft = {
  name: string;
  email: string;
  phone: string;
  preferredChannel: "email" | "whatsapp" | "both" | "manual";
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
        <input
          className="input"
          value={value.name}
          onChange={(event) => onChange({ ...value, name: event.target.value })}
          placeholder="Ej. Mari Carmen"
        />
      </label>
      <label className="form-field">
        Email
        <input
          className="input"
          value={value.email}
          onChange={(event) => onChange({ ...value, email: event.target.value })}
          placeholder="nombre@email.com"
          type="email"
        />
      </label>
      <label className="form-field">
        Teléfono
        <input
          className="input"
          value={value.phone}
          onChange={(event) => onChange({ ...value, phone: event.target.value })}
          placeholder="+34 600 000 000"
        />
      </label>
      <label className="form-field">
        Contacto preferido
        <select
          className="select"
          value={value.preferredChannel}
          onChange={(event) =>
            onChange({ ...value, preferredChannel: event.target.value as ParticipantDraft["preferredChannel"] })
          }
        >
          <option value="email">Email</option>
          <option value="whatsapp">WhatsApp</option>
          <option value="both">Ambos</option>
          <option value="manual">Manual</option>
        </select>
      </label>
      <button className="participant-form__button" type="submit">
        Añadir persona
      </button>
    </form>
  );
}
