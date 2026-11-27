# Observabilidad del servidor

## Estado y alcance

Implementado el 23 de noviembre de 2026: JSON estructurado en stdout/stderr, contexto por petición, identidad verificada, operaciones y etapas del servidor. Incluye SSR, APIs, acciones, repositorios, seguridad, proveedores, auditoría y revelación. No se ha verificado ni cambiado la configuración remota de Vercel.

No incluye telemetría del navegador, OpenTelemetry, Log Drains ni almacenamiento histórico adicional. Los comandos CLI ejecutados localmente no se convierten en Runtime Logs de Vercel. Los registros operativos no sustituyen las tablas de auditoría ni las entregas persistidas.

## Formato y correlación

Cada evento ocupa una línea JSON, con `schemaVersion=1`, `timestamp` UTC, `level`, `event`, `message`, `environment` y `actorType`. `deployment` se añade cuando existe `VERCEL_DEPLOYMENT_ID` válido.

Las peticiones incluyen `requestId`, `route` y `method`. `requestId` se genera en servidor y se devuelve en `X-Request-Id`, incluso en rechazos y errores. No es el identificador nativo de petición de Vercel. Se registra el patrón de ruta del router, sin valores de parámetros, query strings, fragmentos ni URLs completas.

Las operaciones añaden `operation`, `operationId` y, cuando existe, `parentOperationId`. Heredan IDs de entidades y datos operativos explícitos; los trabajos concurrentes reciben contextos separados. Los resultados incluyen `durationMs`, `result` y conteos apropiados. La duración de `request.completed` mide la generación de la respuesta, no su recepción por el navegador ni el consumo completo de un stream.

Los errores técnicos incluyen `errorId`. Un mismo error o una envoltura de su causa reutiliza el identificador durante la petición; el diagnóstico principal se emite una sola vez. La respuesta de error y el resumen de petición permiten localizarlo. Las incidencias de negocio se registran como rechazos con código, sin mensajes arbitrarios.

`errorChain` contiene hasta tres causas: tipo conocido, código permitido y hasta cuatro ubicaciones por causa. Se descartan mensajes, nombres de funciones y rutas absolutas. Se aceptan archivos fuente del catálogo y archivos compilados existentes bajo `dist/server`; sin source maps, la ubicación puede corresponder al bundle. Los códigos desconocidos se omiten. No se imprimen stacks completos.

## Identidad y datos permitidos

| Actor | Identidad disponible |
| --- | --- |
| `unknown` | Aún no verificada, por ejemplo un rechazo previo a consultar la sesión. Incluye `identityReason`. |
| `anonymous` | Petición pública o sesión ausente. No se intenta identificar mediante contactos o IP. |
| `authenticated` | UUID `authUserId` verificado por Supabase, incluido login, logout o cuenta sin permisos administrativos. |
| `admin` | `adminId` y `authUserId` verificados por autenticación y autorización. |
| `reveal_link` | `assignmentId` después de validar el token. Identifica el enlace utilizado, no demuestra quién lo abrió. |
| `provider` | `resend` o `kapso`, únicamente después de verificar firma. |
| `system` | Operación fuera de una petición HTTP; no se inventa un usuario ejecutor. |

Los eventos iniciales conservan la identidad conocida en ese momento; no se reescriben cuando la autenticación termina. En logout, el enriquecimiento de identidad tiene un máximo de 750 ms y no impide cerrar sesión si falla. No se usa como prueba de identidad el usuario guardado sin verificar dentro de una cookie.

Se permiten UUID de entidades, IDs de mensajes con formato conocido de Resend/WhatsApp y Message-ID de Gmail generados por la app (UUID sin contactos), estados, códigos controlados, canales, indicadores, cantidades y nombres permitidos de campos modificados. `changedFields: ["name", "email"]` indica qué campos se enviaron o cambiaron; nunca incluye sus valores. En guardados masivos se usan conteos agregados. Un estado solicitado se distingue del estado efectivamente persistido.

Se excluyen nombres, contactos, IP, contraseñas, claves, cookies, firmas, cabeceras de autenticación, cuerpos, respuestas completas, SQL, parámetros, filas, hashes/ciphertext de revelación, URLs secretas y parejas del sorteo. Los metadatos no pueden sobrescribir identidad, evento, nivel o correlación.

