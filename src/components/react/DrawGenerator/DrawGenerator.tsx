import { Gift, Send } from "lucide-react";
import { useState } from "react";
import "./DrawGenerator.css";

type Props = {
  groupId?: string;
  participantCount: number;
};

type DrawState = "idle" | "loading" | "done" | "error";

export default function DrawGenerator({ groupId, participantCount }: Props) {
  const [state, setState] = useState<DrawState>("idle");
  const [message, setMessage] = useState("Listo para repartir cuando Juan lo vea claro.");

  async function generateDraw() {
    setState("loading");
    setMessage("Buscando un reparto válido...");
    try {
      const response = await fetch("/api/draw/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ groupId })
      });
      const payload = (await response.json()) as { ok: boolean; message: string };
      setState(payload.ok ? "done" : "error");
      setMessage(payload.message);
    } catch {
      setState("error");
      setMessage("No se pudo generar el sorteo. Revisa la conexión y vuelve a intentarlo.");
    }
  }

  return (
    <section className="draw-generator">
      <div className="draw-generator__gift" aria-hidden="true">
        <Gift size={42} />
      </div>
      <div className="draw-generator__content">
        <h2>Repartir amigo invisible</h2>
        <p>{message}</p>
        <p className="draw-generator__count">{participantCount} participantes activos preparados</p>
      </div>
      <div className="draw-generator__actions">
        <button disabled={state === "loading"} type="button" onClick={generateDraw}>
          <Gift size={22} />
          {state === "loading" ? "Repartiendo..." : "Repartir amigo invisible"}
        </button>
        {state === "done" && (
          <a href="/envios">
            <Send size={20} />
            Ver estado de envíos
          </a>
        )}
      </div>
    </section>
  );
}
