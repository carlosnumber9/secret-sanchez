# Estado actual

Última revisión documental: **4 de agosto de 2026**.

## Implementado en código

- Familia maestra separada de las ediciones y snapshots inmutables por intento.
- Bebés definidos en `/familia`, sin contacto propio, receptores y nunca regaladores.
- Configuración por edición de participación, roles, email, WhatsApp y representante por unidad.
- Igualdad entre adultos que regalan y adultos que reciben.
- Reparto personal entre adultos y reparto adicional de bebés a unidades distintas de la propia, sin repetir unidad.
- Intentos numerados, revocación e invalidación de tokens.
- Envíos por Resend y Kapso, uno o ambos canales, con selección y reenvío explícito.
- Webhook firmado de Kapso para `sent`, `delivered`, `read` y `failed`.
- Ediciones de prueba redirigidas a contactos seguros de administrador.
- Copia de respaldo sin estado de entrega y auditoría estructurada en Vercel.
- Borrado transaccional y conservación de snapshots históricos mientras no se elimine el intento.

## Pendiente de operación

- `drizzle/0005_past_winter_soldier.sql` está aplicada en el Supabase compartido desde el 4 de agosto de 2026.
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
