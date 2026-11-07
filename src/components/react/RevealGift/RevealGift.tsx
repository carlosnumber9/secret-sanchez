import { Button } from "@/components/ui/button";
import { Gift } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { requestReveal, RevealRequestError, type RevealPreparation } from "@/lib/reveal-client";
import "./RevealGift.css";

type RevealState =
  | { status: "loading" }
  | { status: "invalid"; message: string }
  | { status: "ready" | "opening"; details: RevealPreparation }
  | { status: "open"; details: RevealPreparation; receiverName: string }
  | { status: "error"; phase: "resolve"; message: string }
  | { status: "error"; phase: "open"; details: RevealPreparation; message: string };

export default function RevealGift() {
  const [state, setState] = useState<RevealState>({ status: "loading" });
  const token = useRef<string | null>(null);
  const active = useRef<AbortController | null>(null);

  const perform = useCallback(async (phase: "resolve" | "open", details?: RevealPreparation) => {
    if (!token.current) { setState({ status: "invalid", message: "Este enlace no parece válido." }); return; }
    active.current?.abort();
    const controller = new AbortController();
    active.current = controller;
    const timeout = window.setTimeout(() => controller.abort(), 12_000);
    setState(phase === "resolve" ? { status: "loading" } : { status: "opening", details: details! });
    try {
      if (phase === "resolve") {
        const data = await requestReveal("resolve", token.current, controller.signal);
        if (active.current === controller) setState({ status: "ready", details: data });
      } else {
        const data = await requestReveal("open", token.current, controller.signal);
        if (active.current === controller) setState({ status: "open", details: details!, receiverName: data.receiverName });
      }
    } catch (error) {
      if (active.current !== controller) return;
      if (error instanceof RevealRequestError && error.invalid) {
        token.current = null;
        setState({ status: "invalid", message: error.message });
      } else {
        const message = error instanceof RevealRequestError ? error.message : "No se pudo conectar. Puedes volver a intentarlo.";
        setState(phase === "resolve" ? { status: "error", phase, message } : { status: "error", phase, details: details!, message });
      }
    } finally {
      window.clearTimeout(timeout);
      if (active.current === controller) active.current = null;
    }
  }, []);

  useEffect(() => {
    token.current ??= window.location.hash.replace(/^#/, "");
    window.history.replaceState(null, "", window.location.pathname + window.location.search);
    void perform("resolve");
    return () => { active.current?.abort(); active.current = null; };
  }, [perform]);

  if (state.status === "loading") return <section className="reveal-gift"><p role="status">Preparando tu regalo...</p></section>;
  if (state.status === "invalid") return <section className="reveal-gift"><h1>{state.message}</h1></section>;
  if (state.status === "error" && state.phase === "resolve") return <section className="reveal-gift">
    <p role="alert">{state.message}</p><Button onClick={() => void perform("resolve")}>Reintentar</Button>
  </section>;

  const isOpen = state.status === "open";
  const { details } = state;
  return <section className="reveal-gift">
    <div className={`reveal-gift__box ${isOpen ? "reveal-gift__box--open" : ""}`} aria-hidden="true"><Gift size={86} /></div>
    <div className="reveal-gift__copy">
      <p>Hola {details.giverName}</p>
      {details.giverKind === "familyIsland" && <p>Representas a la unidad {details.giverIslandName}</p>}
      <h1>{isOpen ? details.giverKind === "familyIsland" ? "Este año vuestra unidad regala a..." : "Este año regalas a..." : "Tu Amigo Invisible de Reyes está preparado"}</h1>
      {state.status === "error" && <p role="alert">{state.message}</p>}
      {isOpen ? <strong className="reveal-gift__name animate-pop">{state.receiverName}</strong> :
        <Button className="min-h-11 px-6" size="lg" variant="secondary" type="button" disabled={state.status === "opening"} onClick={() => void perform("open", details)}>
          {state.status === "opening" ? "Abriendo..." : state.status === "error" ? "Reintentar apertura" : "Abrir regalo"}
        </Button>}
    </div>
  </section>;
}