## Niveles y volumen

`LOG_LEVEL` admite `debug`, `info`, `warn` y `error`. Por defecto se usa `info`; un valor no reconocido vuelve a `info`. La variable es solo de servidor y no modifica la política de privacidad.

- `info`: petición, operaciones de negocio, etapas del sorteo, resultados de envíos, auditoría y webhooks.
- `debug`: repositorios, bloqueos, transacciones, limitador y avisos del driver sin contenido privado.
- `warn`: rechazos, conflictos, fallback, rate limits y operaciones lentas.
- `error`: fallos técnicos y resúmenes HTTP `5xx`.

Se avisa cuando una operación medida supera 1.000 ms. Las llamadas a proveedores, los trabajos de entrega y el lote completo no usan ese umbral, porque incluyen espera deliberada o latencia externa; sí registran duración.

Cada evento se limita a 8 KiB. Las colecciones se acotan y, si el tamaño exige recortar campos adicionales, se añade `truncated=true`. El detalle `debug` tiene un presupuesto compartido de 64 eventos por petición; `logging.debug_suppressed` resume el exceso antes de `request.completed`. Los resultados principales y errores no consumen ese presupuesto. Los lotes de entrega actuales procesan hasta cuatro trabajos por petición.

Vercel establece límites de 256 líneas y 1 MB por petición, y 256 KB por salida individual. No deben añadirse logs por cada comparación del algoritmo o por cada fila de un guardado masivo. El presupuesto de debug no puede garantizar por sí solo el límite global si se introducen nuevos bucles de eventos principales.

## Inventario de cobertura

Los guardados masivos añaden `family.draft_changes` con altas, cambios y bajas confirmados. Las eliminaciones de historial añaden `family.history_deleted` con impacto agregado después del commit.

Las operaciones medidas producen sufijos `.started`, `.succeeded`, `.failed` y, cuando corresponda, `.slow`. `.succeeded` significa que la operación terminó; en proveedores debe consultarse `result=accepted|rejected` para conocer el resultado externo.

