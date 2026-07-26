import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Copy, Mail, RefreshCw, Send } from "lucide-react";
import { useState } from "react";
import "./DeliveryStatusPanel.css";

type DeliveryStatus = "sent" | "pending" | "failed" | "delivered" | "opened" | "manual" | "missing" | "skipped";

type Delivery = {
  id: string;
  name: string;
  preferredChannel: "email" | "whatsapp" | "both" | "manual";
  emailStatus: DeliveryStatus;
  manualStatus: DeliveryStatus;
  legacyToken: boolean;
  opened: boolean;
};

type Props = { deliveries: Delivery[] };

const labels: Record<DeliveryStatus, string> = {
  sent: "Enviado",
  pending: "Pendiente",
  failed: "Error",
  delivered: "Entregado",
  opened: "Abierto",
  manual: "Manual",
  missing: "Falta contacto",
  skipped: "No usado"
};

export default function DeliveryStatusPanel({ deliveries: initialDeliveries }: Props) {
  const [deliveries, setDeliveries] = useState(initialDeliveries);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  async function send(mode: "pending" | "failed") {
    if (!window.confirm("Esto enviará emails reales. ¿Quieres continuar?")) return;
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch("/api/admin/notifications/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode, confirmed: true, idempotencyKey: crypto.randomUUID() })
      });
      const payload = (await response.json()) as {
        ok: boolean;
        message?: string;
        data?: { sent: number; failed: number; skipped: number };
      };
      if (!response.ok || !payload.data) throw new Error(payload.message);
      setMessage(
        `${payload.data.sent} enviados, ${payload.data.failed} fallidos y ${payload.data.skipped} omitidos.`
      );
      window.setTimeout(() => window.location.reload(), 900);
    } catch {
      setMessage("No se pudieron procesar los envíos.");
      setBusy(false);
    }
  }

  async function copyManual(delivery: Delivery) {
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch("/api/admin/notifications/manual", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ assignmentId: delivery.id, idempotencyKey: crypto.randomUUID() })
      });
      const payload = (await response.json()) as {
        ok: boolean;
        message?: string;
        data?: { revealUrl: string };
      };
      if (!response.ok || !payload.data) throw new Error(payload.message);
      await navigator.clipboard.writeText(payload.data.revealUrl);
      setDeliveries((current) =>
        current.map((item) => item.id === delivery.id ? { ...item, manualStatus: "manual" } : item)
      );
      setMessage(`Enlace de ${delivery.name} copiado y entrega manual registrada.`);
    } catch {
      setMessage("No se pudo preparar o copiar el enlace.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="stack">
      <div className="cluster cluster--actions">
        <Button disabled={busy} type="button" onClick={() => send("pending")}>
          <Send size={18} />
          Enviar pendientes
        </Button>
        <Button disabled={busy} variant="secondary" type="button" onClick={() => send("failed")}>
          <RefreshCw size={18} />
          Reintentar fallidos
        </Button>
      </div>
      {message && <p role="status">{message}</p>}
      <section className="delivery-panel">
        {deliveries.map((delivery) => (
          <article className="delivery-panel__row" key={delivery.id}>
            <div className="delivery-panel__person">
              <h3>{delivery.name}</h3>
              <p>{delivery.opened ? "Enlace abierto" : delivery.legacyToken ? "Enlace antiguo no recuperable" : "Sin abrir"}</p>
            </div>
            <Badge variant={delivery.emailStatus === "failed" ? "destructive" : "outline"}>
              <Mail size={18} />
              Email {labels[delivery.emailStatus]}
            </Badge>
            <Badge variant="outline">Manual {labels[delivery.manualStatus]}</Badge>
            <div className="delivery-panel__actions">
              <Button
                variant="outline"
                className="size-10"
                size="icon-lg"
                type="button"
                disabled={busy || delivery.legacyToken}
                onClick={() => copyManual(delivery)}
                aria-label={`Copiar enlace de ${delivery.name}`}
              >
                <Copy size={19} />
              </Button>
            </div>
          </article>
        ))}
      </section>
    </section>
  );
}
