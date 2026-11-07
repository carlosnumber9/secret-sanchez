# Modelo de datos

Drizzle define el esquema operativo en `src/db/schema.ts`. `0003` introdujo ediciones, `0005` añadió bebés, representantes, unidades sorteadas y WhatsApp, y `0006` añadió el orden persistente de las personas dentro de cada unidad.

## Familia maestra

### `families`

Censo permanente propiedad de un administrador. Conserva nombre, slug y personalización; ya no representa un año ni un sorteo.

### `family_islands`

Núcleos u hogares de una familia. Se utilizan para impedir asignaciones dentro de casa. Un cambio de nombre o composición no modifica snapshots históricos.

### `participants`

Personas maestras con núcleo, nombre, contacto opcional, canal por defecto, `is_baby` y `sort_order`. Un adulto puede existir sin email, teléfono ni canal; una edición solo permite elegir canales respaldados por el contacto correspondiente. La condición de bebé se decide solo en `/familia`; obliga a dejar email, teléfono y canal en `null`. `sort_order` conserva la posición manual dentro de su unidad, mientras que el orden de las unidades es solo visual y no se persiste.

Crear una persona inserta una configuración desactivada en todas las ediciones existentes. Borrar una persona es destructivo y elimina completos todos los intentos donde aparece.

## Ediciones

### `draw_editions`

Edición de prueba o definitiva asociada a una familia y año. Se crea en `ready` y puede pasar a `drawn`, `sent` o `archived`. La interfaz muestra estos estados como `En preparación`, `Reparto generado`, `Enviada` y `Archivada`. Solo puede existir una definitiva no archivada por familia y año. El antiguo estado `draft`, heredado del modelo previo a las ediciones, se normaliza a `ready` mediante migración.

### `edition_participants`

Configuración materializada de cada familiar: `enabled`, `can_give`, `can_receive`, snapshot de `is_baby` y canal automático de la edición. Un bebé activo recibe, no regala y no tiene canal.

### `edition_island_configs`

Activa o desactiva una unidad y selecciona su representante adulto. La desactivación prevalece sobre la configuración individual.

### `draw_rules` y `exclusion_rules`

Reglas pertenecientes a una edición. `NO_SAME_ISLAND` y las exclusiones dirigidas se resuelven al generar cada intento.

## Intentos y secretos

### `draws`

Intento numerado dentro de una edición. Solo uno puede estar vigente; los anteriores pueden conservarse como `revoked`, con administrador, fecha y motivo de anulación.

### `draw_participants`

Snapshot inmutable por intento con identidad, contacto, canal, núcleo, roles y condición de bebé.

### `draw_islands`

Snapshot de las unidades habilitadas que pueden regalar a bebés, incluido su representante y los contactos y canales congelados para el intento.

### `assignments`

Relación secreta cuyo regalador es exactamente un `draw_participant` o un `draw_island`. El receptor siempre es un participante. Existe unicidad para regalador personal, unidad regaladora y receptor, además del token cifrado y la primera apertura.

### `notification_logs`

Intentos automáticos de email o WhatsApp. La copia de respaldo no crea un log de notificación: emite un evento seguro en Vercel.

## Conservación e invalidación

- Revocar un reparto conserva intento, snapshots, asignaciones y logs, pero sus tokens dejan de resolver.
- Borrar una persona elimina íntegramente todos los intentos en los que aparece.
- Borrar un núcleo permite mover sus integrantes o borrarlos aplicando la misma cascada.
- Los números de intento no se renumeran.
- Las APIs públicas solo resuelven tokens de intentos no revocados.

## Migraciones

Los SQL y snapshots se versionan en `drizzle/` y nunca se ejecutan durante el build. Local, Preview y Production comparten Supabase: una migración debe contar con backup y validación de conteos antes y después.

La migración `0009_administrative_indexes.sql` añade índices para censo ordenado, historial de ediciones, reglas, referencias de participantes y último intento de notificación. No cambia datos ni contratos. Las consultas de impacto agregan sobre intentos distintos antes de contar asignaciones y logs, evitando multiplicación de filas por edición. Revisar tamaño y duración de creación antes de aplicarla a una base grande.

El registro interno `ATTEMPT_COUNTER` en `draw_rules` conserva `config.lastUsed` aunque se eliminen intentos. No es una regla editable por el organizador ni requiere cambiar el schema. Generación considera tanto ese contador como el máximo conservado y actualiza contador e intento bajo el mismo bloqueo y transacción. Las configuraciones anteriores sin contador se inicializan al siguiente sorteo; no se puede reconstruir un número que ya hubiera sido eliminado antes de incorporar este control.
