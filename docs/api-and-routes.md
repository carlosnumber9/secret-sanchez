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

- Familia: `POST /api/admin/groups`, `POST /api/admin/islands`, `PATCH|DELETE /api/admin/islands/[id]`, `POST /api/admin/participants`, `PATCH|DELETE /api/admin/participants/[id]` y `PATCH /api/admin/families/[id]/layout`.
- Impacto destructivo: `GET /api/admin/participants/[id]/deletion-impact` y `GET /api/admin/islands/[id]/deletion-impact`.
- Ediciones: `GET|POST /api/admin/editions`, `PATCH /api/admin/editions/[id]`.
- Configuración: `PATCH /api/admin/editions/[id]/islands/[islandId]` y `PATCH /api/admin/editions/[id]/participants/[participantId]`.
- Intentos: `POST /api/admin/editions/[id]/draws/generate` y `POST /api/admin/editions/[id]/draws/[drawId]/revoke`.
- Entrega: `POST /api/admin/editions/[id]/notifications/send` y `POST /api/admin/notifications/manual`.

Todas requieren sesión y autorización mediante la familia propietaria. Las respuestas mantienen `{ ok, data?, message?, code?, errorId? }`.

`PATCH /api/admin/families/[id]/layout` recibe el borrador completo de unidades y personas, incluidas altas, campos editados, unidad, posición, condición de bebé e identificadores de borrados ya confirmados. Valida que el censo no haya cambiado y aplica la familia completa en una sola transacción. El orden de las unidades no forma parte del contrato.

## APIs públicas

`POST /api/reveal/resolve` y `POST /api/reveal/open` responden como token inválido cuando el intento fue revocado o eliminado, sin revelar la causa.

`POST /api/webhooks/kapso` recibe estados de WhatsApp. No usa sesión administrativa: exige la firma HMAC de Kapso y nunca devuelve datos del reparto.

El envío administrativo admite alcance `all` o `selected` y modos `pending`, `failed` o `force`. La API de respaldo recibe solo `assignmentId`; la copia queda auditada en Runtime Logs, no como entrega.

El borrador familiar incluye una `revision` opaca obtenida con el censo. Se compara bajo bloqueo antes de escribir y se devuelve una revisión nueva tras guardar. Si nombres, contactos, roles de bebé, unidades o posiciones cambiaron desde la lectura, responde `409 FAMILY_DRAFT_STALE`; el cliente conserva el borrador local.
