# Notificaciones

## Canales automáticos

Cada entrega usa `email`, `whatsapp` o `both`, configurado en la edición. `manual` se conserva únicamente como valor legacy del enum y no se ofrece ni se genera.

- Una asignación personal usa el contacto congelado del adulto regalador.
- Una asignación de bebé usa el contacto congelado del representante de la unidad.
- Un bebé no tiene contacto ni canal propio.
- Una edición de prueba redirige el email al correo de acceso del administrador que ejecuta el envío y WhatsApp a `KAPSO_TEST_RECIPIENT_PHONE`.

## Email y WhatsApp

Gmail entrega email mediante SMTP (`smtp.gmail.com:465`, TLS) con `GMAIL_USER` y `GMAIL_APP_PASSWORD`. Nodemailer conecta, autentica y completa el envío antes de responder. El remitente usa la cuenta configurada con nombre visible «Secret Sánchez»; no se necesita dominio propio. Kapso recibe una plantilla aprobada con dos parámetros posicionales: nombre del destinatario y URL de revelación. El proveedor debe configurarse con `KAPSO_API_KEY`, `KAPSO_PHONE_NUMBER_ID`, `KAPSO_TEMPLATE_NAME` y `KAPSO_TEMPLATE_LANGUAGE`.

El webhook `/api/webhooks/kapso` verifica `X-Webhook-Signature` con HMAC SHA-256 sobre el body crudo. Actualiza `sent`, `delivered`, `read` y `failed` por `provider_message_id`. Los estados son monotónicos: un fallo tardío no degrada `delivered` o `read`, mientras una entrega posterior puede recuperar un fallo.

## Plantilla de email integrada

`emails/reveal-resend.html` y `emails/reveal-resend.txt` son las plantillas activas de Gmail. Conservan su nombre histórico, pero no requieren Resend ni un ID de plantilla. El adapter de Vercel incluye ambos archivos en la función; `renderEmail` los carga, escapa las variables HTML y conserva el enlace completo con su fragmento.

Las variables son `PARTICIPANT_NAME` (regalador o representante, nunca receptor), `REVEAL_URL` y `DELIVERY_NOTE`. Las pruebas añaden `[PRUEBA]` al asunto y al texto y muestran un aviso visible de redirección al administrador. La plantilla conserva crema, rojo, dorado y el icono público de la app, con versión de texto y enlace alternativo al botón. No incluye píxeles ni redirecciones de seguimiento.

## Lotes, reenvíos y estado global

- Cada petición deriva una clave idempotente por asignación y canal.
- `pending` procesa intentos nuevos o pendientes.
- `failed` reintenta fallos.
- `force` crea un reenvío explícito para la selección del administrador.
- Una asignación queda cubierta si al menos un canal automático alcanza `sent`, `delivered` o `read`.
- La edición pasa a `sent` solo cuando todas las asignaciones están cubiertas.

Los fallos de un segundo canal siguen visibles aunque otro haya cubierto la asignación.

El envío comprueba la vigencia antes de cada mensaje y la transición final a `sent` es condicional. Una revocación concurrente nunca se deshace al terminar un lote. Un mensaje que el proveedor ya esté procesando puede llegar después de revocar, pero su enlace permanece invalidado.

## Copia de respaldo

El icono de copia obtiene el enlace bajo autorización para que Juan lo comparta si el envío falla o se lo solicitan. No es un canal, no crea `notification_logs` y no cambia el estado de entrega.

La operación registra `assignment.link_copied` si existe `audit_events` y emite `assignment_link_copied` en Vercel con identificadores de administrador, edición, intento, asignación y regalador. Nunca registra token, URL, receptor, email ni teléfono.

## Privacidad

`notification_logs` conserva el destinatario necesario para operar el proveedor. Los Runtime Logs omiten mensajes arbitrarios de error y filtran campos sensibles. `assignments.opened_at` representa la apertura del enlace y es independiente del estado `read` de WhatsApp.

## Idempotencia y resultados inciertos

La reserva de intentos se serializa por asignación dentro de una transacción. Las peticiones repetidas conservan su clave en la interfaz y la base impide reservar dos veces la misma operación. Esta deduplicación es local: SMTP no ofrece la clave de idempotencia de Resend.

