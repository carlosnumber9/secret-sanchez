import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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

const statusAppearance = {
  sent: {
    variant: "secondary",
    className: "bg-chart-2/15 text-chart-5"
  },
  pending: {
    variant: "outline",
    className: "bg-secondary text-secondary-foreground"
  },
  failed: {
    variant: "destructive",
    className: ""
  },
  missing: {
    variant: "outline",
    className: "text-muted-foreground"
  }
} as const;

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
          <div className="delivery-panel__person">
            <h3>{delivery.name}</h3>
            <p aria-live="polite">{copiedId === delivery.id ? "Enlace copiado" : "Enlace secreto preparado"}</p>
          </div>
          <Badge
            variant={statusAppearance[delivery.emailStatus].variant}
            className={`min-h-7 px-2.5 ${statusAppearance[delivery.emailStatus].className}`}
          >
            <Mail size={18} />
            Email {labels[delivery.emailStatus]}
          </Badge>
          <Badge
            variant={statusAppearance[delivery.whatsappStatus].variant}
            className={`min-h-7 px-2.5 ${statusAppearance[delivery.whatsappStatus].className}`}
          >
            <MessageCircle size={18} />
            WhatsApp {labels[delivery.whatsappStatus]}
          </Badge>
          <div className="delivery-panel__actions">
            <Button
              className="size-10"
              variant="outline"
              size="icon-lg"
              type="button"
              aria-label={`Reintentar envío de ${delivery.name}`}
            >
              <RefreshCw size={19} />
            </Button>
            <Button
              variant="outline"
              className="size-10"
              size="icon-lg"
              type="button"
              onClick={() => copyLink(delivery)}
              aria-label={`Copiar enlace de ${delivery.name}`}
            >
              <Copy size={19} />
            </Button>
          </div>
        </article>
      ))}
    </section>
  );
}