| Rutas / flujo | Operaciones y eventos | Datos relevantes |
| --- | --- | --- |
| Todas las rutas servidas por Astro, incluidas redirecciones y endpoints legacy `410` | `request.*` | Patrón, método, estado HTTP, duración, correlación e identidad final conocida. |
| Mutaciones antes del handler | `security.origin_rejected`, `security.body_rejected`, `security.rate_limit_*` | Motivo, bucket, límite de cuerpo y tiempo de reintento; nunca sujeto/IP. |
| `/login`, `/api/auth/login`, páginas protegidas y `/api/admin/*` | `auth.session.*`, `auth.admin.*`, `auth.password.*`, `auth.password_login_*`, `auth.authorized`, `auth.access_denied`, `auth.legacy_linked` | Etapa de sesión/administrador, UUID verificado, código y resultado. |
| `/api/auth/logout` | `auth.logout_*`, `auth.identity_unavailable` | Identidad verificada antes de cerrar sesión, fallo no bloqueante del enriquecimiento y resultado. |
| `/`, `/familia`, `/ediciones`, `/api/admin/editions` | `admin.state.*`, `edition.list.*` | Vista, familia, conteos de participantes, núcleos y ediciones. |
| `/api/admin/groups`, `/api/admin/islands`, `/api/admin/participants` | `family.create.*`, `island.create.*`, `participant.create.*` | IDs creados, campos y configuración operativa segura. |
| `/api/admin/families/[id]/name`, `/layout` | `family.rename.*`, `family.draft.*`, `family.layout.*` | Revisión obsoleta o validación por código, IDs, campos y cantidades; no se registra la revisión hash. |
| `/api/admin/islands/[id]`, `/participants/[id]` y `/deletion-impact` | `island.update.*`, `participant.update.*`, `*.deletion_impact.*`, `*.delete.*` | IDs, estrategia de movimiento/cascada, campos e impacto agregado. |
| `/api/admin/editions` y `/[id]` | `edition.create.*`, `edition.update.*` | Familia, edición, tipo, año y estados. |
| `/api/admin/editions/[id]/islands/[islandId]`, `/participants/[participantId]`, `/rules` | `edition.island.*`, `edition.participant.*`, `edition.rules.*` | IDs, representantes, roles, canal, regla de núcleo y cantidad de exclusiones. |
| `/ediciones/[id]`, `/sorteo`, `/envios` | `edition.state.*` | Vista de configuración/sorteo/entregas, sorteo vigente y conteos obtenidos. |
| `/api/admin/editions/[id]/draws/generate` | `draw.generation.*`, `draw.stage` | Bloqueo, validación, configuración, generación de adultos/bebés, snapshots, asignaciones y auditoría; intento, reglas y cantidades. |
| `/api/admin/editions/[id]/draws/[drawId]/revoke` | `draw.revocation.*` | Edición, sorteo y estado anterior/nuevo; sin motivo libre escrito por el usuario. |
| `/api/admin/editions/[id]/notifications/send` | `notification.batch.*`, `notification.delivery.*`, `notification.attempt`, `notification.job`, `notification.persisted` | `batchId`, cursor, modo, selección, canal, asignación, intento, omisión, aceptación, persistencia y resumen. |
| Gmail SMTP / Kapso salientes | `provider.email.*`, `provider.whatsapp.*`, `provider.result` | Proveedor (`gmail`/`kapso`), HTTP o `smtpStatus`/`smtpCommand` disponibles, duración, rechazo, límite temporal, resultado incierto e ID del mensaje. |
| `/api/webhooks/resend`, `/api/webhooks/kapso` | `*.webhook_rejected`, `*.webhook_ignored`, `*.delivery_updated` | Firma/configuración/JSON, evento no soportado, mensaje desconocido, transición aplicada o ignorada y reintento. |
| `/api/admin/notifications/manual` | `notification.manual.*`, `assignment_link_copied` | Administrador, edición, sorteo y asignación; preparación/descifrado del respaldo. No afirma que el navegador haya terminado de copiar. |
| `/r`, `/api/reveal/resolve`, `/open` | `reveal.resolve_*`, `reveal.resolved`, `reveal.open_*`, `reveal.opened`, `reveal.reopened` | Resolución, primera apertura/reapertura, enlace inválido y asignación validada; sin receptor. |
| `/api/health` | `health.succeeded`, `health.failed` | Etapa de configuración/base, duración y errorId. |
| Persistencia interna | `db.*`, `transaction.*`, `audit.*`, `db.capability_checked` | Nombres estables de repositorios/bloqueos, tiempos, cantidades, disponibilidad de tablas opcionales y commit/fallo. |

Los eventos de éxito de operaciones dentro de una transacción y la auditoría persistida se emiten solo después del commit. `draw.stage` indica progreso provisional con `transactionPending=true`. `transactionStage` distingue el trabajo del callback y la confirmación del commit; `stage` conserva la etapa de negocio que falló. Una interrupción de red durante commit puede dejar resultado desconocido: el log no prueba por sí solo el estado final de Postgres.

Las reservas de notificación distinguen contacto suprimido, cooldown, lease activa, recuperación, deduplicación, inelegibilidad y nueva reserva. La aceptación de un proveedor no equivale a entrega. Gmail no confirma entrega por webhook; se revisan Enviados y devoluciones en su buzón. En Kapso y en el histórico de Resend se correlaciona con los webhooks posteriores mediante `providerMessageId`, `notificationId` y `assignmentId`. Los callbacks duplicados o desactualizados se registran como `ignored/unchanged`, sin degradar estados.

`batchId` es el UUID validado de idempotencia del envío. Agrupa peticiones con cursores del mismo lote; no se registra la clave compuesta interna ni se envía el identificador de petición a proveedores.

## Investigación en Vercel

Abrir el proyecto, seleccionar Logs y acotar entorno, despliegue, ruta, estado y tiempo. Buscar por texto dentro del mensaje JSON. Los campos propios no se consideran automáticamente filtros nativos de Vercel. El filtro de navegador de Vercel usa IP/User-Agent y no sustituye la identidad de la aplicación.

Ejemplos exclusivamente sintéticos:

