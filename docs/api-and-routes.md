# API y rutas

## Páginas

| Ruta | Acceso | Comportamiento |
| --- | --- | --- |
| `/login` | Público | Inicia sesión con email y contraseña. |
| `/inicio` | Administrador | Grupo activo, estadísticas y alta inicial. |
| `/familia` | Administrador | Núcleos y participantes persistentes. |
| `/sorteo` | Administrador | Generación real y transaccional. |
| `/envios` | Administrador | Email, reintentos, entrega manual y aperturas. |
| `/r#token` | Público con token | Revelación sin enviar el token en el path HTTP. |

## APIs públicas

- `GET /api/health`: configuración y conexión a Postgres.
- `POST /api/auth/login`: valida `{ email, password }` con Supabase y escribe las cookies SSR. Devuelve `400` para
  payload inválido, `401` para credenciales incorrectas y `429` para exceso de intentos sin revelar si existe el email.
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
