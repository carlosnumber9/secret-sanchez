# Notificaciones

## Canales automáticos

Cada entrega usa `email`, `whatsapp` o `both`, configurado en la edición. `manual` se conserva únicamente como valor legacy del enum y no se ofrece ni se genera.

- Una asignación personal usa el contacto congelado del adulto regalador.
- Una asignación de bebé usa el contacto congelado del representante de la unidad.
- Un bebé no tiene contacto ni canal propio.
- Una edición de prueba redirige el email al correo de acceso del administrador que ejecuta el envío y WhatsApp a `KAPSO_TEST_RECIPIENT_PHONE`.

## Email y WhatsApp

Resend entrega email. Kapso recibe una plantilla aprobada con dos parámetros posicionales: nombre del destinatario y URL de revelación. El proveedor debe configurarse con `KAPSO_API_KEY`, `KAPSO_PHONE_NUMBER_ID`, `KAPSO_TEMPLATE_NAME` y `KAPSO_TEMPLATE_LANGUAGE`.

El webhook `/api/webhooks/kapso` verifica `X-Webhook-Signature` con HMAC SHA-256 sobre el body crudo. Actualiza `sent`, `delivered`, `read` y `failed` por `provider_message_id`. Los estados son monotónicos: un fallo tardío no degrada `delivered` o `read`, mientras una entrega posterior puede recuperar un fallo.

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

La operación emite `assignment_link_copied` en Vercel con identificadores de administrador, edición, intento, asignación y regalador. Nunca registra token, URL, receptor, email ni teléfono.

## Privacidad

`notification_logs` conserva el destinatario necesario para operar el proveedor. Los Runtime Logs sanean datos personales, secretos y URLs. `assignments.opened_at` representa la apertura del enlace y es independiente del estado `read` de WhatsApp.

## Idempotencia y resultados inciertos

La reserva de intentos se serializa por asignación dentro de una transacción. Las peticiones repetidas conservan la clave en la interfaz y la misma clave se envía a Resend. Los intentos pendientes recientes se omiten durante 60 segundos. Los emails pendientes se pueden recuperar con la clave original durante 23 horas, dentro de la ventana de deduplicación del proveedor. Un timeout o un fallo de transporte conserva `pending` con `outcome_unknown`; no se afirma que el proveedor rechazara el mensaje. WhatsApp y los emails fuera de esa ventana necesitan comprobación en proveedor y reenvío explícito seleccionado; no se reintentan automáticamente porque podrían duplicarse. Ambos transportes tienen un timeout de 20 segundos.

## Concurrencia del webhook

Las transiciones de estado son condicionales en SQL; eventos duplicados o concurrentes no degradan `delivered` o `read`. Si llega un evento antes de guardar el identificador del proveedor, el endpoint devuelve `503` y `Retry-After` para activar los reintentos de Kapso. Los fallos persistentes deben reconciliarse desde el panel del proveedor. Un JSON firmado inválido devuelve `400`.
