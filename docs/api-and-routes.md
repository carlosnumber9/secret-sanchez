# API y rutas

## Páginas

| Ruta | Acceso | Comportamiento |
| --- | --- | --- |
| `/` | Administrador | Historial y alta de ediciones; es la página principal. |
| `/familia` | Administrador | Censo permanente, movimientos y borrado destructivo. |
| `/ediciones/[id]` | Administrador | Configuración, intentos y revocación. |
| `/ediciones/[id]/sorteo` | Administrador | Generación del intento vigente. |
| `/ediciones/[id]/envios` | Administrador | Entregas del intento vigente. |
| `/r#token` | Público con token | Revelación de un token vigente. |

`/inicio`, `/ediciones`, `/sorteo` y `/envios` redirigen a `/`. Los dos últimos evitan elegir implícitamente un sorteo.

## APIs administrativas

- Familia: `POST /api/admin/groups`, `POST /api/admin/islands`, `PATCH|DELETE /api/admin/islands/[id]`, `POST /api/admin/participants`, `PATCH|DELETE /api/admin/participants/[id]`, `PATCH /api/admin/families/[id]/layout` y `PATCH /api/admin/families/[id]/name`.
- Impacto destructivo: `GET /api/admin/participants/[id]/deletion-impact` y `GET /api/admin/islands/[id]/deletion-impact`.
- Ediciones: `GET|POST /api/admin/editions`, `PATCH /api/admin/editions/[id]`.
- Reglas: `PUT /api/admin/editions/[id]/rules`, con `noSameIsland` y hasta 500 pares dirigidos `exclusions`.
- Configuración: `PATCH /api/admin/editions/[id]/islands/[islandId]` y `PATCH /api/admin/editions/[id]/participants/[participantId]`.
- Intentos: `POST /api/admin/editions/[id]/draws/generate` y `POST /api/admin/editions/[id]/draws/[drawId]/revoke`.
- Entrega: `POST /api/admin/editions/[id]/notifications/send` y `POST /api/admin/notifications/manual`.

Todas requieren sesión y autorización mediante la familia propietaria. Las respuestas mantienen `{ ok, data?, message?, code?, errorId? }`.

`PATCH /api/admin/families/[id]/layout` recibe el borrador completo de unidades y personas, incluidas altas, campos editados, unidad, posición, condición de bebé e identificadores de borrados ya confirmados. Valida que el censo no haya cambiado y aplica la familia completa en una sola transacción. La interfaz usa este contrato para guardar cada acción automáticamente y serializa las peticiones con la revisión de la respuesta anterior. Los campos de contacto en edición permanecen fuera del censo enviado hasta su confirmación por pérdida de foco o por su botón de preferencia. El orden de las unidades no forma parte del contrato.

`PATCH /api/admin/families/[id]/name` recibe `{ revision, kind: "island" | "participant", id, name }`. Guarda únicamente el nombre de una entidad existente de esa familia y devuelve `{ name, revision }`. Comprueba propiedad y revisión bajo el mismo bloqueo de familia que el guardado completo; rechaza censos obsoletos con `409 FAMILY_DRAFT_STALE`. Este endpoint permanece disponible; la interfaz de familia utiliza actualmente el guardado serializado de `/layout` también para los nombres.

## APIs públicas

`POST /api/reveal/resolve` y `POST /api/reveal/open` responden como token inválido cuando el intento fue revocado o eliminado, sin revelar la causa.

`POST /api/webhooks/kapso` recibe estados de WhatsApp. No usa sesión administrativa: exige la firma HMAC de Kapso y nunca devuelve datos del reparto.

El envío administrativo admite alcance `all` o `selected` y modos `pending`, `failed` o `force`. La API de respaldo recibe solo `assignmentId`; la copia queda auditada en Runtime Logs y en la tabla opcional de auditoría, no como entrega.

El borrador familiar incluye una `revision` opaca obtenida con el censo. Se compara bajo bloqueo antes de escribir y se devuelve una revisión nueva tras guardar. Si nombres, contactos, roles de bebé, unidades o posiciones cambiaron desde la lectura, responde `409 FAMILY_DRAFT_STALE`; el cliente conserva los contactos en edición, muestra el conflicto y restaura la disposición confirmada si falló un movimiento.

`POST /api/auth/logout` cierra únicamente la sesión del dispositivo mediante Supabase SSR, rechaza un `Origin` ajeno y redirige con `303` a `/login`. La respuesta no se almacena en caché. No requiere una sesión administrativa vigente, para permitir salir también de sesiones caducadas o cuentas sin autorización.

`POST /api/webhooks/resend` valida los headers Svix y firma del cuerpo original; procesa entrega, retraso, fallo, rebote y supresión. No exige sesión. Ambos webhooks responden `503` para IDs todavía desconocidos, permitiendo reintentos del proveedor.

El envío devuelve `drawId`, `nextCursor`, contadores, resultados inciertos y posible `retryAfterSeconds`. Cada continuación debe conservar `idempotencyKey` y `drawId`. Los errores `409 DRAW_CHANGED` requieren recargar. Las mutaciones pueden devolver `403` por origen, `413` por cuerpo o `429` con `Retry-After`. Véanse [límites](./auth-security.md) y [lotes](./notifications.md).

`POST /api/auth/login` inicia sesión por contraseña; `GET /api/health` informa disponibilidad sin divulgar secretos ni mensajes de conexión.
