# Decisiones

## Confirmadas

| Área | Decisión |
| --- | --- |
| Producto | El MVP está orientado al Amigo Invisible familiar de Reyes organizado inicialmente por Juan. |
| Frontend | Astro para páginas y React Islands para interacción. |
| Estilos | shadcn/ui `base-rhea` y Tailwind CSS 4; CSS propio para layout y contenedores translúcidos. |
| Runtime | SSR con adapter de Vercel. |
| Datos | Supabase Postgres con schema Drizzle. |
| Auth | Email y contraseña de Supabase; allowlist `admin_users` enlazada por UUID con fallback legacy por email. |
| Revelación | Pública mediante token, sin cuenta de participante. |
| Tokens | Aleatorios; solo se persiste SHA-256. |
| Email | Resend. |
| WhatsApp | Kapso con plantilla aprobada, reenvío explícito y webhook firmado. |
| Bebés | Se definen en la familia, reciben pero no regalan y carecen de contacto propio. |
| Regalo a bebés | Una unidad distinta regala a cada bebé; no se repiten unidades y el enlace llega a su representante. |
| Copia de enlaces | Es respaldo administrativo auditado, no un canal ni un estado de entrega. |
| Idioma | Textos de interfaz y documentación en español. |
| Commits | Prefijo tipado y descripción inglesa en pasado simple. |
| Entornos | Local y Vercel comparten el mismo Supabase/Postgres. |
| Migraciones | Drizzle es la única autoridad y se ejecuta manualmente. |
| Tokens recuperables | Hash para búsqueda y AES-256-GCM para entrega autorizada. |

## Abiertas

| Decisión | Por qué importa |
| --- | --- |
| Política de regeneración | Afecta sorpresa, invalidación y auditoría. |
| Entrega de tokens efímeros | Los hashes no permiten reconstruir URLs. |
| Transacciones e idempotencia | Evita sorteos parciales o duplicados. |
| RLS y grants | Protege datos personales y asignaciones. |
| Permisos multiadministrador | Define propiedad y colaboración. |
| Framework de pruebas | Habilita la estrategia de calidad. |
| Lint y formato | Reduce divergencia de estilo. |
| Alcance final del catálogo UI | Determina qué componentes adicionales de shadcn deben incorporarse al MVP. |

## Registro de decisiones arquitectónicas

Cuando una decisión abierta se cierre y tenga impacto amplio, crear:

```text
docs/adr/NNNN-titulo-breve.md
```

Plantilla:

```markdown
# NNNN — Título

- Estado: Propuesta | Aceptada | Sustituida
- Fecha: YYYY-MM-DD
- Responsables:

## Contexto

¿Qué problema o restricción obliga a decidir?

## Decisión

¿Qué se acordó?

## Alternativas

¿Qué opciones se consideraron?

## Consecuencias

¿Qué mejora, qué coste introduce y cómo se migra?
```

Una decisión aceptada debe reflejarse también en los documentos temáticos afectados. El ADR conserva el porqué; la
documentación principal explica el estado vigente.
