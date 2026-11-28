import { refreshData } from "@/lib/refresh-data";
import { useBrowserDebug } from "@/lib/use-browser-debug";
import { browserDebug, debugFetch } from "@/lib/browser-debug";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Copy, Mail, MessageCircle, RefreshCw, Send } from "lucide-react";
import { useRef, useState } from "react";
import "./DeliveryStatusPanel.css";

type DeliveryStatus = "sent" | "pending" | "failed" | "delivered" | "read" | "missing" | "skipped" | "unknown";
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
  read: "Leído", missing: "Falta contacto", skipped: "No usado", unknown: "Resultado incierto"
};

export default function DeliveryStatusPanel({ deliveries: initialDeliveries, editionId, testMode }: Props) {
  useBrowserDebug("DeliveryStatusPanel");
  const [deliveries, setDeliveries] = useState(initialDeliveries);
  const [hasDraw, setHasDraw] = useState(true);
  const [refreshError, setRefreshError] = useState(false);
  const busyRef = useRef(false);
  const [selected, setSelected] = useState<string[]>([]);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const attempt = useRef<{ signature: string; key: string; cursor: number; drawId?: string } | null>(null);

  async function refresh() {
    try {
      const data = await refreshData<{ deliveries: Delivery[]; drawId: string | null }>(`/api/admin/editions/${editionId}/deliveries`);
      if (!data.drawId || (attempt.current?.drawId && attempt.current.drawId !== data.drawId)) attempt.current = null;
      setDeliveries(data.deliveries);
      setHasDraw(Boolean(data.drawId));
      setSelected(current => current.filter(id => data.deliveries.some(delivery => delivery.id === id)));
      setRefreshError(false);
      browserDebug("notification.refreshed", { count: data.deliveries.length });
    } catch {
      setRefreshError(true);
      browserDebug("notification.refresh_failed");
    }
  }

  async function refreshOnly() {
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    try { await refresh(); }
    finally { busyRef.current = false; setBusy(false); }
  }

  async function send(mode: "pending" | "failed" | "force", scope: "all" | "selected" = "all") {
    if (busyRef.current || refreshError || !hasDraw) return;
    browserDebug("action.started", { component: "DeliveryStatusPanel", action: "send" });
    if (scope === "selected" && !selected.length) { setMessage("Selecciona al menos una entrega."); return; }
    const uncertainSelection = mode === "force" && deliveries.some(delivery => selected.includes(delivery.id) && (delivery.emailStatus === "unknown" || delivery.whatsappStatus === "unknown"));
    const warning = (testMode
      ? "Los emails de prueba se redirigirán a tu correo de acceso y los WhatsApp al teléfono de prueba. ¿Continuar?"
      : "Esto enviará mensajes reales a la familia. ¿Quieres continuar?")
      + (uncertainSelection ? "\nHay envíos con resultado incierto que podrían haber llegado. Reenviarlos puede duplicar mensajes. ¿Has comprobado su estado antes de continuar?" : "");
    if (!window.confirm(warning)) { browserDebug("notification.cancelled"); return; }
    browserDebug("notification.confirmed", { mode, scope, selectedCount: selected.length, testMode });
    const signature = JSON.stringify({ mode, scope, selected: [...selected].sort() });
    if (attempt.current?.signature !== signature) attempt.current = { signature, key: crypto.randomUUID(), cursor: 0 };
    busyRef.current = true;
    setBusy(true);
    setMessage("");
    try {
      let totals = { sent: 0, failed: 0, unknown: 0, skipped: 0 };
      let throttles = 0;
      for (;;) {
        const response = await debugFetch(`/api/admin/editions/${editionId}/notifications/send`, {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ mode, scope, assignmentIds: scope === "selected" ? selected : undefined, confirmed: true, idempotencyKey: attempt.current!.key, cursor: attempt.current!.cursor, drawId: attempt.current!.drawId })
        });
        const payload = await response.json() as { message?: string; data?: { sent: number; failed: number; skipped: number; unknown: number; drawId: string; nextCursor: number | null; retryAfterSeconds: number; processed: number; total: number } };
        if (!response.ok || !payload.data) throw new Error(payload.message);
        const data = payload.data;
        browserDebug("notification.batch", { sent: data.sent, failed: data.failed, unknown: data.unknown, skipped: data.skipped, processed: data.processed, total: data.total, retryAfterSeconds: data.retryAfterSeconds });
        attempt.current!.drawId = data.drawId;
        totals = { sent: totals.sent + data.sent, failed: totals.failed + data.failed, unknown: totals.unknown + data.unknown, skipped: totals.skipped + data.skipped };
        setMessage(`Procesadas ${data.processed}/${data.total} entregas. ${totals.sent} enviadas.`);
        if (data.nextCursor === null) break;
        attempt.current!.cursor = data.nextCursor;
        if (data.retryAfterSeconds) {
          if (++throttles > 3) throw new Error("El proveedor sigue limitando envíos. Espera y vuelve a intentar la misma operación.");
          await new Promise((resolve) => setTimeout(resolve, data.retryAfterSeconds * 1000));
        }
      }
      browserDebug("notification.completed", totals);
      attempt.current = null;
      setMessage(`${totals.sent} enviados, ${totals.failed} fallidos, ${totals.unknown} con resultado incierto y ${totals.skipped} omitidos.`);
    } catch (error) {
      browserDebug("action.failed", { component: "DeliveryStatusPanel" });
      setMessage(error instanceof Error && error.message ? error.message : "No se pudieron procesar los envíos.");
    } finally {
      await refresh();
      busyRef.current = false;
      setBusy(false);
    }
  }

  async function copyLink(delivery: Delivery) {
    if (busyRef.current) return;
    browserDebug("action.started", { component: "DeliveryStatusPanel", action: "copyLink" });
    busyRef.current = true;
    setBusy(true);
    setMessage("");
    try {
      const response = await debugFetch("/api/admin/notifications/manual", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ assignmentId: delivery.id })
      });
      const payload = await response.json() as { ok: boolean; message?: string; data?: { revealUrl: string } };
      if (!response.ok || !payload.data) throw new Error(payload.message);
      await navigator.clipboard.writeText(payload.data.revealUrl);
      browserDebug("notification.link_copied");
      setMessage(`Enlace de ${delivery.name} copiado.`);
    } catch {
      browserDebug("action.failed", { component: "DeliveryStatusPanel" });
      setMessage("No se pudo preparar o copiar el enlace.");
    }
    finally { busyRef.current = false; setBusy(false); }
  }

  return <section className="stack">
    {testMode && <p><strong>Modo prueba:</strong> los emails se redirigen a tu correo de acceso y los WhatsApp al teléfono de prueba configurado.</p>}
    <p>En email, «Enviado» confirma que el correo fue aceptado para envío. La apertura del enlace se muestra por separado.</p>
    {deliveries.some(delivery => delivery.emailStatus === "unknown" || delivery.whatsappStatus === "unknown") && <p>Los envíos con resultado incierto requieren revisión antes de usar «Reenviar seleccionados». No se reintentan automáticamente.</p>}
    {!hasDraw && <p role="status">Ya no hay un reparto vigente. Vuelve a la edición para preparar uno nuevo.</p>}
    {refreshError && <p role="alert">No se pudieron actualizar los estados. Actualiza los datos antes de iniciar otro envío.</p>}
    <div className="cluster cluster--actions">
      <Button disabled={busy || refreshError || !hasDraw} type="button" onClick={() => send("pending")}><Send size={18} />Enviar pendientes</Button>
      <Button disabled={busy || refreshError || !hasDraw} variant="secondary" type="button" onClick={() => send("failed")}><RefreshCw size={18} />Reintentar fallidos</Button>
      <Button disabled={busy || refreshError || !hasDraw || !selected.length} variant="outline" type="button" onClick={() => send("force", "selected")}><RefreshCw size={18} />Reenviar seleccionados</Button>
    </div>
    <Button disabled={busy} variant="outline" type="button" onClick={() => void refreshOnly()}>Actualizar estados</Button>
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
