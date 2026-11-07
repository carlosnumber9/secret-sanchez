import { Button } from "@/components/ui/button";
import { useState } from "react";

export default function RevokeDraw({ editionId, drawId, exposure }: { editionId: string; drawId: string; exposure: { notifications: number; manual: number | null; opened: number } }) {
  const [confirmation, setConfirmation] = useState("");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  async function revoke() {
    setBusy(true);
    try {
      const response = await fetch(`/api/admin/editions/${editionId}/draws/${drawId}/revoke`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ confirmation, reason }) });
      const payload = await response.json() as { message?: string };
      if (!response.ok) throw new Error(payload.message);
      window.location.reload();
    } catch (error) {
      setMessage(error instanceof Error && error.message ? error.message : "No se pudo anular el reparto.");
      setBusy(false);
    }
  }
  return <section className="stack">
    <p><strong>Atención:</strong> se invalidarán todos los enlaces. Ya se han registrado {exposure.notifications} intentos de envío, {exposure.manual ?? "un número desconocido de"} copias manuales y {exposure.opened} aperturas; lo que alguien haya visto no puede deshacerse.</p>
    <label className="form-field">Motivo opcional<input value={reason} onChange={(event) => setReason(event.target.value)} /></label>
    <label className="form-field">Escribe <strong>ANULAR REPARTO</strong><input value={confirmation} onChange={(event) => setConfirmation(event.target.value)} /></label>
    <Button variant="destructive" disabled={busy || confirmation !== "ANULAR REPARTO"} onClick={revoke}>{busy ? "Anulando..." : "Revertir reparto"}</Button>
    {message && <p role="status">{message}</p>}
  </section>;
}
