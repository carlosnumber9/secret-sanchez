# Autenticación y seguridad

## Modelo de acceso

Hay dos superficies:

- **Administración:** requiere sesión de Supabase y pertenecer a `admin_users`.
- **Revelación:** es pública, pero requiere conocer un token secreto de alta entropía.

Los participantes no crean cuenta.

## Flujo de Magic Link

1. El organizador escribe su email en `/login`.
2. Supabase recibe `signInWithOtp` y envía el Magic Link.
3. El enlace vuelve a `/auth/callback?next=/inicio`.
4. El callback acepta, según el formato, un código, `token_hash` o tokens de sesión.
5. `/api/auth/callback` confirma la sesión con Supabase.
6. El cliente de servidor escribe las cookies de sesión.
7. El middleware obtiene el usuario y busca el email en `admin_users`.
8. Si existe, permite continuar; si no, redirige a `/login` o responde `401`.

Hay también un endpoint `/api/auth/magic-link`. El trabajo local actual mueve la solicitud al cliente de navegador;
se debe decidir un único camino y retirar o justificar el duplicado.

## Rutas protegidas

- `/inicio`
- `/familia`
- `/sorteo`
- `/envios`
- Prefijo `/api/draw`

La lista está codificada en `src/middleware.ts`. Todo nuevo endpoint administrativo debe añadirse a la protección o
usar una política común más amplia.

## Autorización

Autenticación responde “quién es”; autorización responde “qué grupo puede modificar”.

Actualmente se comprueba la presencia del administrador, pero no se verifica que el grupo enviado a la API
pertenezca a ese administrador. Antes de admitir más de uno, cada caso de uso debe:

1. Obtener el administrador desde la sesión, nunca desde el payload.
2. Cargar el grupo solicitado.
3. Confirmar `owner_admin_id`.
4. Rechazar con `403` si no corresponde.
5. Registrar el administrador generador en el sorteo.

## Tokens de revelación

- Se crean con 32 bytes aleatorios y se codifican como Base64 URL-safe.
- La URL contiene el token en claro.
- La base guarda únicamente SHA-256.
- La búsqueda calcula el hash recibido.

El token funciona como credencial: quien posee la URL puede ver la asignación. Por ello:

- No debe aparecer en logs, analítica, trazas, capturas de error ni documentación.
- Debe enviarse solo por canales autorizados.
- Debe definirse cómo invalidarlo al regenerar.
- Las URLs en claro solo deben vivir el tiempo imprescindible para entregarlas.

## Variables y secretos

### Públicas

- `PUBLIC_SUPABASE_URL`
- `PUBLIC_SUPABASE_ANON_KEY`

### Solo servidor

- `SUPABASE_SERVICE_ROLE_KEY`
- `DATABASE_URL`
- `RESEND_API_KEY`
- `KAPSO_API_KEY`

### Aplicación

- `APP_URL`

Las variables de servidor no pueden importarse en componentes cliente, incorporarse a HTML, enviarse en JSON ni
registrarse. `.env` y `.env.local` están ignorados por Git.

## Cookies y callback

El callback debe conservar:

- Cookies `Secure` en producción según las opciones entregadas por Supabase SSR.
- Redirección `next` limitada a rutas locales; valores con `//` o sin `/` inicial se rechazan.
- Limpieza de tokens del historial del navegador cuando se procesen fragmentos.
- Mensajes de error útiles sin imprimir credenciales.

Las APIs de cookies usadas por la versión actual de Supabase SSR presentan avisos de obsolescencia y deben
actualizarse siguiendo la documentación oficial antes de una actualización mayor.

## Base de datos y RLS

La aplicación accede a Postgres desde servidor mediante `DATABASE_URL`. La migración inicial no habilita ni define
Row Level Security. Antes de producción se debe:

- Confirmar grants efectivos de los roles `anon` y `authenticated`.
- Habilitar RLS o revocar acceso API a las tablas que no deban consultarse desde el cliente.
- Proteger especialmente participantes, asignaciones, hashes y logs.
- Mantener la service role exclusivamente en servidor.

## Riesgos y trabajo pendiente

- Crear de forma segura el primer `admin_users`.
- Añadir logout y revocación de sesión.
- Aplicar propiedad del grupo en todos los casos de uso.
- Proteger automáticamente futuros endpoints administrativos.
- Añadir rate limiting al envío de Magic Links y a operaciones sensibles.
- Definir expiración e invalidación de tokens de revelación.
- Evitar enumeración de emails administrativos.
- Revisar políticas RLS y grants.
- Definir auditoría mínima de generación, regeneración y envío.
