import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Copy, Mail, MessageCircle, RefreshCw, Send } from "lucide-react";
import { useState } from "react";
import "./DeliveryStatusPanel.css";

type DeliveryStatus = "sent" | "pending" | "failed" | "delivered" | "read" | "missing" | "skipped";
type Delivery = {
  id: string;
  name: string;
  giverKind: "participant" | "familyIsland";
  preferredChannel: "email" | "whatsapp" | "both" | null;
  emailStatus: DeliveryStatus;
  whatsappStatus: DeliveryStatus;
  legacyToken: boolean;
  opened: boolean;
};
type Props = { deliveries: Delivery[]; editionId: string; testMode: boolean };

const labels: Record<DeliveryStatus, string> = {
  sent: "Enviado", pending: "Pendiente", failed: "Error", delivered: "Entregado",
  read: "Leído", missing: "Falta contacto", skipped: "No usado"
};

export default function DeliveryStatusPanel({ deliveries, editionId, testMode }: Props) {
  const [selected, setSelected] = useState<string[]>([]);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  async function send(mode: "pending" | "failed" | "force", scope: "all" | "selected" = "all") {
    if (scope === "selected" && !selected.length) { setMessage("Selecciona al menos una entrega."); return; }
    const warning = testMode
      ? "Los emails de prueba se redirigirán a tu correo de acceso y los WhatsApp al teléfono de prueba. ¿Continuar?"
      : "Esto enviará mensajes reales a la familia. ¿Quieres continuar?";
    if (!window.confirm(warning)) return;
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch(`/api/admin/editions/${editionId}/notifications/send`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode, scope, assignmentIds: scope === "selected" ? selected : undefined, confirmed: true, idempotencyKey: crypto.randomUUID() })
      });
      const payload = await response.json() as { ok: boolean; message?: string; data?: { sent: number; failed: number; skipped: number } };
      if (!response.ok || !payload.data) throw new Error(payload.message);
      setMessage(`${payload.data.sent} enviados, ${payload.data.failed} fallidos y ${payload.data.skipped} omitidos.`);
      window.setTimeout(() => window.location.reload(), 900);
    } catch (error) {
      setMessage(error instanceof Error && error.message ? error.message : "No se pudieron procesar los envíos.");
      setBusy(false);
    }
  }

  async function copyLink(delivery: Delivery) {
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch("/api/admin/notifications/manual", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ assignmentId: delivery.id })
      });
      const payload = await response.json() as { ok: boolean; message?: string; data?: { revealUrl: string } };
      if (!response.ok || !payload.data) throw new Error(payload.message);
      await navigator.clipboard.writeText(payload.data.revealUrl);
      setMessage(`Enlace de ${delivery.name} copiado.`);
    } catch { setMessage("No se pudo preparar o copiar el enlace."); }
    finally { setBusy(false); }
  }

  return <section className="stack">
    {testMode && <p><strong>Modo prueba:</strong> los emails se redirigen a tu correo de acceso y los WhatsApp al teléfono de prueba configurado.</p>}
    <div className="cluster cluster--actions">
      <Button disabled={busy} type="button" onClick={() => send("pending")}><Send size={18} />Enviar pendientes</Button>
      <Button disabled={busy} variant="secondary" type="button" onClick={() => send("failed")}><RefreshCw size={18} />Reintentar fallidos</Button>
      <Button disabled={busy || !selected.length} variant="outline" type="button" onClick={() => send("force", "selected")}><RefreshCw size={18} />Reenviar seleccionados</Button>
    </div>
    {message && <p role="status">{message}</p>}
    <section className="delivery-panel">
      {deliveries.map((delivery) => <article className="delivery-panel__row" key={delivery.id}>
        <label><input type="checkbox" checked={selected.includes(delivery.id)} onChange={(event) => setSelected((current) => event.target.checked ? [...current, delivery.id] : current.filter((id) => id !== delivery.id))} aria-label={`Seleccionar ${delivery.name}`} /></label>
        <div className="delivery-panel__person"><h3>{delivery.name}</h3><p>{delivery.giverKind === "familyIsland" ? "Asignación de unidad" : "Asignación personal"} · {delivery.opened ? "Enlace abierto" : delivery.legacyToken ? "Enlace antiguo no recuperable" : "Sin abrir"}</p></div>
        <Badge variant={delivery.emailStatus === "failed" ? "destructive" : "outline"}><Mail size={18} />Email {labels[delivery.emailStatus]}</Badge>
        <Badge variant={delivery.whatsappStatus === "failed" ? "destructive" : "outline"}><MessageCircle size={18} />WhatsApp {labels[delivery.whatsappStatus]}</Badge>
        <Button variant="outline" className="size-10" size="icon-lg" type="button" disabled={busy || delivery.legacyToken} onClick={() => copyLink(delivery)} aria-label={`Copiar enlace de ${delivery.name}`}><Copy size={19} /></Button>
      </article>)}
    </section>
  </section>;
}
