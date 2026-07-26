# Estado actual

Última revisión documental: **26 de julio de 2026**.

## Implementado

- Astro SSR con adapter de Vercel y Node.js 22.
- Un único Supabase/Postgres compartido por local y Vercel.
- Configuración obligatoria, sin fixtures ni conexiones placeholder.
- Magic Link solicitado por API, callback de servidor y allowlist `admin_users`.
- Grupo activo por administrador, dashboard real y alta inicial del grupo.
- Persistencia de núcleos, participantes y activación desde la interfaz.
- Sorteo transaccional con propiedad, reglas, exclusiones, bloqueo e idempotencia por estado.
- Hash y cifrado autenticado de tokens de revelación.
- Enlaces con token en fragmento y apertura mediante APIs públicas.
- Envío de emails confirmado desde el panel, reintento y entrega manual.
- Logs JSON para Runtime Logs de Vercel.
- Health check, bootstrap de administrador y pruebas unitarias sin acceso a la base.

## Parcial

- La UI todavía no mantiene exclusiones ni edita todos los campos existentes.
- Resend requiere clave y dominio verificado para entregar emails reales.
- WhatsApp está deshabilitado hasta completar Kapso.
- `delivered` requiere webhooks del proveedor.
- Asignaciones creadas antes del cifrado no tienen un enlace recuperable.
- No existe regeneración de un sorteo bloqueado.

## Riesgos operativos

- Local, Preview y Production modifican la misma base.
- Ejecutar migraciones, sortear o enviar desde local tiene efectos reales.
- Antes de aplicar migraciones se debe revisar y respaldar Supabase.
- El primer administrador debe prepararse explícitamente con `npm run admin:bootstrap`.
