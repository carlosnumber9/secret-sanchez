import { useState } from "react";
import FamilyEditor from "../FamilyEditor/FamilyEditor";
import GroupSetup from "../GroupSetup/GroupSetup";
import { Card, CardContent } from "@/components/ui/card";
import { refreshData } from "@/lib/refresh-data";
import type { FamilyView } from "@/lib/admin-view-models";

export default function FamilyWorkspace({ initialState }: { initialState: FamilyView }) {
  const [state, setState] = useState(initialState);
  async function refresh() { setState(await refreshData<FamilyView>("/api/admin/family")); }
  return state.familyId && state.revision
    ? <FamilyEditor familyId={state.familyId} initialRevision={state.revision} initialIslands={state.islands} />
    : <Card className="bg-[var(--glass-card)] ring-primary/20"><CardContent><div className="stack">
      <h2>Crea la familia</h2><p>Será el censo permanente para todas las ediciones.</p><GroupSetup onCreated={refresh} />
    </div></CardContent></Card>;
}
