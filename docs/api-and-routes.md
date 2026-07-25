# API y rutas

## Páginas

| Ruta | Acceso | Estado actual |
| --- | --- | --- |
| `/` | Público | Redirige a `/inicio`. |
| `/login` | Público | Formulario de Magic Link. |
| `/auth/callback` | Público | Procesa credenciales devueltas por Supabase. |
| `/inicio` | Administrador | Dashboard con datos demo. |
| `/familia` | Administrador | Editor local con datos demo. |
| `/sorteo` | Administrador | Ejecuta actualmente el sorteo demo. |
| `/envios` | Administrador | Estados demo y copia de enlace. |
| `/r/[token]` | Público con token | Revelación demo o consulta real por hash. |

## `POST /api/auth/magic-link`

Solicita el enlace mediante una acción de servidor.

### Entrada

```json
{
  "email": "organizador@example.com"
}
```

### Respuesta

```json
{
  "ok": true,
  "message": "Te hemos enviado un enlace de acceso. Revisa tu correo."
}
```

Devuelve `400` para email inválido, error de proveedor o Supabase sin configurar. El formulario en el trabajo local
actual solicita el OTP directamente con el cliente de navegador, por lo que este endpoint puede quedar sin uso.

## `POST /api/auth/callback`

Confirma una sesión y escribe cookies.

Acepta una de estas alternativas:

```json
{ "code": "..." }
```

```json
{ "tokenHash": "...", "type": "magiclink" }
```

```json
{ "accessToken": "...", "refreshToken": "..." }
```

Devuelve `{ "ok": true }` o `400` con un mensaje. Los valores de este payload son credenciales y nunca deben
registrarse.

## `POST /api/draw/generate`

Ruta protegida por middleware.

### Entrada

```json
{
  "groupId": "demo-group"
}
```

`groupId` es opcional en el schema actual.

### Comportamiento

- Sin base configurada, sin grupo o con `demo-group`: ejecuta el sorteo demo sin persistir.
- Con base y un identificador diferente: intenta generación persistente.
- Devuelve `200` si encuentra reparto y `422` si las reglas lo impiden.
- Devuelve `401` si no existe administrador autenticado.

### Deuda del contrato

- Debe exigir un UUID o un identificador demo explícito, no un string opcional.
- Debe verificar propiedad del grupo.
- Debe incorporar idempotencia.
- Debe resolver la entrega de URLs antes de habilitar persistencia.
- Debe normalizar errores inesperados y evitar registros parciales.

## Endpoints que faltan

Los nombres y contratos definitivos deben definirse al implementarlos, pero se necesitan capacidades para:

- Consultar y crear el grupo actual.
- Listar, crear, actualizar y desactivar núcleos.
- Listar, crear, actualizar y desactivar participantes.
- Leer y modificar reglas y exclusiones.
- Consultar el último sorteo sin revelar receptores.
- Listar estado de entrega por participante.
- Reintentar una notificación.
- Marcar una entrega manual.
- Cerrar sesión.

Todos los endpoints administrativos deben validar con Zod, obtener el administrador desde la sesión y comprobar la
propiedad del grupo.

## Convenciones de respuesta

Mientras no exista un contrato más rico:

```ts
type Success<T> = {
  ok: true;
  data?: T;
  message?: string;
};

type Failure = {
  ok: false;
  message: string;
  fieldErrors?: Record<string, string[]>;
};
```

Estados recomendados:

- `200` lectura o acción completada.
- `201` creación.
- `400` payload inválido.
- `401` sin sesión.
- `403` sin autorización sobre el recurso.
- `404` recurso inexistente.
- `409` conflicto de estado o idempotencia.
- `422` reglas de dominio no satisfechas.
- `500` error inesperado, sin detalles sensibles.
