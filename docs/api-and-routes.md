# API y rutas

## Páginas

| Ruta | Acceso | Comportamiento |
| --- | --- | --- |
| `/login` | Público | Solicita Magic Link mediante API. |
| `/auth/callback` | Público | Confirma la sesión y escribe cookies. |
| `/inicio` | Administrador | Grupo activo, estadísticas y alta inicial. |
| `/familia` | Administrador | Núcleos y participantes persistentes. |
| `/sorteo` | Administrador | Generación real y transaccional. |
| `/envios` | Administrador | Email, reintentos, entrega manual y aperturas. |
| `/r#token` | Público con token | Revelación sin enviar el token en el path HTTP. |

## APIs públicas

- `GET /api/health`: configuración y conexión a Postgres.
- `POST /api/auth/magic-link`: solicita acceso.
- `POST /api/auth/callback`: confirma código, `token_hash` o sesión.
- `POST /api/reveal/resolve`: valida el token sin devolver el receptor.
- `POST /api/reveal/open`: registra la apertura y devuelve el receptor.

## APIs administrativas

Todas requieren sesión, allowlist y autorización por propietario:

- `POST /api/admin/groups`.
- `POST /api/admin/islands`.
- `PATCH /api/admin/islands/[id]`.
- `POST /api/admin/participants`.
- `PATCH /api/admin/participants/[id]`.
- `POST /api/admin/draws/generate`.
- `POST /api/admin/notifications/send`.
- `POST /api/admin/notifications/manual`.

Las respuestas usan `{ ok, data?, message?, code?, errorId? }`. Validación devuelve `400`, sesión `401`, propiedad
`403`, inexistencia `404`, conflicto `409`, dominio `422` y error inesperado `500`.
