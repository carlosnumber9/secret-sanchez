# Autenticación y seguridad

## Modelo de acceso

Hay dos superficies:

- **Administración:** requiere sesión de Supabase y pertenecer a `admin_users`.
- **Revelación:** es pública, pero requiere conocer un token secreto de alta entropía.

Los participantes no crean cuenta.

## Flujo de contraseña

1. El organizador escribe su email y contraseña en `/login`.
2. `/api/auth/login` valida el payload y llama a `signInWithPassword` desde el cliente SSR de Supabase.
3. Supabase devuelve la sesión y el cliente de servidor escribe sus cookies.
4. El middleware obtiene el usuario y busca primero su UUID en `admin_users.auth_user_id`.
5. Si la fila es legacy y `auth_user_id` sigue a `NULL`, puede coincidir por email y enlaza el UUID de forma atómica.
6. Sin sesión redirige a `/login` o responde `401`; una sesión sin administrador autorizado recibe `403`.

No existe alta pública. Las cuentas se crean de forma controlada en Supabase, se añaden a `admin_users` y reciben o
restablecen su contraseña mediante `npm run admin:set-password -- --user-id <uuid>`.

## Rutas protegidas

- `/`
- `/inicio`
- `/familia`
- `/sorteo`
- `/envios`
- Prefijo `/ediciones`
- Prefijo `/api/admin`

Todo nuevo endpoint administrativo debe vivir bajo `/api/admin` o aplicar una protección equivalente.

## Autorización

Autenticación responde “quién es”; autorización responde “qué grupo puede modificar”.

Cada mutación obtiene el administrador desde la sesión y comprueba la propiedad en servidor:

1. Obtener el administrador desde la sesión, nunca desde el payload.
2. Cargar el grupo solicitado.
3. Confirmar `owner_admin_id`.
4. Rechazar con `403` si no corresponde.
5. Registrar el administrador generador en el sorteo.

El UUID es la identidad estable. El fallback por email solo puede reclamar filas cuyo `auth_user_id` sea nulo; una
coincidencia de email nunca sustituye un UUID ya enlazado. Un índice único impide enlazar el mismo UUID a dos
administradores.

## Tokens de revelación

- Se crean con 32 bytes aleatorios y se codifican como Base64 URL-safe.
- La URL lleva el token en el fragmento `#`, que no se envía como path HTTP.
- La base guarda SHA-256 y una copia cifrada AES-256-GCM.
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

- `DATABASE_URL`
- `REVEAL_TOKEN_ENCRYPTION_KEY`
- `RESEND_API_KEY`
- `KAPSO_API_KEY`
- `KAPSO_PHONE_NUMBER_ID`
- `KAPSO_TEMPLATE_NAME`
- `KAPSO_TEMPLATE_LANGUAGE`
- `KAPSO_WEBHOOK_SECRET`
- `KAPSO_TEST_RECIPIENT_PHONE`

### Aplicación

- `APP_URL`

### Operación local

- `SUPABASE_SECRET_KEY` o `SUPABASE_SERVICE_ROLE_KEY`, opcionales en el entorno de terminal porque el comando de
  contraseña puede solicitarlas de forma oculta.

Las variables de servidor no pueden importarse en componentes cliente, incorporarse a HTML, enviarse en JSON ni
registrarse. `.env` y `.env.local` están ignorados por Git. Las claves administrativas de Supabase no forman parte
de `AppEnv` y no deben configurarse en Vercel.

## Cookies y sesiones

- El login conserva el formato de cookies administrado por Supabase SSR, incluidas sus opciones `Secure` en
  producción.
- La redirección `next` se limita al mismo origen; destinos externos o mal formados vuelven a `/`, la página de ediciones.
- Los errores de credenciales son genéricos para no revelar si existe un email.
- Cambiar el método de login no invalida por sí mismo las cookies existentes. Asignar o cambiar la contraseña desde
  la API administrativa puede revocar las sesiones de ese UUID y exigir una nueva autenticación.

Las APIs de cookies usadas por la versión actual de Supabase SSR presentan avisos de obsolescencia y deben
actualizarse siguiendo la documentación oficial antes de una actualización mayor.

## Base de datos y RLS

La aplicación accede a Postgres desde servidor mediante `DATABASE_URL`. La migración inicial no habilita ni define
Row Level Security. Antes de producción se debe:

- Confirmar grants efectivos de los roles `anon` y `authenticated`.
- Habilitar RLS o revocar acceso API a las tablas que no deban consultarse desde el cliente.
- Proteger especialmente participantes, asignaciones, hashes y logs.

## Riesgos y trabajo pendiente

- Ejecutar el bootstrap y asignar contraseña al primer `admin_users`.
- El cierre de sesión local se realiza mediante `POST /api/auth/logout`, con invalidación del refresh token de esa sesión y cookies gestionadas por Supabase SSR.
- Mantener la propiedad en todos los casos de uso nuevos.
- Añadir rate limiting adicional y protección contra fuerza bruta en operaciones sensibles.
- Definir expiración e invalidación de tokens de revelación.
- Evitar enumeración de emails administrativos.
- Revisar políticas RLS y grants.
- Definir auditoría mínima de generación, regeneración y envío.

## Diagnósticos de errores

Los logs técnicos conservan evento, identificadores, tipos de error conocidos y códigos de sistema permitidos. No serializan `message`, SQL, parámetros ni mensajes de causas: una expresión de redacción no puede garantizar la eliminación de nombres, teléfonos o contraseñas arbitrarias.

## Acceso directo a tablas

La migración `0008_restricted_public_access.sql` habilita RLS sin políticas públicas y revoca privilegios de `PUBLIC`, `anon` y `authenticated` en las tablas de aplicación. El servidor necesita una conexión propietaria o con `BYPASSRLS`; Supabase Auth no necesita acceso a estas tablas. La migración debe aplicarse después de verificar ese rol y disponer de backup. La existencia del SQL no acredita su aplicación en Supabase.
