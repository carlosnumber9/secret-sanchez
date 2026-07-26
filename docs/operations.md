# Operación y despliegue

## Topología prevista

- **Vercel:** ejecuta Astro SSR y sirve assets estáticos.
- **Supabase Cloud:** autenticación y Postgres.
- **Resend:** email transaccional.
- **Kapso:** WhatsApp cuando se complete.

El repositorio está vinculado al proyecto Vercel `carlos-projects-fa17cb11/secret-sanchez`, conectado a GitHub con
`main` como rama de Production. El dominio reservado es `https://secret-sanchez.vercel.app`. No se debe crear el
primer despliegue hasta haber aplicado la migración pendiente.

## Entornos

El proyecto usa deliberadamente un único Supabase/Postgres desde local y Vercel. No hay aislamiento de datos:
cualquier escritura local o de Preview es real. Las acciones de sorteo y envío requieren confirmación.

## Configuración de Vercel

1. Mantener Astro como preset, Node.js 22.x, `npm install` y `npm run build`.
2. Configurar las mismas variables en Production y Preview.
3. Definir `APP_URL` como `https://secret-sanchez.vercel.app`.
4. Configurar en Supabase el dominio y callback permitidos.
5. Verificar que las variables privadas no se exponen al cliente.
6. Configurar la misma clave `REVEAL_TOKEN_ENCRYPTION_KEY` en todos los contextos.
7. Ejecutar migraciones antes de habilitar código que dependa de ellas.

Para funciones serverless, `DATABASE_URL` debe usar una conexión compatible con el pooler de transacciones de
Supabase. El cliente Drizzle desactiva prepared statements y limita conexiones.

## Migraciones

Drizzle es la única autoridad. Revisar manualmente el SQL, hacer backup y aplicar `npm run db:migrate` una sola vez
antes de desplegar código dependiente. No se ejecutan migraciones durante el build.

No usar `db:push` en producción como procedimiento habitual.

## Proveedores

### Supabase

- Configurar URL del sitio y redirects.
- Crear el administrador inicial de forma controlada.
- Revisar email templates y caducidad de Magic Links.
- Verificar RLS y grants.
- Activar backups apropiados al valor de los datos.

### Resend

- Verificar el dominio.
- Configurar SPF/DKIM según el proveedor.
- Probar remitente y reputación.
- Gestionar errores y límites.
- Confirmar explícitamente cualquier envío iniciado desde local: utiliza el proveedor y los datos reales.

### Kapso

No está operativo. No debe anunciarse WhatsApp como disponible hasta completar integración, plantillas, webhooks y
pruebas.

## Observabilidad

El servidor emite JSON estructurado para Runtime Logs de Vercel: autenticación, autorización, mutaciones, sorteo,
notificaciones, revelación y health check. Los errores técnicos incluyen `errorId`, etapa, tipo, código y una
cadena limitada de causas cuando existe.

Nunca registrar tokens, URLs de revelación completas, claves, cookies ni payloads de callback. Reducir datos
personales en logs y aplicar retención limitada. Los mensajes técnicos se sanean antes de registrarse para ocultar
URLs de conexión, emails y credenciales largas.

## Backups y recuperación

Antes del uso familiar real debe verificarse:

- Política de backups de Supabase.
- Restauración probada o procedimiento documentado.
- Exportación de participantes antes del sorteo.
- Capacidad de recuperar estados sin recuperar tokens en claro.

Si los tokens se pierden, la recuperación correcta es regenerar de forma explícita e invalidar el sorteo anterior,
no intentar derivarlos desde sus hashes.

## Checklist de release

- Build y pruebas completados.
- Migraciones revisadas y aplicadas.
- Administrador inicial verificado.
- Callbacks de Supabase correctos.
- `APP_URL` correcto.
- RLS/grants revisados.
- Dominio de Resend verificado.
- Sorteo real probado con un grupo ficticio.
- Enlaces entregados antes de descartar tokens.
- Reintentos e idempotencia comprobados.
- Logs sin información sensible.
- Rollback definido.
- Documentación y roadmap actualizados.

## Incidentes

### Enlace expuesto

Invalidar el sorteo o token afectado según la política vigente, generar uno nuevo, comunicarlo por canal seguro y
revisar logs sin copiar el token.

### Envíos duplicados

Detener reintentos, identificar asignaciones afectadas, conservar evidencias del proveedor y corregir la clave de
idempotencia antes de reanudar.

### Sorteo parcial

No completar asignaciones manualmente. Marcar la ejecución como fallida, revertir o invalidar el registro parcial y
repetir mediante el flujo transaccional.
