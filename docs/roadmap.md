# Roadmap

El orden prioriza un recorrido real completo antes que nuevas funcionalidades.

## Hito 0 — Base documental

- [x] README breve.
- [x] Índice documental.
- [x] Producto, arquitectura y estado actual.
- [x] Datos, seguridad, sorteo y notificaciones.
- [x] Desarrollo, Git, calidad y operación.
- [ ] Mantener las docs actualizadas en cada cambio.

## Hito 1 — Acceso fiable

- [x] Iniciar sesión con email y contraseña mediante endpoint servidor.
- [x] Enlazar la allowlist con el UUID de Supabase conservando filas legacy.
- [x] Crear un proceso seguro para el primer administrador.
- [x] Añadir asignación y reset manual de contraseña por UUID.
- [ ] Añadir logout.
- [x] Eliminar fixtures y exigir Supabase real en todos los entornos.
- [ ] Actualizar APIs obsoletas de Supabase SSR.
- [x] Añadir pruebas de identidad administrativa y redirección de login.
- [ ] Añadir pruebas de integración del endpoint y middleware.

Resultado: Juan puede entrar y salir de forma fiable en local y producción.

## Hito 2 — Familia persistente

- [x] Cargar o crear el grupo activo.
- [x] Conectar dashboard con datos reales.
- [x] Crear núcleos.
- [x] Crear y desactivar participantes.
- [x] Validar contactos y canales antes de sortear.
- [x] Comprobar propiedad del grupo en servidor.
- [x] Diseñar estados vacíos y feedback de mutación.

Resultado: recargar la página conserva la familia preparada.

## Hito 3 — Reglas y sorteo seguro

- [ ] Mantener `NO_SAME_ISLAND` desde UI y base.
- [ ] Crear y eliminar exclusiones manuales.
- [x] Validar viabilidad antes de generar.
- [x] Ejecutar persistencia transaccional.
- [x] Prevenir doble generación y confirmar la acción.
- [x] Cifrar tokens para entrega posterior.
- [x] Mantener un único intento vigente por edición.
- [x] Revocar intentos, invalidar tokens y permitir relanzamientos numerados.
- [x] Separar familia maestra, ediciones y snapshots por intento.
- [x] Configurar participación y roles dentro de cada edición.
- [x] Añadir borrado destructivo coherente de personas, unidades e intentos afectados.
- [x] Actualizar estados de grupo y sorteo.
- [x] Añadir pruebas repetidas de invariantes del dominio.
- [x] Modelar bebés como receptores sin capacidad de regalar.
- [x] Asignar bebés a unidades distintas con representante por edición.

Resultado: cada edición conserva un reparto vigente, intentos revocados auditables y snapshots estables.

## Hito 4 — Entrega automática y respaldo

- [x] Integrar Resend como acción posterior confirmada.
- [x] Crear y actualizar `notification_logs`.
- [x] Conectar `/envios` con datos reales.
- [x] Implementar copia de respaldo auditada sin convertirla en entrega.
- [x] Reintento masivo idempotente.
- [ ] Verificar dominio y plantillas.
- [x] Mostrar aperturas.

Resultado: todos reciben su enlace por email o mediante Juan y el estado queda registrado.

## Hito 5 — Seguridad y producción

- [ ] Verificar RLS y grants.
- [x] Aplicar autorización por recurso.
- [ ] Añadir rate limiting.
- [ ] Definir backups y recuperación.
- [ ] Incorporar CI.
- [x] Añadir observabilidad sin secretos.
- [ ] Ejecutar una prueba completa con datos ficticios.
- [ ] Documentar y probar rollback.

Resultado: el MVP puede usarse con datos familiares reales.

## Hito 5 — WhatsApp

- [x] Cerrar flujo técnico con Kapso.
- [ ] Configurar plantillas y consentimiento.
- [x] Validar teléfonos internacionales antes de sortear.
- [x] Integrar webhooks y estados.
- [x] Añadir selección, reintentos y pruebas de dominio.

La activación operativa depende de credenciales, plantilla aprobada y webhook registrado.

## Ideas futuras

No forman parte del compromiso actual:

- Personalización visual por grupo.
- Archivo y restauración de ediciones antiguas desde la UI.
- Múltiples organizadores con roles.
- Listas de deseos y presupuestos.
- Recordatorios programados.
- Exportación o impresión de entregas manuales.
- Métricas agregadas de entrega.

Cada idea debe validarse contra el objetivo de simplicidad antes de entrar en un hito.
