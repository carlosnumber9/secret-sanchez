# Secret Sánchez

Secret Sánchez es una aplicación familiar de Amigo Invisible para Reyes. Permite preparar la familia, aplicar
restricciones al sorteo y entregar a cada participante un enlace privado para descubrir a quién hace el regalo.

El proyecto está construido con Astro en modo SSR, React Islands y TypeScript. Usa Supabase para autenticación y
Postgres, Drizzle como ORM, Resend para email y usa Kapso para WhatsApp, pendiente de activación operativa. El despliegue
objetivo es Vercel.

Local y Vercel utilizan el mismo Supabase y los mismos datos. La aplicación no usa fallbacks; las pruebas sí emplean fixtures aislados. Configuración,
migraciones, sorteos y envíos locales tienen efectos reales.

## Puesta en marcha

Necesitas Node.js 22.23.4 o un parche posterior de la rama 22, un proyecto de Supabase y, para disponer de todas las integraciones, cuentas de Resend y
Kapso. Si utilizas nvm, el repositorio selecciona la versión compatible mediante `.nvmrc`.

```bash
nvm use
npm ci
cp .env.example .env.local
npm run dev
```

Configura en `.env.local` las URLs y claves de tus propios servicios. Las migraciones ya están versionadas. Revisar [operación](./docs/operations.md), destino y autorización antes de aplicarlas:

```bash
npm run db:check
# Solo en una base propia autorizada:
npm run db:migrate
```

Valida el proyecto antes de desplegar:

```bash
npm run build
npm test
```

## Documentación

La documentación funcional, técnica y operativa está en [`docs/`](./docs/README.md).

La actualización de noviembre deja SQL y activaciones externas pendientes por instrucción del propietario: solo código, sin migraciones ni copias reales.