| Investigación | Búsqueda / recorrido |
| --- | --- |
| Petición comunicada por usuario | Copiar `X-Request-Id`, buscar su UUID y revisar `request.completed`, operación y diagnóstico. |
| Actividad de administrador | Buscar el UUID de `adminId` o `authUserId`; filtrar Production y periodo. Los eventos previos a verificar identidad se localizan por `requestId`. |
| Preparación de edición | Buscar UUID de `editionId`; seguir `edition.*`, `draw.stage` y resultado después del commit. |
| Envío incompleto | Buscar UUID de `batchId`; comparar `sent`, `failed`, `unknown`, `skipped`, `nextCursor` y `retryAfterSeconds`. |
| Entrega individual | Buscar `assignmentId`, después `notificationId` y `providerMessageId`; distinguir aceptación, persistencia y callback. |
| Error mostrado al usuario | Buscar UUID de `errorId`; revisar etapa, tipo/código, causas y ubicación del diagnóstico principal. |

No buscar ni pegar tokens, cookies o enlaces secretos. Para consultas por CLI, usar `vercel logs --query '<UUID-sintético>' --since 1h`; la ventana disponible sigue dependiendo del plan. No confundir `--request-id`, que filtra el identificador nativo, con el `requestId` propio del JSON.

## Conservación y límites de evidencia

Según la documentación consultada el 23 de noviembre de 2026:

| Plan de Vercel | Retención de Runtime Logs |
| --- | --- |
| Hobby | 1 hora |
| Pro | 1 día |
| Enterprise | 3 días |
| Pro / Enterprise con Observability Plus | 30 días |

Observability Plus permite consultar hasta 14 días consecutivos dentro de esa ventana de 30 días. No se ha comprobado el plan remoto del proyecto. Una vez vencida su retención no habrá histórico recuperable con esta implementación.

Los logs son evidencia operativa, no una garantía de trazabilidad absoluta. Los rechazos de formularios del control de origen interno de Astro se producen antes del middleware de aplicación y no tienen `X-Request-Id` propio. Fallos de inicialización anteriores al middleware, terminaciones abruptas/timeouts, errores de streaming posteriores a generar la respuesta y peticiones bloqueadas por infraestructura dependen también de los registros nativos de Vercel. Los assets estáticos servidos por CDN no ejecutan el logger de aplicación.

## Validación y verificación en Preview

Las pruebas automatizadas cubren aislamiento concurrente, estados HTTP y cabeceras, deduplicación de errores, commit/rollback, omisiones e idempotencia, proveedores simulados, webhooks firmados, identidad de logout y exclusión de secretos sintéticos. El smoke SSR comprueba el handler compilado. Las pruebas de integración usan exclusivamente PostgreSQL local `_test` y transportes controlados.

Verificación manual pendiente en Vercel Preview, usando una edición de prueba y destinatarios seguros:

1. Mantener `LOG_LEVEL=info`. Abrir historial/familia, configurar edición, generar sorteo y consultar entregas.
2. Confirmar que el JSON aparece en Runtime Logs y que `X-Request-Id` permite encontrar la petición.
3. Verificar `adminId/authUserId` en acciones protegidas y `actorType=reveal_link` únicamente después de validar el enlace.
4. Enviar un lote autorizado de prueba y seguir los mensajes por ID hasta sus callbacks; revisar omisiones y rate limits sin reenviar automáticamente resultados inciertos.
5. Comprobar una validación fallida y buscar su petición/código; revisar que ningún registro contiene contactos, contenido revelado, secretos ni payloads.
6. Activar temporalmente `LOG_LEVEL=debug` en Preview si hace falta inspeccionar repositorios/bloqueos; volver a `info` después.

## Mantenimiento y fuentes

Al añadir un flujo, registrar un nombre estable en `src/lib/log-contract.ts`, instrumentar el límite de negocio y actualizar este inventario. Los campos se validan en `src/lib/logger.ts`; los nuevos códigos y archivos fuente deben añadirse a sus catálogos. No introducir `console.*` directos en módulos de aplicación ni activar el logger SQL de Drizzle.

- [Vercel: logs estructurados](https://vercel.com/kb/guide/add-structured-application-logs-to-vercel-functions).
- [Vercel: Runtime Logs, búsqueda y límites](https://vercel.com/docs/logs/runtime).
- [Vercel: CLI logs](https://vercel.com/docs/cli/logs).
- [OWASP: Logging Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html).
- [Node.js 22: AsyncLocalStorage](https://nodejs.org/docs/latest-v22.x/api/async_context.html).
