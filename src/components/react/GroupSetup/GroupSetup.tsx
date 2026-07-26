import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useState } from "react";

export default function GroupSetup() {
  const [name, setName] = useState("");
  const [year, setYear] = useState(new Date().getFullYear() + 1);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event: React.SyntheticEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch("/api/admin/groups", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, year })
      });
      const payload = (await response.json().catch(() => null)) as { ok?: boolean; message?: string } | null;
      if (!response.ok || !payload?.ok) throw new Error(payload?.message);
      window.location.reload();
    } catch {
      setMessage("No se pudo crear el grupo.");
      setBusy(false);
    }
  }

  return (
    <form className="stack" onSubmit={submit}>
      <label className="form-field">
        Nombre del sorteo
        <Input value={name} onChange={(event) => setName(event.target.value)} required />
      </label>
      <label className="form-field">
        Año
        <Input
          type="number"
          min={2020}
          max={2100}
          value={year}
          onChange={(event) => setYear(Number(event.target.value))}
          required
        />
      </label>
      <Button type="submit" disabled={busy}>{busy ? "Creando..." : "Crear grupo real"}</Button>
      {message && <p role="status">{message}</p>}
    </form>
  );
}
