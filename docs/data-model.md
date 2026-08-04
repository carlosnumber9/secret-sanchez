# Modelo de datos

Drizzle define el esquema operativo en `src/db/schema.ts`. La migración `0003_editions.sql` transforma el modelo anterior, pero debe revisarse y respaldarse Supabase antes de ejecutarla.

## Familia maestra

### `families`

Censo permanente propiedad de un administrador. Conserva nombre, slug y personalización; ya no representa un año ni un sorteo.

### `family_islands`

Núcleos u hogares de una familia. Se utilizan para impedir asignaciones dentro de casa. Un cambio de nombre o composición no modifica snapshots históricos.

### `participants`

Personas maestras con núcleo, nombre, contacto y canal preferido. La participación y los roles no viven aquí.

Crear una persona inserta una configuración desactivada en todas las ediciones existentes. Borrar una persona es destructivo y elimina completos todos los intentos donde aparece.

## Ediciones

### `draw_editions`

Edición de prueba o definitiva asociada a una familia y año. Puede estar `draft`, `ready`, `drawn`, `sent` o `archived`. Solo puede existir una definitiva no archivada por familia y año.

### `edition_participants`

Configuración materializada de cada familiar dentro de la edición: `enabled`, `can_give` y `can_receive`. Las altas posteriores se incorporan desactivadas.

### `edition_island_configs`

Activa o desactiva un núcleo completo. La desactivación del núcleo prevalece sobre la configuración individual sin borrarla.

### `draw_rules` y `exclusion_rules`

Reglas pertenecientes a una edición. `NO_SAME_ISLAND` y las exclusiones dirigidas se resuelven al generar cada intento.

## Intentos y secretos

### `draws`

Intento numerado dentro de una edición. Solo uno puede estar vigente; los anteriores pueden conservarse como `revoked`, con administrador, fecha y motivo de anulación.

### `draw_participants`

Snapshot inmutable por intento con identidad, contacto, canal, núcleo y roles efectivos. Permite conservar la historia aunque cambie el censo.

### `assignments`

Relación secreta entre snapshots de quien regala y recibe. Tiene unicidad por sorteo para ambos lados, hash único del token, ciphertext AES-256-GCM y primera apertura.

### `notification_logs`

Intentos de email o entrega manual ligados a asignaciones. Revocar conserva estos logs; el borrado destructivo desde `/familia` los elimina al borrar el intento completo.

## Conservación e invalidación

- Revocar un reparto conserva intento, snapshots, asignaciones y logs, pero sus tokens dejan de resolver.
- Borrar una persona elimina íntegramente todos los intentos en los que aparece.
- Borrar un núcleo permite mover sus integrantes o borrarlos aplicando la misma cascada.
- Los números de intento no se renumeran.
- Las APIs públicas solo resuelven tokens de intentos no revocados.

## Migraciones

Los SQL y snapshots se versionan en `drizzle/` y nunca se ejecutan durante el build. Local, Preview y Production comparten Supabase: una migración debe contar con backup y validación de conteos antes y después.
