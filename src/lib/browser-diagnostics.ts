import { browserDebug, debugRoute } from "./browser-debug";

// This module is installed once per document by the shared layout.
browserDebug("page.started", { route: debugRoute(location.pathname) });
for (const event of ["pageshow", "pagehide", "online", "offline", "popstate", "astro:page-load", "astro:after-swap"]) {
  window.addEventListener(event, () => browserDebug(`page.${event}`, { route: debugRoute(location.pathname), online: navigator.onLine }));
}
document.addEventListener("visibilitychange", () => browserDebug("page.visibility", { hidden: document.hidden }));
window.addEventListener("error", () => browserDebug("runtime.error"), true);
window.addEventListener("unhandledrejection", () => browserDebug("runtime.unhandled_rejection"));
for (const event of ["click", "submit", "change", "invalid"]) {
  document.addEventListener(event, (interaction) => {
    const target = interaction.target;
    if (!(target instanceof Element)) return;
    const control = target.closest("button, a, input, select, textarea, form");
    if (!control) return;
    browserDebug(`ui.${event}`, { element: control.tagName.toLowerCase(), prevented: interaction.defaultPrevented });
  }, true);
}
