import { Copy, Mail, MessageCircle, RefreshCw } from "lucide-react";
import { useState } from "react";
import "./DeliveryStatusPanel.css";

type Delivery = {
  id: string;
  name: string;
  emailStatus: "sent" | "pending" | "failed" | "missing";
  whatsappStatus: "sent" | "pending" | "failed" | "missing";
  revealUrl: string;
};

type Props = {
  deliveries: Delivery[];
};

const labels = {
  sent: "Enviado",
  pending: "Pendiente",
  failed: "Error",
  missing: "Falta contacto"
};

export default function DeliveryStatusPanel({ deliveries }: Props) {
  const [copiedId, setCopiedId] = useState<string | null>(null);

  async function copyLink(delivery: Delivery) {
    await navigator.clipboard.writeText(delivery.revealUrl);
    setCopiedId(delivery.id);
    window.setTimeout(() => setCopiedId(null), 1800);
  }

  return (
    <section className="delivery-panel">
      {deliveries.map((delivery) => (
        <article className="delivery-panel__row" key={delivery.id}>
          <div>
            <h3>{delivery.name}</h3>
            <p>{copiedId === delivery.id ? "Enlace copiado" : "Enlace secreto preparado"}</p>
          </div>
          <span className={`delivery-panel__status delivery-panel__status--${delivery.emailStatus}`}>
            <Mail size={18} />
            Email {labels[delivery.emailStatus]}
          </span>
          <span className={`delivery-panel__status delivery-panel__status--${delivery.whatsappStatus}`}>
            <MessageCircle size={18} />
            WhatsApp {labels[delivery.whatsappStatus]}
          </span>
          <div className="delivery-panel__actions">
            <button type="button" aria-label={`Reintentar envío de ${delivery.name}`}>
              <RefreshCw size={19} />
            </button>
            <button type="button" onClick={() => copyLink(delivery)} aria-label={`Copiar enlace de ${delivery.name}`}>
              <Copy size={19} />
            </button>
          </div>
        </article>
      ))}
    </section>
  );
}
