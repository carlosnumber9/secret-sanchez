# Decisiones

## Confirmadas

| Área | Decisión |
| --- | --- |
| Producto | El MVP está orientado al Amigo Invisible familiar de Reyes organizado inicialmente por Juan. |
| Frontend | Astro para páginas y React Islands para interacción. |
| Estilos | shadcn/ui `base-rhea` y Tailwind CSS 4; CSS propio para layout y contenedores translúcidos. |
| Runtime | SSR con adapter de Vercel. |
| Datos | Supabase Postgres con schema Drizzle. |
| Auth | Magic Link de Supabase y allowlist `admin_users`. |
| Revelación | Pública mediante token, sin cuenta de participante. |
| Tokens | Aleatorios; solo se persiste SHA-256. |
| Email | Resend. |
| WhatsApp | Kapso está previsto, pero no forma parte del MVP operativo actual. |
| Idioma | Textos de interfaz y documentación en español. |
| Commits | Prefijo tipado y descripción inglesa en pasado simple. |
| Entornos | Local y Vercel comparten el mismo Supabase/Postgres. |
| Migraciones | Drizzle es la única autoridad y se ejecuta manualmente. |
| Tokens recuperables | Hash para búsqueda y AES-256-GCM para entrega autorizada. |

## Abiertas

| Decisión | Por qué importa |
| --- | --- |
| Solicitud Magic Link desde cliente o servidor | Evita mantener dos caminos y contratos diferentes. |
| Bootstrap del primer administrador | Sin registro en `admin_users`, una sesión válida no accede. |
| Política de regeneración | Afecta sorpresa, invalidación y auditoría. |
| Entrega de tokens efímeros | Los hashes no permiten reconstruir URLs. |
| Transacciones e idempotencia | Evita sorteos parciales o duplicados. |
| RLS y grants | Protege datos personales y asignaciones. |
| Permisos multiadministrador | Define propiedad y colaboración. |
| Framework de pruebas | Habilita la estrategia de calidad. |
| Lint y formato | Reduce divergencia de estilo. |
| Alcance final del catálogo UI | Determina qué componentes adicionales de shadcn deben incorporarse al MVP. |
| Semántica de `delivered` y `opened` | Define webhooks y panel de envíos. |
| Flujo definitivo de Kapso | Define plantillas, webhooks, coste y privacidad. |

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
