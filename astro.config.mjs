import react from "@astrojs/react";
import vercel from "@astrojs/vercel";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "astro/config";

export default defineConfig({
  output: "server",
  adapter: vercel({ maxDuration: 60 }),
  integrations: [react()],
  security: {
    csp: {
      styleDirective: { resources: [{ resource: "'self'", kind: "element" }, { resource: "'unsafe-inline'", kind: "attribute" }] },
      directives: ["default-src 'self'", "base-uri 'self'", "object-src 'none'", "form-action 'self'", "img-src 'self' data: blob:", "connect-src 'self' blob:"]
    }
  },

  vite: {
    plugins: [tailwindcss()]
  }
});
