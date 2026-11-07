# Estado actual

Última revisión documental: **7 de noviembre de 2026**.

## Implementado en código

- Astro 7 SSR, React Islands y Node 22.23.4; dependencias acotadas y lockfile reproducible.
- Login y logout de Supabase SSR; autorización por UUID y propiedad de familia.
- Historial de ediciones en `/`, censo permanente en `/familia` y configuración, reparto y envíos por edición.
- Borradores familiares transaccionales con revisión de concurrencia, persistencia en lotes y actualización exclusiva de diferencias.
- Adultos con roles por edición; bebés receptores sin contacto y representantes de núcleos.
- Reglas editables: evitar mismo núcleo y exclusiones dirigidas. Configuración bloqueada con intento vigente o edición archivada.
- Emparejamiento bipartito acotado, validación independiente y generación transaccional con un único intento vigente.
- Revocación, snapshots y contador de intentos conservado incluso al borrar el histórico.
- Tokens con hash SHA-256 y ciphertext AES-256-GCM; fragmento retirado del navegador y reintento de revelación en memoria.
- Reservas idempotentes de notificación, lotes reanudables de cuatro mensajes, concurrencia dos y gestión de resultados inciertos.
- Webhooks firmados de Kapso y Resend; transiciones atómicas y fallos terminales de email.
- Cabeceras privadas, CSP de producción, comprobación de origen y límites HTTP.
- Guardas de aislamiento por entorno y destinatarios seguros fuera de Production; provisionamiento externo pendiente.
- Fondo WebGL diferido, alternativa SVG y consultas específicas por pantalla.
- Smoke SSR y simulacro de restauración sintética; ver [evidencia de actualización](./maintenance-2026-11.md).
- CI con Node 22, PostgreSQL 17 efímero, unitarias, integración, build, comprobación de schema y auditoría de dependencias.

## Preparado, pendiente de activación

Los SQL se versionan y se prueban únicamente en PostgreSQL local con datos sintéticos. Por instrucción del propietario, esta actualización **no aplica migraciones ni crea copias de datos reales**.

- `0008`: RLS y revocación de acceso público a tablas de aplicación.
- `0009`: índices administrativos.
- `0010`: límites compartidos entre funciones. Sin tabla se usa memoria por instancia, sin garantía global.
- `0011`: auditoría persistente. Sin tabla se emite aviso técnico y las copias históricas se muestran desconocidas.
- La documentación anterior registró `0005` y `0006` como aplicadas. Eso no prueba el estado actual del entorno; `0007` normaliza estados legacy. El operador debe reconciliar el journal antes de cualquier migración futura.
- Dominio/remitente y suscripción del webhook de Resend, con `RESEND_WEBHOOK_SECRET`.
- Credenciales, plantilla aprobada y webhook de Kapso.
- Una edición de prueba operativa completa, con destinatarios seguros, antes del uso definitivo.

## Límites y decisiones pendientes

- No se han modificado variables remotas ni verificado el despliegue automático que pueda disparar Git.
- Las pruebas aisladas no prueban la configuración real de Auth, dominio de email o plantilla de WhatsApp.
- Un envío aceptado puede rebotar después; el panel refleja el fallo y el estado `sent` conserva el hito histórico.
- El organizador puede obtener cualquier enlace autorizado. Revocar no borra información ya vista.
- Falta acordar retención de auditoría, expiración de enlaces y permisos colaborativos.
- El aislamiento de datos de desarrollo/Preview requiere configuración independiente; ver [operación](./operations.md).
