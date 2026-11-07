# Desarrollo

## Entorno

Desarrollo y Preview requieren un proyecto Supabase distinto de Production. La app valida que Auth y DATABASE_URL apuntan al mismo proyecto no productivo y que APP_URL tiene otro origen. La configuración histórica compartida se rechaza; no se han provisionado proyectos ni modificado archivos de entorno reales en esta actualización. Las pruebas de integración usan PostgreSQL local y Auth sintético, sin fallback de datos en la app.

El runtime requerido es Node.js 22.23.4 o un parche posterior de la rama 22, alineado entre `.nvmrc`, `package.json` y Vercel. Node.js 20 no es compatible
con el transporte WebSocket nativo que usa actualmente Supabase.

```bash
nvm use
npm ci
cp .env.example .env.development.local
npm run dev
```

Variables obligatorias:

- `PUBLIC_SUPABASE_URL`
- `PUBLIC_SUPABASE_ANON_KEY`
- `DATABASE_URL`
- `APP_URL`, con el origen canónico del entorno actual
- `REVEAL_TOKEN_ENCRYPTION_KEY`, Base64 de 32 bytes

Opcionales para email: `RESEND_API_KEY`. Para WhatsApp deben configurarse conjuntamente `KAPSO_API_KEY`, `KAPSO_PHONE_NUMBER_ID`, `KAPSO_TEMPLATE_NAME`, `KAPSO_TEMPLATE_LANGUAGE`, `KAPSO_WEBHOOK_SECRET` y `KAPSO_TEST_RECIPIENT_PHONE`. Usar una clave de cifrado distinta por entorno; conservar la misma dentro de cada entorno. No copiar datos reales a los proyectos de desarrollo o Preview.

## Comandos

| Comando | Propósito |
| --- | --- |
| `npm run dev` | Desarrollo sobre un proyecto independiente configurado. |
| `npm run build` | Comprobación Astro y build de Vercel. |
| `npm test` | Pruebas unitarias sin acceso a Supabase. |
| `npm run test:integration` | Migraciones y fixtures solo con `TEST_DATABASE_URL` local y base terminada en `_test`. |
| `npm run test:ssr` | Smoke del handler compilado, con entorno sintético local. |
| `npm run test:recovery` | Restauración de fixtures en bases locales efímeras. |
| `npm run db:check` | Comparación de schema y snapshots, sin conexión. |
| `npm run benchmark:draw` | Casos sintéticos de coste del emparejamiento. |
| `npm run admin:bootstrap -- --email ... --name ...` | Alta idempotente del administrador. |
| `npm run admin:set-password -- --user-id ...` | Asignación o reset manual de contraseña por UUID. |
| `npm run db:generate` | Generar migración y snapshot Drizzle. |
| `npm run db:migrate` | Aplicar migraciones a la base real. |
| `npm run db:studio` | Abrir Drizzle Studio. |

Drizzle es la única autoridad de schema. `drizzle/` y `drizzle/meta/` se versionan. Antes de migrar se debe hacer
backup, revisar el SQL y confirmar que la migración inicial está baselinada.

No registrar ni copiar secretos, contactos, tokens, hashes o URLs de revelación.

`admin:set-password` carga el contexto seleccionado y comprueba el aislamiento antes de solicitar credenciales. Solicita de forma oculta la contraseña
y, si no están exportadas, `SUPABASE_SECRET_KEY` o `SUPABASE_SERVICE_ROLE_KEY`. Estas claves administrativas son
exclusivas de operación local: no se añaden a `AppEnv`, no se configuran en Vercel y nunca se pasan como argumento.

## Actualizaciones de dependencias

Las dependencias de aplicación usan rangos explícitos y el lockfile se versiona. Las actualizaciones de React y React DOM se realizan juntas. Los cambios de major de Postgres, TypeScript y dotenv requieren una migración independiente y no se aplican con `npm audit fix --force`.

## Entorno de comandos administrativos

Los comandos cargan `.env.<entorno>.local`, `.env.local`, `.env.<entorno>` y `.env`, sin sobrescribir variables exportadas. Exportar `APP_ENV` antes de ejecutar el comando para seleccionar contexto; por defecto es `development`. `VERCEL_ENV` prevalece si existe. El bootstrap carga el entorno antes de importar la conexión. Drizzle rechaza una `DATABASE_URL` ausente o con protocolo distinto de PostgreSQL; los errores de configuración no incluyen valores.

`shadcn` es una herramienta de generación y se instala solo como dependencia de desarrollo. El compilador permanece en TypeScript 6; actualizar su major requiere validar primero Astro y el runner. Las instalaciones reproducibles utilizan `npm ci`.

El override de `path-to-regexp` dentro de `@vercel/routing-utils` actualiza la rama 6 a su parche de seguridad 6.3, sin cambiar de major. Revisarlo cuando el adapter retire su versión vulnerable. Los avisos restantes de herramientas se revisan explícitamente; no se resuelven mediante downgrades automáticos del framework.

El guardado familiar compara campos editables con las filas bloqueadas. Solo actualiza diferencias; altas y modificaciones se agrupan en lotes y los cambios de bebé se propagan con una actualización por conjunto a las ediciones sin reparto vigente. Un guardado sin diferencias no cambia timestamps de personas o unidades.

Las migraciones compartidas y las copias reales no están autorizadas durante esta actualización. `npm run db:generate` solo produce SQL para revisión; `db:check` no lo aplica.

## Configuración de aislamiento

- `APP_ENV=development|preview|production`; en Vercel manda `VERCEL_ENV`.
- En desarrollo/Preview: `PRODUCTION_SUPABASE_URL` y `PRODUCTION_APP_URL` son referencias públicas obligatorias, sin claves productivas.
- `PUBLIC_SUPABASE_URL` debe identificar otro proyecto `https://<ref>.supabase.co`.
- `DATABASE_URL` debe usar `db.<ref>.supabase.co` o el pooler oficial con usuario `postgres.<ref>` del proyecto actual.
- `APP_URL` usa el origen actual; `REVEAL_TOKEN_ENCRYPTION_KEY` pertenece exclusivamente a ese entorno.
- Los envíos no productivos aceptan únicamente ediciones de prueba; email se redirige a `NOTIFICATION_TEST_EMAIL` y WhatsApp a `KAPSO_TEST_RECIPIENT_PHONE`.
- `APP_ENV=test` solo admite PostgreSQL local con nombre terminado en `_test` y una URL de Auth `.invalid`. No permite saltarse las guardas con un Supabase real.

`db:generate` y `db:check` no conectan a la base. `db:migrate`, `db:push`, `db:studio`, bootstrap y reset de contraseña validan el contexto antes de operar. Para Production, el operador debe seleccionar explícitamente ese contexto; estos comandos no se han ejecutado contra él en esta sesión.
