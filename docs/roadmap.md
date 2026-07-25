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

- [ ] Terminar el callback de Magic Link en curso.
- [ ] Elegir entre solicitud OTP cliente o endpoint servidor.
- [ ] Crear un proceso seguro para el primer administrador.
- [ ] Añadir logout.
- [ ] Resolver el comportamiento del modo demo.
- [ ] Actualizar APIs obsoletas de Supabase SSR.
- [ ] Añadir pruebas del callback y middleware.

Resultado: Juan puede entrar y salir de forma fiable en local y producción.

## Hito 2 — Familia persistente

- [ ] Cargar o crear el grupo activo.
- [ ] Conectar dashboard con datos reales.
- [ ] Crear y editar núcleos.
- [ ] Crear, editar y desactivar participantes.
- [ ] Validar contactos y canales.
- [ ] Comprobar propiedad del grupo en servidor.
- [ ] Diseñar estados vacíos, carga y error.

Resultado: recargar la página conserva la familia preparada.

## Hito 3 — Reglas y sorteo seguro

- [ ] Mantener `NO_SAME_ISLAND` desde UI y base.
- [ ] Crear y eliminar exclusiones manuales.
- [ ] Validar viabilidad antes de generar.
- [ ] Ejecutar persistencia transaccional.
- [ ] Añadir idempotencia y prevención de doble clic.
- [ ] Resolver entrega efímera de URLs.
- [ ] Definir bloqueo y regeneración.
- [ ] Actualizar estados de grupo y sorteo.
- [ ] Añadir pruebas exhaustivas del dominio.

Resultado: existe un sorteo real válido, recuperable operacionalmente y sin pérdida de enlaces.

## Hito 4 — Entrega por email y manual

- [ ] Integrar Resend en el caso de uso de generación.
- [ ] Crear y actualizar `notification_logs`.
- [ ] Conectar `/envios` con datos reales.
- [ ] Implementar copia y marcado manual persistentes.
- [ ] Reintento individual y masivo idempotente.
- [ ] Verificar dominio y plantillas.
- [ ] Mostrar aperturas.

Resultado: todos reciben su enlace por email o mediante Juan y el estado queda registrado.

## Hito 5 — Seguridad y producción

- [ ] Verificar RLS y grants.
- [ ] Aplicar autorización por recurso.
- [ ] Añadir rate limiting.
- [ ] Definir backups y recuperación.
- [ ] Incorporar CI.
- [ ] Añadir observabilidad sin secretos.
- [ ] Ejecutar una prueba completa con datos ficticios.
- [ ] Documentar y probar rollback.

Resultado: el MVP puede usarse con datos familiares reales.

## Hito posterior — WhatsApp

- [ ] Cerrar flujo definitivo con Kapso.
- [ ] Configurar plantillas y consentimiento.
- [ ] Normalizar teléfonos.
- [ ] Integrar webhooks y estados.
- [ ] Añadir reintentos y pruebas.

WhatsApp no bloquea el MVP si email y entrega manual funcionan.

## Ideas futuras

No forman parte del compromiso actual:

- Personalización visual por grupo.
- Historial de años.
- Múltiples organizadores con roles.
- Listas de deseos y presupuestos.
- Recordatorios programados.
- Exportación o impresión de entregas manuales.
- Métricas agregadas de entrega.

Cada idea debe validarse contra el objetivo de simplicidad antes de entrar en un hito.
