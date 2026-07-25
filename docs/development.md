# Desarrollo

## Requisitos

- Node.js compatible con Astro 5.
- npm.
- Proyecto de Supabase para autenticación y Postgres.
- Opcional para cada integración: cuenta de Resend y cuenta de Kapso.

No se necesita Supabase local ni Docker para el flujo previsto actualmente.

## Instalación

```bash
npm install
cp .env.example .env
npm run dev
```

La aplicación queda disponible por defecto en `http://localhost:4321`.

## Variables

| Variable | Exposición | Uso |
| --- | --- | --- |
| `PUBLIC_SUPABASE_URL` | Pública | URL del proyecto Supabase. |
| `PUBLIC_SUPABASE_ANON_KEY` | Pública | Cliente público de Supabase. |
| `SUPABASE_SERVICE_ROLE_KEY` | Servidor | Operaciones administrativas de Supabase. |
| `DATABASE_URL` | Servidor | Conexión Postgres para Drizzle. |
| `APP_URL` | Servidor | Base de callbacks y enlaces de revelación. |
| `RESEND_API_KEY` | Servidor | Envío de email. |
| `KAPSO_API_KEY` | Servidor | WhatsApp futuro. |

`src/lib/env.ts` acepta también `SUPABASE_URL` y `SUPABASE_KEY` como fallback de las variables públicas.

No copiar valores reales en issues, commits, documentación, fixtures, logs o mensajes de error.

## Scripts

| Comando | Propósito |
| --- | --- |
| `npm run dev` | Servidor de desarrollo. |
| `npm run build` | `astro check` y build SSR para Vercel. |
| `npm run preview` | Preview local del build. |
| `npm run db:generate` | Genera migraciones desde el schema Drizzle. |
| `npm run db:migrate` | Ejecuta migraciones pendientes. |
| `npm run db:push` | Sincroniza directamente el schema con la base. |
| `npm run db:studio` | Abre Drizzle Studio. |

`db:push` puede modificar una base directamente. No debe usarse contra producción sin confirmar el entorno y la
estrategia de migraciones.

## Modo demo

Los datos viven en `src/lib/demo.ts`. Sirven para diseñar y probar componentes sin depender de datos familiares
reales.

Limitación actual: aunque las páginas cargan datos demo, el middleware exige administrador en todas las pantallas
administrativas. Por tanto, el modo demo sin variables no es todavía un recorrido completo. `/r/demo` sí es público.

Al corregirlo se debe elegir un comportamiento explícito:

- Habilitar administración demo solo en desarrollo, o
- Mantener login obligatorio y definir datos demo tras autenticación.

Nunca se debe activar un bypass de autenticación en producción.

## Estructura

```text
src/
  actions/                 Casos de uso de aplicación
  components/              Componentes Astro
  components/react/        Islas React
  db/                      Schema, cliente y queries
  layouts/                 Layouts de páginas
  lib/                     Entorno e integraciones
  pages/                   Páginas y endpoints
  services/draw/           Dominio del sorteo
  services/notifications/  Dominio de entrega
  styles/                  Tokens y estilos globales
drizzle/                   Migraciones Drizzle
supabase/migrations/       Migraciones Supabase
docs/                      Documentación del producto
```

## Convenciones de código

- TypeScript estricto.
- Imports internos mediante `@/`.
- Textos de interfaz en español.
- Zod para entradas externas.
- Astro para estructura; React para interacción real.
- CSS normal, sin Tailwind.
- Cambios pequeños y coherentes con el código cercano.
- No añadir librerías si los patrones actuales o la plataforma resuelven el caso.
- No consultar la base directamente desde componentes de navegador.
- No confiar en identificadores de administrador recibidos desde el cliente.

## Cambios de schema

1. Modificar `src/db/schema.ts`.
2. Generar o escribir una migración explícita.
3. Revisar el SQL generado.
4. Mantener coordinados `drizzle/` y `supabase/migrations/` mientras haya dos estrategias.
5. Actualizar [data-model.md](./data-model.md).
6. Explicar compatibilidad, backfill y rollback.
7. No ejecutar contra una base remota sin confirmar el entorno.

## Criterio de cierre

Antes de considerar terminado un cambio:

1. Revisar el diff y preservar cambios ajenos.
2. Validar errores, vacíos y carga.
3. Ejecutar `npm run build`.
4. Ejecutar las pruebas aplicables cuando existan.
5. Revisar auth, cookies y middleware si se tocó el acceso.
6. Revisar schema y migraciones si se tocó persistencia.
7. Actualizar la documentación relacionada.
8. Usar el formato de commit definido en [git-workflow.md](./git-workflow.md).
