# Documentación de Secret Sánchez

Este directorio es la fuente de verdad compartida sobre el producto. Explica qué problema resuelve, qué existe hoy,
cómo está construido, cómo operarlo y qué decisiones siguen abiertas.

## Mapa documental

| Documento | Contenido |
| --- | --- |
| [Producto](./product.md) | Visión, usuarios, alcance, principios y recorridos principales. |
| [Estado actual](./current-state.md) | Fotografía honesta de lo implementado, lo simulado y los riesgos conocidos. |
| [Arquitectura](./architecture.md) | Contexto técnico, módulos, límites y flujos de ejecución. |
| [Modelo de datos](./data-model.md) | Entidades, relaciones, estados y política de migraciones. |
| [Autenticación y seguridad](./auth-security.md) | Magic Link, autorización, secretos y riesgos de seguridad. |
| [Motor de sorteo](./draw-engine.md) | Reglas, algoritmo, persistencia e invariantes. |
| [Notificaciones](./notifications.md) | Email, WhatsApp, entrega manual y seguimiento. |
| [API y rutas](./api-and-routes.md) | Páginas, endpoints y contratos actuales. |
| [UI y experiencia](./ui-ux.md) | Estructura de pantallas y principios de interacción. |
| [Desarrollo](./development.md) | Entorno local, comandos, estructura y criterios para cerrar cambios. |
| [Git y commits](./git-workflow.md) | Flujo de trabajo y formato obligatorio de commits. |
| [Calidad y pruebas](./testing-and-quality.md) | Estado de validación y estrategia de pruebas prevista. |
| [Operación y despliegue](./operations.md) | Servicios externos, despliegue, observabilidad y recuperación. |
| [Roadmap](./roadmap.md) | Prioridades, hitos y trabajo pendiente. |
| [Decisiones](./decisions.md) | Decisiones confirmadas, abiertas y plantilla de ADR. |

## Cómo mantener estas docs

- Actualizar la documentación en el mismo cambio que modifica el comportamiento descrito.
- Distinguir siempre entre comportamiento **implementado**, **parcial**, **previsto** o **por decidir**.
- No documentar secretos, valores reales de `.env`, tokens de revelación ni datos personales.
- Enlazar al código cuando ayude a comprobar una afirmación.
- Añadir las decisiones que afecten a varios módulos en [decisions.md](./decisions.md) o en un ADR.
- Actualizar la fecha de [current-state.md](./current-state.md) cuando cambie sustancialmente la situación del MVP.

La documentación describe el repositorio, pero el código y las migraciones siguen siendo la autoridad ejecutable. Si
hay una contradicción, se debe corregir la documentación o abrir una decisión explícita; no se debe mantener la
divergencia en silencio.
