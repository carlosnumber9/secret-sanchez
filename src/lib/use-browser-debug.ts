import { useEffect } from "react";
import { browserDebug } from "./browser-debug";

export function useBrowserDebug(component: string) {
  useEffect(() => {
    browserDebug("component.mounted", { component });
    return () => browserDebug("component.unmounted", { component });
  }, [component]);
}
