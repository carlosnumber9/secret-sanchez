# Decisiones

## Confirmadas en el código

| Área | Decisión |
| --- | --- |
| Producto | Amigo Invisible familiar; familia permanente, ediciones e intentos separados. Vocabulario en [CONTEXT.md](../CONTEXT.md). |
| Frontend | Astro SSR y React Islands; shadcn/ui, Base UI y Tailwind CSS 4. |
| Runtime | Node 22.23.4 o un parche compatible de la rama 22; adapter de Vercel. |
| Datos | Supabase Auth y Postgres; Drizzle como autoridad de schema, sin migraciones en build. |
| Auth | Contraseña, allowlist por UUID, fallback solo para filas legacy sin UUID, logout local. |
| Autorización | Propietario de familia comprobado en servidor y bloqueado antes de sus hijos al escribir. |
| Tokens | Aleatorios; hash para búsqueda y AES-256-GCM para entrega autorizada. Revelación pública sin cuenta. |
| Reparto | Dos emparejamientos independientes; adultos equilibrados y bebés asignados a otro núcleo sin repetirlo. |
| Regeneración | Revocar primero; un intento vigente, numeración monotónica y secretos nuevos. |
| Entregas | Resend y Kapso, reservas atómicas, deduplicación y reenvío explícito; un resultado incierto no equivale a rechazo. |
| Respaldo | Copiar un enlace se audita y no acredita entrega. |
| Seguridad | SQL preparado para RLS, límites compartidos y auditoría; compatibilidad explícita cuando faltan tablas opcionales. |
| Pruebas | Runner nativo de Node con tsx; integración en PostgreSQL local/CI aislado, sin proveedores reales. |
| Entornos actuales | Desarrollo/Preview requieren proyectos distintos; el código valida el destino y limita envíos a pruebas. Provisionamiento y variables reales pendientes. |
| Actualización de noviembre | Solo código y SQL versionado; sin exportar datos reales ni aplicar migraciones compartidas. |
| Idioma y Git | UI y docs en español; commits tipados con descripción inglesa en pasado simple. |

## Abiertas

- Permisos para varios administradores de una familia.
- Expiración automática de enlaces y política de retención de auditoría.
- Provisionamiento y comprobación de proyectos independientes por entorno.
- Framework end-to-end, regresión visual y umbral de cobertura.
- Lint y formato más allá de TypeScript/Astro y `git diff --check`.
- Alcance final del catálogo de componentes.

## ADR

[0001 — Bebés y regalo por unidad](./adr/0001-bebes-y-regalo-por-unidad.md) conserva el contexto de esa decisión. Una nueva ADR se justifica por una decisión difícil de revertir, sorprendente sin contexto y resultado de una disyuntiva real. Las docs temáticas describen el comportamiento actual; el ADR explica el porqué histórico.
