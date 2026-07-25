# Secret Sánchez

Secret Sánchez es una aplicación familiar de Amigo Invisible para Reyes. Permite preparar la familia, aplicar
restricciones al sorteo y entregar a cada participante un enlace privado para descubrir a quién hace el regalo.

El proyecto está construido con Astro en modo SSR, React Islands y TypeScript. Usa Supabase para autenticación y
Postgres, Drizzle como ORM, Resend para email y está preparado para incorporar WhatsApp mediante Kapso. El despliegue
objetivo es Vercel.

## Puesta en marcha

Necesitas Node.js, un proyecto de Supabase y, para disponer de todas las integraciones, cuentas de Resend y Kapso.

```bash
npm install
cp .env.example .env
npm run dev
```

Configura en `.env` las URLs y claves de tus propios servicios. Para crear las tablas en Postgres puedes generar y
ejecutar las migraciones con:

```bash
npm run db:generate
npm run db:migrate
```

Valida el proyecto antes de desplegar:

```bash
npm run build
```

## Documentación

La documentación funcional, técnica y operativa está en [`docs/`](./docs/README.md).
