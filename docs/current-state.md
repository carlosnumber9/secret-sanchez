# Estado actual

Última revisión documental: **4 de agosto de 2026**.

## Implementado en código

- Familia maestra separada de las ediciones.
- Configuración por edición de núcleos, participación y roles de regalo/recepción.
- Altas familiares desactivadas automáticamente en ediciones existentes.
- Ediciones de prueba ilimitadas y una definitiva por familia y año.
- Intentos numerados, snapshots inmutables, revocación e invalidación de tokens.
- Emails de prueba redirigidos al administrador.
- Previsualización y confirmación del borrado destructivo.
- Borrado transaccional de intentos completos cuando desaparece un participante.
- Movimiento o cascada al borrar núcleos.
- Auth, tokens cifrados, entrega manual, Resend y observabilidad existentes.

## Pendiente de operación

- `drizzle/0003_editions.sql` está preparado pero no aplicado. Requiere backup y revisión manual porque todos los entornos comparten la base real.
- Resend requiere dominio y clave válidos.
- WhatsApp continúa deshabilitado.
- No hay CI ni base aislada para pruebas de integración.

## Riesgos

- El borrado desde `/familia` es irreversible y puede eliminar repartos, tokens y logs completos.
- Revocar invalida enlaces, pero no deshace información ya vista.
- Local, Preview y Production siguen compartiendo Supabase.
