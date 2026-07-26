import { Button } from "@/components/ui/button";
import { Gift } from "lucide-react";
import { useEffect, useState } from "react";
import "./RevealGift.css";

type RevealState =
  | { status: "loading" }
  | { status: "invalid"; message: string }
  | { status: "ready"; token: string; giverName: string; alreadyOpened: boolean }
  | { status: "opening"; token: string; giverName: string }
  | { status: "open"; giverName: string; receiverName: string };

export default function RevealGift() {
  const [state, setState] = useState<RevealState>({ status: "loading" });

  useEffect(() => {
    const token = window.location.hash.replace(/^#/, "");
    window.history.replaceState(null, "", window.location.pathname);
    if (!token) {
      setState({ status: "invalid", message: "Este enlace no parece válido." });
      return;
    }

    fetch("/api/reveal/resolve", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token })
    })
      .then(async (response) => {
        const payload = (await response.json().catch(() => null)) as {
          ok?: boolean;
          message?: string;
          data?: { giverName: string; alreadyOpened: boolean };
        } | null;
        if (!response.ok || !payload?.data) throw new Error(payload?.message);
        setState({ status: "ready", token, ...payload.data });
      })
      .catch(() => setState({ status: "invalid", message: "Este enlace no parece válido." }));
  }, []);

  async function openGift() {
    if (state.status !== "ready") return;
    const current = state;
    setState({ status: "opening", token: current.token, giverName: current.giverName });
    try {
      const response = await fetch("/api/reveal/open", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: current.token })
      });
      const payload = (await response.json().catch(() => null)) as {
        data?: { receiverName: string };
      } | null;
      if (!response.ok || !payload?.data) throw new Error();
      setState({ status: "open", giverName: current.giverName, receiverName: payload.data.receiverName });
    } catch {
      setState({ status: "invalid", message: "No se pudo abrir el regalo. Vuelve a intentarlo." });
    }
  }

  if (state.status === "loading") return <section className="reveal-gift"><p>Preparando tu regalo...</p></section>;
  if (state.status === "invalid") return <section className="reveal-gift"><h1>{state.message}</h1></section>;

  const isOpen = state.status === "open";
  return (
    <section className="reveal-gift">
      <div className={`reveal-gift__box ${isOpen ? "reveal-gift__box--open" : ""}`} aria-hidden="true">
        <Gift size={86} />
      </div>
      <div className="reveal-gift__copy">
        <p>Hola {state.giverName}</p>
        <h1>{isOpen ? "Este año regalas a..." : "Tu Amigo Invisible de Reyes está preparado"}</h1>
        {isOpen ? (
          <strong className="reveal-gift__name animate-pop">{state.receiverName}</strong>
        ) : (
          <Button
            className="min-h-11 px-6"
            size="lg"
            variant="secondary"
            type="button"
            disabled={state.status === "opening"}
            onClick={openGift}
          >
            {state.status === "opening" ? "Abriendo..." : "Abrir regalo"}
          </Button>
        )}
      </div>
    </section>
  );
}
