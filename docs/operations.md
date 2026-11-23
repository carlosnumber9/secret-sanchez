# Operación y despliegue

## Topología documentada

- **Vercel:** ejecuta Astro SSR y sirve assets estáticos.
- **Supabase Cloud:** autenticación y Postgres.
- **Resend:** email transaccional.
- **Kapso:** plantillas de WhatsApp y webhooks de entrega.

La configuración histórica del repositorio está vinculada al proyecto Vercel `carlos-projects-fa17cb11/secret-sanchez`, conectado a GitHub con
`main` como rama de Production. El dominio reservado es `https://secret-sanchez.vercel.app`. Esta actualización no certifica la configuración remota. Los cambios que requieren tablas opcionales detectan su ausencia; sus funcionalidades distribuidas quedan pendientes de migración.

## Entornos

La configuración histórica compartía Supabase. El código exige ahora proyectos independientes para desarrollo y Preview y rechaza las conexiones compartidas. El aislamiento real queda pendiente de provisionamiento y configuración por el propietario. Durante aquella actualización no se exportaron datos ni se modificaron secretos remotos. La consolidación posterior autorizada se describe al final de este documento.

## Configuración de Vercel

1. Mantener Astro como preset, Node.js 22.23.4 o un parche posterior de la rama 22, `npm ci` y `npm run build`.
2. Configurar proyectos Supabase, credenciales y claves de cifrado independientes para Production y Preview. En Preview añadir referencias no secretas `PRODUCTION_SUPABASE_URL` y `PRODUCTION_APP_URL`.
3. Definir `APP_URL` como origen canónico de cada entorno; Production conserva su dominio y Preview debe tener uno distinto.
4. Mantener habilitado Email/Password y deshabilitar `Allow new users to sign up` en Supabase Auth.
5. Verificar que las variables privadas no se exponen al cliente.
6. Mantener una clave `REVEAL_TOKEN_ENCRYPTION_KEY` independiente por entorno, compartida solo entre instancias de ese entorno.
7. Ejecutar migraciones antes de habilitar código que dependa de ellas.

Para funciones serverless, `DATABASE_URL` debe usar una conexión compatible con el pooler de transacciones de
Supabase. El cliente Drizzle desactiva prepared statements y limita conexiones.

## Migraciones

Drizzle es la única autoridad. Revisar manualmente el SQL, hacer backup y aplicar `npm run db:migrate` una sola vez
antes de desplegar código dependiente. No se ejecutan migraciones durante el build.

No usar `db:push` en producción como procedimiento habitual.

Antes de aplicar la migración que hace único `admin_users.auth_user_id`, ejecutar una comprobación de solo lectura y
confirmar que no devuelve filas:

```sql
SELECT auth_user_id, count(*)
FROM admin_users
WHERE auth_user_id IS NOT NULL
GROUP BY auth_user_id
HAVING count(*) > 1;
```

## Migración a contraseña

El cambio se realiza sobre los usuarios existentes de Supabase; no se deben recrear cuentas ni cambiar sus UUID.

1. Hacer backup, confirmar que la consulta de duplicados no devuelve filas y aplicar la migración revisada.
2. Mantener desplegada temporalmente la versión anterior mientras se preparan las credenciales.
3. Para cada UUID ejecutar `npm run admin:set-password -- --user-id <uuid>` y escribir dos veces la contraseña.
4. El comando carga `PUBLIC_SUPABASE_URL` desde `.env.local` o `.env`. La clave administrativa se toma primero de
   `SUPABASE_SECRET_KEY`, después de `SUPABASE_SERVICE_ROLE_KEY` y, si ninguna existe, se solicita de forma oculta.
5. Desplegar el login por contraseña.
6. Verificar el acceso de cada administrador y que `auth_user_id` haya quedado enlazado.
7. Deshabilitar el signup público en Supabase.

La actualización de contraseña puede revocar las sesiones del usuario afectado. El código no borra las sesiones
existentes durante el despliegue, pero cada administrador debe estar preparado para autenticarse de nuevo. El mismo
comando es el procedimiento de recuperación mientras no exista autoservicio.

## Proveedores

### Supabase

- Mantener habilitado el proveedor Email/Password y bloqueado el signup público.
- Crear el usuario y su fila de `admin_users` de forma controlada.
- Asignar y restablecer contraseñas exclusivamente por UUID con el comando administrativo.
- Revisar la política de fortaleza y protección de contraseñas.
- Verificar RLS y grants.
- Activar backups apropiados al valor de los datos.

### Resend

- Verificar el dominio.
- Configurar SPF/DKIM según el proveedor.
- Probar remitente y reputación.
- Gestionar errores y límites.
- Confirmar explícitamente cualquier envío iniciado desde local: utiliza el proveedor y los datos reales.

### Kapso

El código está integrado, pero la operación requiere una plantilla aprobada con nombre y URL como parámetros del cuerpo, las variables `KAPSO_*` y un webhook de teléfono registrado contra `/api/webhooks/kapso` para `whatsapp.message.sent`, `delivered`, `read` y `failed`. Verificar siempre la edición de prueba antes de contactar teléfonos reales.

## Migración de ediciones

Antes de aplicar `0003_editions.sql`:

1. Crear un backup verificable de Supabase.
2. Contar familias, núcleos, participantes, sorteos, asignaciones y logs.
3. Revisar que cada grupo actual se convertirá en una familia y edición definitiva.
4. Ejecutar la migración una sola vez mediante `npm run db:migrate`.
5. Repetir conteos y abrir un enlace existente controlado.

No probar esta migración contra la conexión compartida sin backup y autorización explícita.

## Migración de bebés y unidades

