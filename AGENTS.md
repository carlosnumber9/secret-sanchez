# AGENTS.md

## Proyecto

Secret Sanchez es una app familiar de Amigo Invisible para Reyes. El objetivo actual es que Juan pueda organizar el sorteo, gestionar participantes, generar asignaciones y enviar o consultar enlaces secretos de revelacion.

## Estado Actual Del MVP

- La app usa Astro con SSR y adapter de Vercel.
- Hay React Islands para las partes interactivas de administracion.
- Hay datos demo en `src/lib/demo.ts` para poder iterar UI cuando faltan variables de entorno o base de datos.
- Supabase se usa para Auth y Postgres cuando esta configurado.
- Drizzle define el schema relacional en `src/db/schema.ts`.
- Resend esta preparado para email.
- Kapso esta preparado para WhatsApp en una fase posterior.

## Stack

- Astro
- React
- TypeScript
- CSS por componente y estilos globales en `src/styles`
- Supabase Auth y Postgres
- Drizzle ORM
- Resend
- Vercel

## Comandos

- Instalar dependencias: `npm install`
- Desarrollo: `npm run dev`
- Validar tipos y build: `npm run build`
- Preview local: `npm run preview`
- Generar migraciones Drizzle: `npm run db:generate`
- Ejecutar migraciones Drizzle: `npm run db:migrate`
- Sincronizar schema directamente: `npm run db:push`
- Abrir Drizzle Studio: `npm run db:studio`

Antes de cerrar cambios de codigo, ejecutar `npm run build` cuando sea razonable para el alcance del cambio.

## Variables De Entorno

Variables publicas:

- `PUBLIC_SUPABASE_URL`
- `PUBLIC_SUPABASE_ANON_KEY`

Variables solo servidor:

- `SUPABASE_SERVICE_ROLE_KEY`
- `DATABASE_URL`
- `RESEND_API_KEY`
- `KAPSO_API_KEY`

Variable de app:

- `APP_URL`, con fallback actual a `http://localhost:4321`.

`src/lib/env.ts` tambien acepta `SUPABASE_URL` y `SUPABASE_KEY` como fallback para las variables publicas de Supabase.

No exponer variables privadas en codigo cliente, paginas publicas, logs o payloads JSON.

## Estructura Del Codigo

- `src/pages`: paginas Astro y rutas dinamicas.
- `src/pages/api`: API routes.
- `src/pages/auth/callback.astro`: pantalla cliente que procesa el callback de Supabase.
- `src/pages/api/auth/callback.ts`: endpoint que confirma la sesion de Supabase y escribe cookies.
- `src/pages/r/[token].astro`: revelacion publica por token.
- `src/layouts`: layouts base, admin y revelacion publica.
- `src/components`: componentes Astro reutilizables.
- `src/components/react`: islas React interactivas.
- `src/actions`: acciones de aplicacion; varias reexportan queries de `src/db/queries`.
- `src/db/schema.ts`: schema Drizzle.
- `src/db/queries`: acceso persistente a datos.
- `src/lib`: utilidades de entorno, Supabase, tokens, hashing, Resend, Kapso y demo.
- `src/services/draw`: reglas, validacion y generacion del sorteo.
- `src/services/notifications`: envio de notificaciones.
- `drizzle`: migraciones y snapshots generados por Drizzle.
- `supabase/migrations`: migraciones SQL para Supabase.

## Rutas Existentes

- `/`: entrada inicial.
- `/login`: acceso de administrador por Magic Link.
- `/auth/callback`: callback visual del login.
- `/inicio`: estado general del sorteo.
- `/familia`: gestion de nucleos y participantes.
- `/sorteo`: reglas y generacion del reparto.
- `/envios`: estado de mensajes.
- `/r/[token]`: revelacion publica sin login.
- `/api/auth/magic-link`: API para solicitar Magic Link.
- `/api/auth/callback`: API para confirmar sesion.
- `/api/draw/generate`: API protegida para generar sorteo.

## Auth Y Proteccion

- El login usa Magic Link de Supabase.
- `src/middleware.ts` protege `/inicio`, `/familia`, `/sorteo`, `/envios` y APIs bajo `/api/draw`.
- Las paginas protegidas redirigen a `/login?next=...` cuando no hay admin.
- Las APIs protegidas responden `401` con JSON cuando no hay admin.
- La sesion de Supabase se confirma en servidor mediante `src/pages/api/auth/callback.ts`.

## Modelo De Datos

El schema actual incluye:

- `admin_users`
- `family_groups`
- `family_islands`
- `participants`
- `draw_rules`
- `exclusion_rules`
- `draws`
- `assignments`
- `notification_logs`

Estados y enums principales:

- Grupos: `draft`, `ready`, `drawn`, `sent`, `archived`
- Sorteos: `draft`, `generated`, `locked`, `sent`
- Canal preferido: `email`, `whatsapp`, `both`, `manual`
- Canal de notificacion: `email`, `whatsapp`
- Estado de notificacion: `pending`, `sent`, `delivered`, `failed`, `opened`, `manual`

## Sorteo

- La regla implementada actualmente evita autoasignacion.
- La regla `NO_SAME_ISLAND` evita asignaciones dentro del mismo nucleo familiar cuando `noSameIsland` esta activo.
- Hay soporte para exclusiones manuales mediante pares `fromParticipantId` y `toParticipantId`.
- La generacion usa backtracking y barajado con `crypto.randomInt`.
- La validacion vive en `src/services/draw/validateDraw.ts`.
- La generacion persistida vive en `src/actions/generateDraw.ts`; la ruta API cae a modo demo si no hay base de datos configurada.

## Notificaciones

- `sendDrawNotifications` decide envios segun `preferredChannel`.
- Email se envia si el canal es `email` o `both` y existe email.
- WhatsApp se envia si el canal es `whatsapp` o `both` y existe telefono.
- `manual` no dispara envio automatico.

## Estilo Y Convenciones Existentes

- TypeScript con imports usando alias `@/`.
- Astro para paginas, layouts y componentes estaticos.
- React solo para interaccion cliente.
- CSS normal por componente; no hay Tailwind.
- Componentes Astro y React suelen tener su `.css` junto al componente.
- Validacion de inputs de API con Zod.
- Preferir cambios pequenos y coherentes con los patrones existentes.
- No introducir nuevas librerias si el patron actual o la plataforma ya resuelven el problema.
- Mantener textos de UI en espanol.

## Reglas Para Agentes

- Leer el codigo cercano antes de editar.
- No asumir que Supabase, Resend, Kapso o la base de datos estan configurados en local.
- Mantener el modo demo funcionando cuando sea posible.
- No escribir secretos ni valores reales de `.env` en documentacion, tests, logs o commits.
- No revertir cambios del usuario.
- Si se modifica schema, actualizar o generar migraciones de forma explicita y explicar el impacto.
- Si se toca auth, callbacks, cookies o middleware, revisar tambien las rutas relacionadas antes de cerrar.

## Decisiones Pendientes

Estas decisiones no estan fijadas en el repo. No asumirlas sin confirmacion o sin que el codigo existente lo deje claro:

- Politica exacta de tests automatizados.
- Framework de testing preferido.
- Politica de lint/format mas alla de `astro check` dentro de `npm run build`.
- Criterios finales de UI/design system.
- Flujo definitivo de WhatsApp con Kapso.
- Politica de permisos para multiples administradores.
- Estrategia final entre migraciones Drizzle y migraciones de Supabase cuando ambas existan.
