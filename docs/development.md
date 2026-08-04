# Desarrollo

## Entorno

Local usa el mismo Supabase/Postgres que Vercel. No existe base aislada ni fallback de datos. Cualquier mutación,
sorteo, migración o envío realizado desde local tiene efectos reales.

El runtime requerido es Node.js 22.x, alineado entre `.nvmrc`, `package.json` y Vercel. Node.js 20 no es compatible
con el transporte WebSocket nativo que usa actualmente Supabase.

```bash
nvm use
npm install
cp .env.example .env.local
npm run dev
```

Variables obligatorias:

- `PUBLIC_SUPABASE_URL`
- `PUBLIC_SUPABASE_ANON_KEY`
- `DATABASE_URL`
- `APP_URL`, con el origen canónico de Production
- `REVEAL_TOKEN_ENCRYPTION_KEY`, Base64 de 32 bytes

Opcionales para email: `RESEND_API_KEY`. Para WhatsApp deben configurarse conjuntamente `KAPSO_API_KEY`, `KAPSO_PHONE_NUMBER_ID`, `KAPSO_TEMPLATE_NAME`, `KAPSO_TEMPLATE_LANGUAGE`, `KAPSO_WEBHOOK_SECRET` y `KAPSO_TEST_RECIPIENT_PHONE`. La misma clave de cifrado debe usarse en local y Vercel.

## Comandos

| Comando | Propósito |
| --- | --- |
| `npm run dev` | Desarrollo conectado a los datos reales. |
| `npm run build` | Comprobación Astro y build de Vercel. |
| `npm test` | Pruebas unitarias sin acceso a Supabase. |
| `npm run admin:bootstrap -- --email ... --name ...` | Alta idempotente del administrador. |
| `npm run admin:set-password -- --user-id ...` | Asignación o reset manual de contraseña por UUID. |
| `npm run db:generate` | Generar migración y snapshot Drizzle. |
| `npm run db:migrate` | Aplicar migraciones a la base real. |
| `npm run db:studio` | Abrir Drizzle Studio. |

Drizzle es la única autoridad de schema. `drizzle/` y `drizzle/meta/` se versionan. Antes de migrar se debe hacer
backup, revisar el SQL y confirmar que la migración inicial está baselinada.

No registrar ni copiar secretos, contactos, tokens, hashes o URLs de revelación.

`admin:set-password` carga `PUBLIC_SUPABASE_URL` desde `.env.local` o `.env`. Solicita de forma oculta la contraseña
y, si no están exportadas, `SUPABASE_SECRET_KEY` o `SUPABASE_SERVICE_ROLE_KEY`. Estas claves administrativas son
exclusivas de operación local: no se añaden a `AppEnv`, no se configuran en Vercel y nunca se pasan como argumento.
