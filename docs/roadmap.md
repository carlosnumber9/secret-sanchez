# Roadmap

Revisado el 7 de noviembre de 2026. Estado de código separado de operación real.

## Completado en código

- [x] Dependencias compatibles, Node 22 y CI reproducible.
- [x] Login, logout, propiedad por recurso y transacciones coordinadas.
- [x] Familia permanente, borradores con revisión y persistencia en lotes.
- [x] Ediciones, roles, bebés, representantes, reglas y exclusiones desde UI.
- [x] Emparejamiento acotado, validación, snapshots, revocación y contador durable de intentos.
- [x] Tokens cifrados, revelación atómica y recuperación de fallos temporales.
- [x] Reservas idempotentes, lotes reanudables y webhooks firmados de ambos proveedores.
- [x] RLS, índices, límites distribuidos y auditoría preparados mediante SQL revisable.
- [x] Unitarias e integración local/CI con datos sintéticos.
- [x] Carga diferida de WebGL y lecturas administrativas específicas.

## Activación operativa pendiente

- [ ] Reconciliar journal real y aplicar SQL aprobado tras el procedimiento de recuperación.
- [ ] Verificar RLS y grants efectivos en cada proyecto.
- [ ] Provisionar y verificar entornos independientes.
- [ ] Verificar dominio/remitente y activar webhook de Resend.
- [ ] Configurar credenciales, plantilla y webhook de Kapso.
- [ ] Acordar retención, backups y realizar recuperación del entorno real.
- [ ] Completar una edición de prueba operativa con destinatarios seguros.

Esta sesión solo autoriza código: no exportar datos, migrar ni activar servicios externos. Las pruebas locales no completan las casillas operativas.

## Por decidir

- End-to-end, regresión visual, lint/formato y cobertura mínima.
- Retención de auditoría y expiración de enlaces.
- Varios organizadores con permisos compartidos.
- Archivo/restauración de ediciones desde UI.

Personalización, listas de deseos y recordatorios quedan fuera del compromiso actual.