Los intentos pendientes recientes se omiten durante 60 segundos. Después, un resultado incierto sigue bloqueado para `pending`, `failed` y la misma clave, incluso si es antiguo. El panel lo presenta como «Resultado incierto». Tras revisar el estado en el proveedor, `force` sobre una selección explícita con una clave nueva permite un nuevo intento y advierte del posible duplicado. No se afirma que un timeout o una desconexión equivalgan a rechazo.

Un rechazo SMTP explícito `4xx` conserva el intento pendiente con una espera de 60 segundos y permite recuperarlo al vencerla, porque el servidor no aceptó ese mensaje. Un `5xx` lo deja fallido. El envío Gmail se cancela a los 20 segundos con `AbortSignal`, cerrando la conexión; ambos transportes esperan su resultado antes de responder. No se reintentan automáticamente mensajes con resultado desconocido.

## Concurrencia del webhook

Las transiciones de estado son condicionales en SQL; eventos duplicados o concurrentes no degradan `delivered` o `read`. Si llega un evento antes de guardar el identificador del proveedor, el endpoint devuelve `503` y `Retry-After` para activar los reintentos de Kapso. Los fallos persistentes deben reconciliarse desde el panel del proveedor. Un JSON firmado inválido devuelve `400`.

El panel y la cobertura consultan el último intento por asignación y canal mediante `DISTINCT ON`, con desempate estable por identificador. Un fallo reciente no se oculta detrás de un envío histórico exitoso. Los contadores de exposición se agregan en SQL y el panel no carga ciphertexts ni hashes para mostrar los estados.

## Lotes reanudables

Cada petición procesa como máximo cuatro mensajes con concurrencia dos y separación mínima de 550 ms entre inicios. El panel continúa mediante un cursor estable y conserva la clave del lote si falla la conexión; no hay trabajo crítico desligado de la respuesta. Los límites HTTP de WhatsApp y los rechazos SMTP temporales conservan el intento pendiente y el mismo cursor, con espera entre 1 y 60 segundos. El panel hace hasta tres esperas automáticas antes de ofrecer reintento. Los resultados inciertos se muestran separados de los rechazos confirmados. El adapter permite 60 segundos por función; cada transporte tiene timeout de 20 segundos.

## Estados de email

Para Gmail, `sent` significa aceptación SMTP; no confirma entrega al buzón ni lectura del correo. `assignments.opened_at` sigue registrando la apertura de la revelación en la app. La cuenta remitente recibe los avisos de devolución que correspondan, sin sincronización automática al panel.

### Compatibilidad histórica de Resend

`POST /api/webhooks/resend` verifica el cuerpo original y los headers `svix-*` con el SDK de Resend y `RESEND_WEBHOOK_SECRET`. La firma y su ventana temporal se validan antes de interpretar el evento. Sin secreto responde `503`; firma inválida, `401`. Un ID aún desconocido devuelve `503` para reintento. Los eventos repetidos son idempotentes y los eventos atrasados no degradan una entrega confirmada.

Se procesan `email.sent`, `email.delivered`, `email.delivery_delayed`, `email.failed`, `email.bounced`, `email.complained` y `email.suppressed`. Los tres últimos quedan como fallo terminal del intento y bloquean reenvíos al mismo destinatario en esa asignación, incluso con `force`. Debe corregirse el contacto y regenerarse el reparto o usarse un canal alternativo. Un retraso conserva `sent` con código de diagnóstico; el proveedor sigue intentando la entrega. No se guardan direcciones ni motivos libres procedentes del webhook, ni se procesan aperturas o clics de email.

`sent` en reparto/edición conserva el hito histórico de aceptación de todos los mensajes. Un rebote posterior aparece en la cobertura actual y en el panel, sin cambiar ese hito ni reactivar un reparto anulado. El endpoint y secreto se conservan para el histórico; no se necesitan para los nuevos envíos Gmail. Referencias: [verificación oficial](https://resend.com/docs/webhooks/verify-webhooks-requests) y [eventos oficiales](https://resend.com/docs/webhooks/event-types).

### Refresco del panel

Al terminar un envío o una operación parcialmente fallida, el panel consulta `GET /api/admin/editions/[id]/deliveries` y actualiza las filas con el estado persistido. No recarga la página. El resumen se conserva y «Actualizar estados» permite consultar cambios posteriores de webhooks y aperturas. Un fallo de lectura se muestra por separado del resultado del envío y su reintento no repite el POST ni genera una nueva clave de idempotencia.
