# Estado actual

Última revisión documental: **25 de julio de 2026**.

## Resumen

El repositorio contiene un prototipo visual sólido y buena parte de la arquitectura backend, pero todavía no ofrece
un recorrido real completo. Las pantallas administrativas consumen datos demo aunque ya existen el schema, las
queries, el motor de sorteo, la autenticación y los adaptadores de notificación.

`npm run build` pasa sin errores. En la última revisión aparecieron avisos de obsolescencia de APIs de Drizzle,
Supabase SSR y Zod, sin bloquear el build.

## Implementado

- Astro con SSR y adapter de Vercel.
- React Islands para edición de familia, sorteo, envíos y revelación.
- Diseño responsive con CSS por componente y estilos globales.
- Magic Link con Supabase, callback y sesión mediante cookies.
- Middleware para proteger las páginas administrativas y `/api/draw`.
- Allowlist de administradores mediante `admin_users`.
- Schema Drizzle y migración inicial con grupos, participantes, reglas, sorteos, asignaciones y notificaciones.
- Queries y acciones básicas de creación y actualización.
- Motor de sorteo con backtracking, barajado criptográfico y validación.
- Restricciones de autoasignación, mismo núcleo y exclusiones manuales a nivel de dominio.
- Creación y hash de tokens de revelación.
- Revelación pública mediante token y registro de apertura.
- Envío de email mediante Resend a nivel de servicio.
- Enrutado de canales según la preferencia del participante.
- Datos demo para iterar la interfaz.

## Parcial o solo preparado

### Administración

`/inicio`, `/familia`, `/sorteo` y `/envios` muestran datos demo. El editor de familia modifica únicamente estado
React y pierde los cambios al recargar. Hay queries persistentes, pero no endpoints o acciones web que las conecten
con la interfaz.

### Autenticación

La base del flujo existe. Hay trabajo local en curso para aceptar más formatos de callback de Supabase, incluido
`token_hash`. Falta un mecanismo documentado para crear el primer administrador y no existe logout.

### Sorteo persistente

La acción persistente crea el sorteo, asignaciones y hashes. La interfaz siempre envía el identificador del grupo
demo, de modo que no alcanza este camino con un grupo real.

Además existe un bloqueo crítico: la acción genera las URLs secretas, pero el endpoint devuelve solo un mensaje y no
envía notificaciones. Como solo se guarda el hash, los tokens originales se pierden al terminar la petición.

### Reglas

El modelo contiene `draw_rules` y `exclusion_rules`, pero la generación persistente usa actualmente
`noSameIsland: true` y `exclusions: []`. No hay UI ni queries integradas para mantener las exclusiones.

### Notificaciones

Resend puede enviar un correo si está configurado, pero no forma parte del flujo de generación. Los logs de
notificación tampoco están conectados. Kapso es un stub intencionado y no envía WhatsApp.

### Envíos

La pantalla usa estados demo. Copiar un enlace funciona en el navegador; reintentar, marcar manual y cargar estados
reales no están implementados.

## Riesgos conocidos

1. Un sorteo real perdería los tokens si se ejecuta mediante el endpoint actual.
2. La creación del sorteo y de las asignaciones no está envuelta en una transacción.
3. No hay política de idempotencia, regeneración, bloqueo o invalidación de enlaces anteriores.
4. El endpoint comprueba que hay un administrador, pero no la propiedad del grupo recibido.
5. No aparecen políticas RLS en la migración inicial.
6. La promesa de modo demo sin configuración no coincide con el middleware: sin Supabase y base de datos las páginas
   administrativas redirigen al login.
7. No hay pruebas automatizadas ni CI.
8. El remitente de Resend y el dominio deben verificarse antes del primer envío real.

## Estado del repositorio en esta revisión

- Rama principal: `main`.
- La rama local estaba alineada con `origin/main`.
- Último cambio confirmado: actualización visual de estilo claymorphism.
- Existían tres archivos de autenticación modificados y sin commit; se consideran trabajo en curso y no deben
  sobrescribirse.
- `.env` está ignorado por Git y dispone de los nombres de variables esperados. Sus valores no forman parte de la
  documentación.

Este apartado es una fotografía, no un registro automático. Debe actualizarse cuando se cierre un hito relevante.
