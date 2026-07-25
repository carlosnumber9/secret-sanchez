# Operación y despliegue

## Topología prevista

- **Vercel:** ejecuta Astro SSR y sirve assets estáticos.
- **Supabase Cloud:** autenticación y Postgres.
- **Resend:** email transaccional.
- **Kapso:** WhatsApp cuando se complete.

El repositorio contiene el adapter de Vercel, pero no documenta un proyecto desplegado ni garantiza que exista un
entorno de producción activo.

## Entornos

Como mínimo deben existir:

- **Desarrollo local:** datos no sensibles y servicios de prueba.
- **Producción:** familia real, dominio y proveedores verificados.

Si se añade staging, debe usar un proyecto Supabase y claves independientes. Nunca se debe apuntar el desarrollo
local a producción por comodidad.

## Configuración de Vercel

1. Conectar el repositorio.
2. Usar `npm run build`.
3. Configurar las variables del entorno correspondiente.
4. Definir `APP_URL` con el origen público exacto, sin path.
5. Configurar en Supabase el dominio y callback permitidos.
6. Verificar que las variables privadas no se exponen al cliente.
7. Ejecutar migraciones antes de habilitar código que dependa de ellas.

Para funciones serverless, `DATABASE_URL` debe usar una conexión compatible con el pooler de transacciones de
Supabase. El cliente Drizzle desactiva prepared statements y limita conexiones.

## Migraciones

No está decidida la autoridad definitiva entre Drizzle y Supabase migrations.

Hasta resolverlo:

- Revisar manualmente el SQL.
- Aplicar primero en un entorno no productivo.
- Hacer copia de seguridad antes de una migración destructiva.
- Separar despliegue de schema y código cuando haya incompatibilidad temporal.
- Documentar rollback o forward fix.
- Registrar qué mecanismo aplicó cada migración.

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
- No enviar enlaces reales desde desarrollo.

### Kapso

No está operativo. No debe anunciarse WhatsApp como disponible hasta completar integración, plantillas, webhooks y
pruebas.

## Observabilidad

Todavía no hay una solución de observabilidad definida. El mínimo operativo debe incluir:

- Errores de servidor con identificador de correlación.
- Métricas de generación fallida.
- Intentos y resultados de notificación.
- Errores de callback de autenticación.
- Alertas por tasa anormal de fallos.

Nunca registrar tokens, URLs de revelación completas, claves, cookies ni payloads de callback. Reducir datos
personales en logs y aplicar retención limitada.

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