`0005_past_winter_soldier.sql` debe aplicarse después de `0004`. Añade snapshots de unidades, generaliza el regalador de una asignación, incorpora bebés y representantes y habilita `read`. Antes de aplicarla comprobar duplicados no nulos de `notification_logs.provider_message_id`; después validar conteos y marcar los bebés desde `/familia` o mediante una actualización transaccional equivalente.

## Migración de estados de edición

`0007_flat_dragon_man.sql` convierte cualquier edición legacy en `draft` a `ready`, cambia el valor por defecto a `ready` y elimina `draft` del enum. Aplicarla antes de desplegar el código que solo reconoce los cuatro estados vigentes. Después, comprobar que ninguna edición quedó fuera de `ready`, `drawn`, `sent` o `archived`.

## Observabilidad

El servidor emite JSON estructurado y correlacionado para Runtime Logs de Vercel. El contrato, la identidad, el
inventario de rutas/operaciones, los niveles y los procedimientos de investigación viven en [observabilidad](./observability.md).

`X-Request-Id` identifica la petición de aplicación; `errorId` identifica el diagnóstico técnico. `LOG_LEVEL=info`
es el valor por defecto; `debug` añade detalle acotado de repositorios, bloqueos y transacciones. Los éxitos de las
mutaciones transaccionales se registran después del commit. No se registran cuerpos, contactos, SQL, credenciales,
tokens, enlaces secretos ni parejas del sorteo.

La conservación depende del plan de Vercel. No se ha configurado archivo externo ni verificado la operación remota.

## Backups y recuperación

Procedimiento y evidencia sintética en [release y recuperación](./release-recovery.md). Ninguna restauración ni exportación real se ha ejecutado en esta actualización.

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
- Email/Password habilitado y signup público deshabilitado en Supabase.
- Contraseñas asignadas a los UUID administrativos.
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

## Alcance de esta actualización

Durante la actualización de mantenimiento anterior, por instrucción del propietario: solo código, sin copias de datos reales ni migraciones en Supabase compartido. La consolidación posterior tuvo autorización independiente y no aplicó migraciones. Los SQL `0008`–`0011` se han verificado en PostgreSQL local con fixtures; no se ha certificado su aplicación remota. Sin las tablas opcionales, los límites son locales a la instancia y la auditoría persistente no está activa. No considerar completa una release operativa hasta resolver estas dependencias y verificar proveedores con destinatarios seguros.

## Cambio de topología pendiente

Provisionar proyectos vacíos para desarrollo y Preview, aplicar el schema revisado exclusivamente en esos proyectos autorizados y crear identidades/datos ficticios. No clonar el censo ni los usuarios de Production. Configurar las referencias públicas de Production permite que las guardas rechacen errores de destino; no facilita sus claves privadas a Preview. Los builds no ejecutan migraciones. Los envíos no productivos solo admiten ediciones de prueba con destinatarios explícitos de prueba. Mientras falte configuración, local/Preview fallan de forma cerrada antes de abrir la conexión de la app.

## Consolidación de la familia compartida

Todos los administradores autorizados comparten una única familia y sus ediciones. `owner_admin_id` conserva el creador histórico, sin limitar permisos. El código no borra familias al desplegarse ni cambia cuentas de Supabase.

La herramienta `scripts/consolidate-family.ts` requiere autorización operativa explícita y tres fases separadas. No usa el migrador ni aplica SQL pendiente. Los identificadores y destinos reales se proporcionan por terminal y nunca se guardan en el repositorio.

1. `--mode backup`: indicar `--keep-family-id`, `--remove-family-ids` (lista separada por comas), `--expected-project-ref`, `--expected-app-origin` y `--recovery-dir`. Comprueba que Auth, Postgres y el origen coinciden con el destino autorizado y que la selección incluye exactamente las familias existentes. Bloquea brevemente escrituras durante la copia, exporta los esquemas `public` y `drizzle` con `pg_dump` y guarda dump y snapshot de datos cifrados con AES-256-GCM. Genera una clave de recuperación independiente, con permisos privados. No modifica filas.
2. `--mode verify --recovery-dir ...`: definir `RESTORE_DATABASE_URL` con una base local vacía terminada en `_test`. Restaura la copia con `pg_restore`, compara todas las filas públicas con el snapshot y marca la copia como verificada. Solo escribe en esa base local. `PG_BIN` permite indicar el directorio de herramientas PostgreSQL compatibles con la versión del servidor.
3. `--mode apply`: repetir exactamente la selección, destino y directorio de la primera fase. Requiere la copia restaurada y comprueba que cuentas y datos familiares no han cambiado desde ella. Borra únicamente las familias descartadas y sus dependencias mediante las claves foráneas existentes, dentro de una transacción. Compara el resultado con el grafo esperado: preserva byte a byte los valores del censo, edición, snapshots, asignaciones, tokens y logs de la familia elegida, además de las cuentas. Ante cualquier diferencia hace rollback. Los contadores y eventos de auditoría independientes no se eliminan.

Ejecutar con `node --import tsx scripts/consolidate-family.ts ...`. No colocar claves, copias ni dumps en carpetas versionadas; `.recovery/` está ignorado por Git. Conservar `database.enc` y `recovery.key` de forma privada hasta acordar su retirada. La copia cubre datos y schema de aplicación; no exporta `auth`, Storage ni credenciales de proveedores. La clave de revelación original sigue siendo necesaria para descifrar enlaces restaurados.

Para recuperación, descifrar la copia en memoria y restaurarla primero en una base local vacía. No restaurar sobre Production sin revisar los cambios posteriores a la copia. Después de consolidar y desplegar, comprobar `/`, `/familia` y las vistas de edición con dos administradores. La comprobación no debe enviar notificaciones, revelar receptores ni regenerar intentos.
