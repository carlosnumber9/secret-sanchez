# AGENTS.md

## Proyecto

Secret Sanchez es una app familiar de Amigo Invisible para Reyes. El objetivo actual es que Juan pueda organizar el sorteo, gestionar participantes, generar asignaciones y enviar o consultar enlaces secretos de revelacion.

## Estado Actual Del MVP

- La app usa Astro con SSR y adapter de Vercel.
- Hay React Islands para las partes interactivas de administracion.
- Supabase se usa siempre para Auth y Postgres, tambien desde local.
- Local, Preview y Production comparten la misma base y los mismos datos.
- Drizzle define el schema relacional en `src/db/schema.ts`.
- Resend esta preparado para email.
- Kapso esta preparado para WhatsApp en una fase posterior.

## Documentacion

- `docs/README.md` es el indice y la fuente de verdad documental del proyecto.
- Actualizar las docs en el mismo cambio que modifica el comportamiento descrito.
- Distinguir entre comportamiento implementado, parcial, previsto y por decidir.
- Los commits usan `<type>(<scope opcional>): <descripcion en ingles y pasado simple>`.
- Ejemplo: `feat: Added Whatsapp integration over participants`.
- La convencion completa vive en `docs/git-workflow.md`.

## Stack

- Astro
- React
- TypeScript
- shadcn/ui con Base UI
- Tailwind CSS 4
- CSS por componente y estilos globales en `src/styles`
- Supabase Auth y Postgres
- Drizzle ORM
- Resend
- Vercel

## Comandos

- Instalar dependencias: `npm install`
- Desarrollo: `npm run dev`
- Validar tipos y build: `npm run build`
- Pruebas unitarias: `npm test`
- Preparar admin: `npm run admin:bootstrap -- --email ... --name ...`
- Asignar contraseña: `npm run admin:set-password -- --user-id ...`
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

- `DATABASE_URL`
- `REVEAL_TOKEN_ENCRYPTION_KEY`
- `RESEND_API_KEY`
- `KAPSO_API_KEY`

Variable de app:

- `APP_URL`, obligatorio y apuntando al origen canonico de Production.

No exponer variables privadas en codigo cliente, paginas publicas, logs o payloads JSON.

## Estructura Del Codigo

- `src/pages`: paginas Astro y rutas dinamicas.
- `src/pages/api`: API routes.
- `src/pages/api/auth/login.ts`: endpoint que valida email y contraseña y escribe cookies de Supabase.
- `src/pages/r.astro`: revelacion publica; el token vive en el fragmento.
- `src/layouts`: layouts base, admin y revelacion publica.
- `src/components`: componentes Astro reutilizables.
- `src/components/react`: islas React interactivas.
- `src/actions`: acciones de aplicacion; varias reexportan queries de `src/db/queries`.
- `src/db/schema.ts`: schema Drizzle.
- `src/db/queries`: acceso persistente a datos.
- `src/lib`: utilidades de entorno, Supabase, tokens, hashing, logging, Resend y Kapso.
- `src/services/draw`: reglas, validacion y generacion del sorteo.
- `src/services/notifications`: envio de notificaciones.
- `drizzle`: migraciones y snapshots generados por Drizzle.

## Rutas Existentes

- `/`: entrada inicial.
- `/login`: acceso de administrador por email y contraseña.
- `/inicio`: estado general del sorteo.
- `/familia`: gestion de nucleos y participantes.
- `/sorteo`: reglas y generacion del reparto.
- `/envios`: estado de mensajes.
- `/r#token`: revelacion publica sin login.
- `/api/auth/login`: API para iniciar sesion por contraseña.
- `/api/admin/draws/generate`: API protegida para generar sorteo.
- `/api/admin/*`: mutaciones administrativas protegidas.
- `/api/reveal/resolve` y `/api/reveal/open`: resolucion y apertura publica.
- `/api/health`: comprobacion de configuracion y base.

## Auth Y Proteccion

- El login usa email y contraseña de Supabase.
- La autorización busca primero `admin_users.auth_user_id` y solo usa email para enlazar filas legacy sin UUID.
- `src/middleware.ts` protege `/inicio`, `/familia`, `/sorteo`, `/envios` y APIs bajo `/api/admin`.
- Las paginas protegidas redirigen a `/login?next=...` cuando no hay admin.
- Las APIs protegidas responden `401` cuando no hay sesión y `403` cuando la cuenta no está autorizada como admin.
- La sesion de Supabase se crea en servidor mediante `src/pages/api/auth/login.ts`.

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
- Canal de notificacion: `email`, `whatsapp`, `manual`
- Estado de notificacion: `pending`, `sent`, `delivered`, `failed`, `opened`, `manual`

## Sorteo

- La regla implementada actualmente evita autoasignacion.
- La regla `NO_SAME_ISLAND` evita asignaciones dentro del mismo nucleo familiar cuando `noSameIsland` esta activo.
- Hay soporte para exclusiones manuales mediante pares `fromParticipantId` y `toParticipantId`.
- La generacion usa backtracking y barajado con `crypto.randomInt`.
- La validacion vive en `src/services/draw/validateDraw.ts`.
- La generacion persistida vive en `src/actions/generateDraw.ts`, usa transaccion y rechaza otro sorteo activo.
- Los tokens se guardan como hash y ciphertext AES-256-GCM.

## Notificaciones

- El panel exige confirmacion antes de enviar emails reales.
- Los intentos se guardan con clave de idempotencia.
- La entrega manual descifra y copia el enlace bajo autorizacion.
- WhatsApp permanece deshabilitado hasta completar Kapso.

## Estilo Y Convenciones Existentes

- TypeScript con imports usando alias `@/`.
- Astro para paginas, layouts y componentes estaticos.
- React solo para interaccion cliente.
- Tailwind CSS 4 y shadcn/ui para componentes base.
- CSS normal por componente para layout y contenedores translúcidos.
- Componentes Astro y React suelen tener su `.css` junto al componente.
- Validacion de inputs de API con Zod.
- Preferir cambios pequenos y coherentes con los patrones existentes.
- No introducir nuevas librerias si el patron actual o la plataforma ya resuelven el problema.
- Mantener textos de UI en espanol.

## Reglas Para Agentes

- Leer el codigo cercano antes de editar.
- La configuracion de Supabase y base es obligatoria.
- Recordar que cualquier escritura local afecta a los datos reales.
- No escribir secretos ni valores reales de `.env` en documentacion, tests, logs o commits.
- No revertir cambios del usuario.
- Si se modifica schema, actualizar o generar migraciones de forma explicita y explicar el impacto.
- Si se toca auth, credenciales, cookies o middleware, revisar tambien las rutas relacionadas antes de cerrar.

## Decisiones Pendientes

Estas decisiones no estan fijadas en el repo. No asumirlas sin confirmacion o sin que el codigo existente lo deje claro:

- Politica exacta de tests automatizados.
- Framework de testing preferido.
- Politica de lint/format mas alla de `astro check` dentro de `npm run build`.
- Criterios finales de UI/design system.
- Flujo definitivo de WhatsApp con Kapso.
- Politica de permisos para multiples administradores.
