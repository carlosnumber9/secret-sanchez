# Notificaciones

## Canales automáticos

Cada entrega usa `email`, `whatsapp` o `both`, configurado en la edición. `manual` se conserva únicamente como valor legacy del enum y no se ofrece ni se genera.

- Una asignación personal usa el contacto congelado del adulto regalador.
- Una asignación de bebé usa el contacto congelado del representante de la unidad.
- Un bebé no tiene contacto ni canal propio.
- Una edición de prueba redirige email al administrador y WhatsApp a `KAPSO_TEST_RECIPIENT_PHONE`.

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

## Copia de respaldo

El icono de copia obtiene el enlace bajo autorización para que Juan lo comparta si el envío falla o se lo solicitan. No es un canal, no crea `notification_logs` y no cambia el estado de entrega.

La operación emite `assignment_link_copied` en Vercel con identificadores de administrador, edición, intento, asignación y regalador. Nunca registra token, URL, receptor, email ni teléfono.

## Privacidad

`notification_logs` conserva el destinatario necesario para operar el proveedor. Los Runtime Logs sanean datos personales, secretos y URLs. `assignments.opened_at` representa la apertura del enlace y es independiente del estado `read` de WhatsApp.
