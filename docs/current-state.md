# Estado actual

Última revisión documental: **5 de agosto de 2026**.

## Implementado en código

- Ediciones como página principal en `/`, con alta mediante un diálogo sobre el historial y una navegación administrativa reducida a Ediciones y Familia; las rutas generales anteriores redirigen al listado.
- Familia maestra separada de las ediciones y snapshots inmutables por intento.
- Edición de la familia mediante un borrador local: altas desde diálogos, cambios, borrados, unidad y orden de participantes se guardan juntos de forma transaccional; el navegador avisa antes de abandonar cambios pendientes y el orden visual de unidades no se persiste. Las unidades completas y las personas se pueden reordenar con dnd-kit mediante ratón, touch o teclado, y una persona puede moverse entre unidades, incluidas las vacías.
- Contactos opcionales editables directamente en las filas de `/familia`; las ediciones deshabilitan y rechazan canales sin email o teléfono compatible.
- Bebés definidos en `/familia`, sin contacto propio, receptores y nunca regaladores.
- Configuración por edición de participación, roles, email, WhatsApp y representante por unidad.
- Estados de edición limitados a preparación, reparto generado, enviada y archivada, con etiquetas en español; el estado legacy `draft` se normaliza a `ready` mediante migración.
- Igualdad entre adultos que regalan y adultos que reciben.
- Reparto personal entre adultos y reparto adicional de bebés a unidades distintas de la propia, sin repetir unidad.
- Intentos numerados, revocación e invalidación de tokens.
- Envíos por Resend y Kapso, uno o ambos canales, con selección y reenvío explícito.
- Webhook firmado de Kapso para `sent`, `delivered`, `read` y `failed`.
- Ediciones de prueba con emails redirigidos al correo de acceso del administrador que ejecuta el envío y WhatsApp al teléfono seguro configurado.
- Copia de respaldo sin estado de entrega y auditoría estructurada en Vercel.
- Borrado transaccional y conservación de snapshots históricos mientras no se elimine el intento.

## Pendiente de operación

- `drizzle/0005_past_winter_soldier.sql` está aplicada en el Supabase compartido desde el 4 de agosto de 2026.
- `drizzle/0006_soft_kylun.sql` está aplicada en el Supabase compartido desde el 5 de agosto de 2026; añadió y rellenó `participants.sort_order`.
- Aplicar `drizzle/0007_flat_dragon_man.sql`, que normaliza las ediciones legacy en `draft` a `ready` y elimina ese estado obsoleto del enum, antes de desplegar el código dependiente.
- Configurar y aprobar la plantilla de Kapso y registrar el webhook de Production.
- Configurar todas las variables `KAPSO_*` en Vercel; sin ellas WhatsApp falla de forma controlada.
- Verificar dominio y remitente de Resend.
- Ejecutar una edición de prueba completa antes del sorteo familiar definitivo.
- No hay CI ni base aislada para pruebas de integración.

## Riesgos

- Local, Preview y Production comparten Supabase.
- Revocar invalida enlaces, pero no deshace información ya vista.
- Juan puede obtener cualquier enlace desde el panel de envíos; la acción se audita sin guardar el secreto.
- Los Runtime Logs de Vercel tienen retención operativa, no sustituyen un registro de auditoría persistente.
