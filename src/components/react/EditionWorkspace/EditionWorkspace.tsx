import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import EditionConfigurator from "../EditionConfigurator/EditionConfigurator";
import EditionRules from "../EditionRules/EditionRules";
import RevokeDraw from "../RevokeDraw/RevokeDraw";
import { refreshData } from "@/lib/refresh-data";
import type { EditionView } from "@/lib/admin-view-models";
import { getEditionStatusLabel } from "@/services/editions/status";

export default function EditionWorkspace({ initialState }: { initialState: EditionView }) {
  const [state, setState] = useState(initialState);
  const [version, setVersion] = useState(0);
  const { edition, currentDraw } = state;
  const locked = Boolean(currentDraw) || edition.status === "archived";
  async function refresh() {
    setState(await refreshData<EditionView>(`/api/admin/editions/${edition.id}`));
    setVersion(value => value + 1);
  }
  return <>
    <div className="section-header"><p>{edition.year}</p><h1>{edition.name}</h1><div className="cluster">
      <Badge className={edition.kind === "final" ? "min-h-6 bg-chart-2/15 px-2.5 text-chart-5" : "min-h-6 px-2.5 text-muted-foreground"} variant={edition.kind === "final" ? "secondary" : "outline"}>{edition.kind === "final" ? "Definitiva" : "Prueba"}</Badge>
      <Badge className="min-h-6 px-2.5 text-muted-foreground" variant="outline">{getEditionStatusLabel(edition.status)}</Badge>
    </div></div>
    <div className="cluster cluster--actions"><a className={buttonVariants({ size: "lg" })} href={`/ediciones/${edition.id}/sorteo`}>{currentDraw ? "Ver reparto" : "Ir al reparto"}</a>
      {currentDraw && <a className={buttonVariants({ variant: "secondary" })} href={`/ediciones/${edition.id}/envios`}>Ver envíos</a>}</div>
    <Card><CardContent><div className="stack"><h2>Participantes y roles</h2><p>Los núcleos desactivados prevalecen sobre la configuración individual.</p>
      <EditionConfigurator key={`people-${version}`} editionId={edition.id} initialIslands={state.islands} initialPeople={state.people} locked={locked} />
    </div></CardContent></Card>
    <Card><CardContent><div className="stack"><h2>Reglas y exclusiones</h2>
      <EditionRules key={`rules-${version}`} editionId={edition.id} people={state.people.filter(person => !person.isBaby).map(({ id, name }) => ({ id, name }))} initialNoSameIsland={state.noSameIsland} initialExclusions={state.exclusions} locked={locked} />
    </div></CardContent></Card>
    {currentDraw && <Card className="bg-[var(--glass-secondary)]"><CardContent><div className="stack"><h2>Revertir intento {currentDraw.attemptNumber}</h2>
      <RevokeDraw editionId={edition.id} drawId={currentDraw.id} exposure={state.exposure} onRevoked={refresh} />
    </div></CardContent></Card>}
    {state.revokedAttempts.length > 0 && <Card><CardContent><div className="stack"><h2>Intentos anulados</h2>
      {state.revokedAttempts.map(attempt => <p key={attempt.id}>Intento {attempt.attemptNumber} · anulado {attempt.revokedAt ? new Date(attempt.revokedAt).toLocaleString("es-ES", { timeZone: "Europe/Madrid" }) : ""}</p>)}
    </div></CardContent></Card>}
  </>;
}
