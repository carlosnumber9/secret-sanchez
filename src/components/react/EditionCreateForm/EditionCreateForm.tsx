import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useState } from "react";

export default function EditionCreateForm({ familyId }: { familyId: string }) {
  const [name, setName] = useState("");
  const [year, setYear] = useState(new Date().getFullYear() + 1);
  const [kind, setKind] = useState<"test" | "final">("test");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

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

  return <form className="stack" onSubmit={submit}>
    <label className="form-field">Nombre<Input value={name} onChange={(event) => setName(event.target.value)} placeholder="Ej. Prueba de agosto" required /></label>
    <label className="form-field">Año<Input type="number" min={2020} max={2100} value={year} onChange={(event) => setYear(Number(event.target.value))} required /></label>
    <fieldset className="stack">
      <legend>Tipo de edición</legend>
      <label><input type="radio" name="kind" checked={kind === "test"} onChange={() => setKind("test")} /> Prueba — los emails se redirigen a Juan</label>
      <label><input type="radio" name="kind" checked={kind === "final"} onChange={() => setKind("final")} /> Definitiva — usa los contactos reales</label>
    </fieldset>
    <Button type="submit" disabled={busy}>{busy ? "Creando..." : "Crear edición"}</Button>
    {message && <p role="status">{message}</p>}
  </form>;
}
