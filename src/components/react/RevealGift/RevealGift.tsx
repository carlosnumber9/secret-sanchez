import { Button } from "@/components/ui/button";
import { Gift } from "lucide-react";
import { useState } from "react";
import "./RevealGift.css";

type Props = {
  giverName: string;
  receiverName: string;
  alreadyOpened?: boolean;
};

export default function RevealGift({ giverName, receiverName, alreadyOpened = false }: Props) {
  const [open, setOpen] = useState(alreadyOpened);

  return (
    <section className="reveal-gift">
      <div className={`reveal-gift__box ${open ? "reveal-gift__box--open" : ""}`} aria-hidden="true">
        <Gift size={86} />
      </div>
      <div className="reveal-gift__copy">
        <p>Hola {giverName}</p>
        <h1>{open ? "Este año regalas a..." : "Tu Amigo Invisible de Reyes está preparado"}</h1>
        {open ? (
          <strong className="reveal-gift__name animate-pop">{receiverName}</strong>
        ) : (
          <Button className="min-h-11 px-6" size="lg" variant="secondary" type="button" onClick={() => setOpen(true)}>
            Abrir regalo
          </Button>
        )}
      </div>
    </section>
  );
}
