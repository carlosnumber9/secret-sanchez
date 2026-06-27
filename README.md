# Secret Sánchez

App familiar de Amigo Invisible para Reyes, pensada para que Juan pueda organizar el sorteo sin fricción.

## Stack

- Astro con SSR en Vercel
- React Islands para edición interactiva
- TypeScript
- CSS normal por componente, sin Tailwind
- Supabase Cloud para Auth y Postgres
- Drizzle ORM
- Resend para email
- Kapso preparado para WhatsApp en una fase posterior

## Desarrollo local

```bash
npm install
cp .env.example .env
npm run dev
```

El entorno local apunta a Supabase Cloud. No hace falta Supabase local ni Docker para el MVP.

## Scripts

```bash
npm run dev
npm run build
npm run preview
npm run db:generate
npm run db:migrate
npm run db:studio
```

## Variables

`PUBLIC_SUPABASE_URL` y `PUBLIC_SUPABASE_ANON_KEY` se usan en cliente y servidor.

`SUPABASE_SERVICE_ROLE_KEY`, `DATABASE_URL`, `RESEND_API_KEY` y `KAPSO_API_KEY` son solo de servidor.

## Rutas

- `/login`: acceso de organizador por Magic Link.
- `/inicio`: estado general del sorteo.
- `/familia`: gestión de núcleos y familiares.
- `/sorteo`: reglas y generación del reparto.
- `/envios`: estado de mensajes.
- `/r/[token]`: revelación pública sin login.

## Estado del MVP

La app arranca con datos demo si faltan variables de entorno, para poder iterar el diseño desde el primer minuto. Al configurar Supabase Cloud y ejecutar migraciones, las capas de Drizzle, Auth, tokens, sorteo y notificaciones quedan listas para conectarse a datos reales.
