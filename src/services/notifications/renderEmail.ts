import { readFileSync } from "node:fs";
import { join } from "node:path";

let templates: { html: string; text: string } | undefined;

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, character => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  })[character]!);
}

export function renderEmail(input: { name: string; revealUrl: string; testMode?: boolean }) {
  const url = new URL(input.revealUrl);
  if (!["https:", "http:"].includes(url.protocol) || !url.hash || url.username || url.password) {
    throw new Error("Invalid reveal URL.");
  }
  templates ??= {
    html: readFileSync(join(process.cwd(), "emails/reveal-resend.html"), "utf8"),
    text: readFileSync(join(process.cwd(), "emails/reveal-resend.txt"), "utf8")
  };
  const variables: Record<string, string> = {
    PARTICIPANT_NAME: input.name,
    REVEAL_URL: input.revealUrl,
    DELIVERY_NOTE: input.testMode
      ? "PRUEBA: este mensaje simula una entrega y se envía únicamente al administrador."
      : "Este enlace es personal. Guárdalo para volver a consultar tu reparto."
  };
  const substitute = (template: string, html: boolean) => template.replace(/\{\{\{([A-Z_]+)\}\}\}/g, (_, key: string) => {
    if (!Object.hasOwn(variables, key)) throw new Error("Unknown email template variable.");
    return html ? escapeHtml(variables[key]) : variables[key];
  });
  return {
    subject: `${input.testMode ? "[PRUEBA] " : ""}Tu Amigo Invisible de Reyes ya está listo`,
    html: substitute(templates.html, true),
    text: `${input.testMode ? "[PRUEBA]\n\n" : ""}${substitute(templates.text, false)}`
  };
}
