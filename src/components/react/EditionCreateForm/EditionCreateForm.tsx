import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CalendarPlus } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import CreateDialog from "../CreateDialog/CreateDialog";
import "./EditionCreateForm.css";

type Props = {
  familyId: string;
  initiallyOpen?: boolean;
};

export default function EditionCreateForm({ familyId, initiallyOpen = false }: Props) {
  const [name, setName] = useState("");
  const [year, setYear] = useState(new Date().getFullYear() + 1);
  const [kind, setKind] = useState<"test" | "final">("test");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    if (initiallyOpen && !dialogRef.current?.open) dialogRef.current?.showModal();
  }, [initiallyOpen]);

  function openDialog() {
    setMessage("");
    dialogRef.current?.showModal();
  }

  async function submit(event: React.SyntheticEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch("/api/admin/editions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ familyId, name, year, kind })
      });
      const payload = await response.json() as { ok: boolean; message?: string; data?: { id: string } };
      if (!response.ok || !payload.data) throw new Error(payload.message);
      window.location.assign(`/ediciones/${payload.data.id}`);
    } catch (error) {
      setMessage(error instanceof Error && error.message ? error.message : "No se pudo crear la edición.");
      setBusy(false);
    }
  }

  return <div className="edition-create-form__launcher">
    <Button size="lg" type="button" onClick={openDialog}><CalendarPlus />Crear edición</Button>
    <CreateDialog
      ref={dialogRef}
      title="Crear edición"
      description="Toda la familia actual se añadirá activada."
    >
      <form className="create-dialog__form edition-create-form" onSubmit={submit}>
        <label className="form-field">
          Nombre
          <Input
            autoFocus
            className="h-10"
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Ej. Prueba de agosto"
            required
            minLength={2}
            maxLength={180}
            disabled={busy}
          />
        </label>
        <label className="form-field">
          Año
          <Input className="h-10" type="number" min={2020} max={2100} value={year} onChange={(event) => setYear(Number(event.target.value))} required disabled={busy} />
        </label>
        <fieldset className="edition-create-form__kind" disabled={busy}>
          <legend>Tipo de edición</legend>
          <label><input type="radio" name="kind" checked={kind === "test"} onChange={() => setKind("test")} /> <span><strong>Prueba</strong><small>Los emails se redirigen a tu correo de acceso.</small></span></label>
          <label><input type="radio" name="kind" checked={kind === "final"} onChange={() => setKind("final")} /> <span><strong>Definitiva</strong><small>Usa los contactos reales.</small></span></label>
        </fieldset>
        <Button className="min-h-10 w-full" size="lg" type="submit" disabled={busy || name.trim().length < 2}>{busy ? "Creando…" : "Crear edición"}</Button>
        {message && <p className="edition-create-form__status" role="status">{message}</p>}
      </form>
    </CreateDialog>
  </div>;
}
