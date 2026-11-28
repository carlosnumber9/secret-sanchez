import { useBrowserDebug } from "@/lib/use-browser-debug";
import { browserDebug, debugFetch } from "@/lib/browser-debug";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useState } from "react";

export default function GroupSetup() {
  useBrowserDebug("GroupSetup");
  const [name, setName] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event: React.SyntheticEvent<HTMLFormElement>) {
    browserDebug("action.started", { component: "GroupSetup", action: "submit" });
    event.preventDefault();
    setBusy(true);
    setMessage("");
    try {
      const response = await debugFetch("/api/admin/groups", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name })
      });
      const payload = (await response.json().catch(() => null)) as { ok?: boolean; message?: string } | null;
      if (!response.ok || !payload?.ok) throw new Error(payload?.message);
      window.location.reload();
    } catch {
      browserDebug("action.failed", { component: "GroupSetup" });
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
      <Button type="submit" disabled={busy}>{busy ? "Creando..." : "Crear familia"}</Button>
      {message && <p role="status">{message}</p>}
    </form>
  );
}
