# Release y recuperación

Revisado el 7 de noviembre de 2026. Este documento describe acciones para el operador; no autoriza su ejecución sobre servicios reales. Esta actualización se limita a código, sin copias ni migraciones de Supabase compartido.

## Evidencia local

- Unitarias, integración PostgreSQL, build SSR y comparación de schema/snapshots.
- `test:ssr`: ejecuta el handler compilado con Auth sintético y conexión local; comprueba login, revelación, hashes de scripts inline en CSP, privacidad, acceso sin sesión, origen ajeno y cuerpo excesivo.
- `test:recovery`: crea dos bases locales vacías con nombres aleatorios terminados en `_test`, migra una, inserta exclusivamente fixtures y restaura en la otra. Compara las 16 tablas y journal, descifra tokens con una clave sintética y comprueba RLS. La copia de fixtures y su cifrado AES-256-GCM permanecen en memoria; no se escriben archivos ni claves. Ambas bases se eliminan al finalizar.
- El simulacro no exporta la base indicada en `TEST_DATABASE_URL`: solo la usa para crear las bases efímeras. No carga `.env` y rechaza hosts externos.

```bash
# PostgreSQL local dedicado; requiere permiso de crear bases y roles.
export TEST_DATABASE_URL='postgresql://postgres@127.0.0.1:5432/secret_sanchez_test'
npm run test:integration
npm run build
npm run test:ssr
# pg_dump y pg_restore deben ser compatibles con el servidor (verificado con 17).
# Si no están en PATH, exportar PG_BIN con su directorio.
npm run test:recovery
```

Estos comandos no certifican backups de Supabase, recuperación de Auth, configuración de Vercel ni entregas reales. RPO y RTO de producción siguen pendientes de acuerdo y de una prueba autorizada; la duración local no es una estimación válida de recuperación real.

## Preparación de una release operativa futura

1. Registrar SHA, despliegue anterior conocido, proyecto de destino, responsable y ventana. Seleccionar explícitamente Production o el proyecto independiente de Preview. No copiar claves productivas a Preview.
2. Revisar SQL pendiente contra el journal real. No reejecutar `0000` sobre tablas existentes ni insertar marcas de migración para silenciar divergencias. Resolver primero cualquier baseline incierta con el propietario.
3. Obtener autorización independiente para backup/restauración y migración, con alcance, custodio y destino definidos. La instrucción actual sigue siendo «solo código».
4. Verificar la disponibilidad y retención del backup del proveedor, incluida recuperación a un proyecto aislado. Conservar aparte las claves de cifrado de los enlaces y configuración externa; restaurar tablas no restaura secretos de despliegue.
5. En una restauración autorizada, comparar conteos e invariantes, journal, índices, restricciones, RLS y acceso del rol servidor. Comprobar Auth y UUID administrativos; mantener desactivados envíos y webhooks hasta reconciliar estados.
6. Solo después aplicar una vez el SQL aprobado con el contexto correcto y `npm run db:migrate`. Nunca migrar en el build ni usar `db:push` como procedimiento de producción.
7. Desplegar y comprobar health, login/logout y acceso no autorizado. Probar una edición de prueba con destinatarios seguros antes de habilitar envíos definitivos.

La [documentación de backups de Supabase](https://supabase.com/docs/guides/platform/backups) describe disponibilidad y recuperación según plan. [Restaurar a otro proyecto](https://supabase.com/docs/guides/platform/clone-project) requiere revisar aparte archivos Storage, funciones, ajustes de Auth y claves API: no asumir que una restauración de base replica toda la configuración. No se ha consultado ni cambiado el plan contratado del proyecto.

## SQL preparado por esta actualización

| Migración | Efecto | Comprobación del operador |
| --- | --- | --- |
| `0008` | RLS y revocación de grants públicos | El rol servidor conserva acceso y anon/authenticated no leen tablas. |
| `0009` | Índices administrativos | Revisar duración, bloqueo y espacio según tamaño real. |
| `0010` | Contadores compartidos de peticiones | Tabla presente, RLS y límite compartido entre instancias. |
| `0011` | Eventos administrativos persistentes | Eventos nuevos se guardan; definir retención y acceso operativo. |

Sin `0010`, el límite es por memoria de instancia. Sin `0011`, la auditoría persistente no existe y copias históricas se muestran desconocidas. Estas opciones no cambian el censo ni crean tablas automáticamente. No se han aplicado aquí; las migraciones antiguas también deben reconciliarse antes de operar.

## Rollback del código

1. Detener nuevos envíos mientras se evalúa el incidente. Conservar IDs y estados del proveedor sin copiar enlaces ni destinatarios a logs.
2. Elegir el despliegue anterior conocido en Vercel y verificar su compatibilidad con el schema y variables actuales antes de promoverlo. [Instant Rollback](https://vercel.com/docs/instant-rollback) restaura un despliegue; en esta app las migraciones son manuales y no se revierten al cambiar código.
3. Conservar tablas, índices, auditoría y contadores aditivos. No deshabilitar RLS ni devolver grants públicos para recuperar una versión.
4. Los campos y enums eliminados requieren una migración de reparación revisada o restauración autorizada; no hay comandos `down` automáticos. Un despliegue anterior a `0007` puede ser incompatible con estados normalizados.
5. Volver a comprobar acceso, enlace controlado y destinatarios de prueba. No reenviar automáticamente mensajes ya aceptados o de resultado incierto.

Si se restaura una base a un punto anterior, mensajes ya entregados siguen existiendo fuera de la app y enlaces revocados podrían volver a estar vigentes. Reconciliar esos intentos antes de reabrir revelaciones o envíos. Nunca derivar tokens desde hashes; sin ciphertext y clave original debe revocarse y regenerarse bajo decisión explícita.

## Activación de proveedores pendiente

- Supabase: Email/Password, signup deshabilitado, usuarios autorizados, RLS/grants efectivos y recuperación comprobada.
- Resend: dominio, SPF/DKIM, remitente y webhook `/api/webhooks/resend`; secreto independiente y eventos de entrega/fallo. No activar aperturas ni clics por defecto.
- Kapso: credenciales, número, idioma, plantilla aprobada y webhook `/api/webhooks/kapso` con firma.
- Vercel: runtime Node 22, `npm ci`, contextos separados y `APP_URL` del entorno. No descargar variables descifradas para documentar el inventario.

Registrar el resultado sin credenciales ni contactos. La evidencia local no sustituye esta verificación de servicios reales.
