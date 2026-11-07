# Actualización de noviembre de 2026

Alcance: implementación, commits y publicación secuencial en `main`. Sin copias, migraciones ni configuración de servicios reales. La ejecución de SQL y la restauración se prueban exclusivamente con fixtures locales.

## Commits lógicos en orden

| Orden | Commit | Cambio |
| --- | --- | --- |
| 1 | `ffd07c3` | build(platform): Upgraded Astro and compatible integrations |
| 2 | `2fd1255` | build(deps): Updated and bounded application dependencies |
| 3 | `5600ea7` | fix(notifications): Prevented revoked draws from being reactivated |
| 4 | `105cc95` | fix(logging): Removed sensitive data from error diagnostics |
| 5 | `c780050` | fix(db): Restricted public access to application tables |
| 6 | `de92a9f` | fix(notifications): Made delivery attempts atomic and retryable |
| 7 | `b1b71df` | fix(webhooks): Preserved delivery states under concurrent events |
| 8 | `6f39066` | fix(editions): Serialized configuration and draw mutations |
| 9 | `55766f6` | fix(family): Rejected stale family drafts |
| 10 | `7e61cd6` | fix(draw): Validated unique and complete giver assignments |
| 11 | `cb89c3b` | fix(env): Unified environment loading for administrative commands |
| 12 | `2ec54ab` | build(tooling): Reduced and pinned development dependencies |
| 13 | `808750d` | ci: Added reproducible build and test checks |
| 14 | `358052b` | test(integration): Covered transactional application workflows |
| 15 | `c218bab` | perf(frontend): Deferred the decorative WebGL background |
| 16 | `ea705f9` | perf(family): Batched family draft persistence |
| 17 | `68db903` | perf(pages): Loaded only the data required by each page |
| 18 | `f37bc38` | perf(notifications): Queried current delivery states directly |
| 19 | `7d0def6` | perf(db): Added indexes for administrative query paths |
| 20 | `2a3ddf2` | perf(notifications): Processed deliveries in bounded batches |
| 21 | `7459166` | perf(reveal): Removed redundant assignment lookups |
| 22 | `98d6842` | fix(reveal): Preserved retryable reveal states |
| 23 | `037b252` | perf(draw): Bounded assignment search complexity |
| 24 | `52d7f96` | fix(draw): Preserved attempt numbers after history deletion |
| 25 | `bc6df54` | feat(auth): Added administrative logout |
| 26 | `9f2e3a2` | fix(security): Bounded sensitive requests and responses |
| 27 | `0b41df8` | feat(audit): Persisted sensitive administrative events |
| 28 | `5ade581` | feat(email): Tracked delivery failures and bounces |
| 29 | `40e1f6a` | feat(draw): Added edition rule and exclusion controls |
| 30 | `8c77d1f` | refactor(actions): Consolidated authorized application workflows |
| 31 | `a9b1153` | docs: Reconciled documentation with the implemented application |
| 32 | `31e3317` | build(env): Isolated development and preview data |
| 33 | Este cambio | chore(ops): Documented and verified release recovery procedures |

## Validación final

- 59 pruebas unitarias y 21 de integración PostgreSQL.
- `npm run build`: tipos y compilación SSR.
- `npm run db:check`: schema y snapshots coinciden, sin conexión real.
- `npm run test:ssr`: login, revelación, hashes CSP, cabeceras privadas, autorización y límites.
- `npm run test:recovery`: 16 tablas, journal, tokens cifrados y RLS tras restauración sintética; sin archivos de copia.
- Auditoría `--omit=dev`: cero altas/críticas y cuatro moderadas en la cadena de tracing de `@astrojs/vercel` (`@vercel/nft`, `glob`, `minimatch`). El arreglo automático propuesto baja el adapter a otra major incompatible; no se ha aplicado. Requiere seguimiento upstream.
- CI versionada; no se certifica una ejecución remota de Actions ni el despliegue automático de Vercel.

La validación SSR detectó dos fallos que el build por sí solo no cubría: activación CSP dependiente de NODE_ENV al leer la configuración y sustitución de la cabecera generada por las cabeceras privadas. El último cambio activa la configuración de Astro y conserva sus hashes junto al bloqueo de frames; incluye regresión y smoke en CI.

## Rendimiento implementado

- WebGL pasa a un módulo diferido; móviles, ahorro de datos y movimiento reducido no descargan Three.js.
- Guardado del censo en lotes y sin escribir filas sin cambios.
- Lecturas por pantalla y último intento de entrega mediante `DISTINCT ON`; agregados de impacto sin multiplicar filas.
- Índices administrativos revisados en SQL, pendientes de activación real.
- Entregas en lotes reanudables de cuatro mensajes y concurrencia dos.
- Preparación y apertura de revelación sin consultas redundantes.
- Emparejamiento polinómico acotado a 500 nodos por lado, sin búsqueda factorial.

Los benchmarks son sintéticos: no constituyen mediciones de latencia ni carga de producción.

## Activación pendiente

- Reconciliar el journal real y revisar/aplicar SQL autorizado (`0008`–`0011`). RLS e índices no se activan por publicar código.
- Sin `0010`, límites por memoria de instancia. Sin `0011`, auditoría persistente ausente y contador de copias desconocido.
- Crear/configurar Supabase independiente para desarrollo/Preview. La configuración compartida histórica se rechaza; no se han cambiado archivos `.env` reales.
- Configurar webhook/dominio de Resend y plantilla/webhook de Kapso; verificar edición operativa de prueba con destinatarios seguros.
- Acordar retención, RPO/RTO y realizar una restauración real autorizada. Véase [release y recuperación](./release-recovery.md).
