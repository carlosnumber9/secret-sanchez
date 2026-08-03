# Git y commits

## Regla obligatoria

Todos los commits deben seguir el formato:

```text
<type>(<scope opcional>): <descripción en pasado simple>
```

La descripción se escribe en inglés y en **pasado simple**, con mayúscula inicial, sin punto final.

Ejemplo de referencia:

```text
feat: Added Whatsapp integration over participants
```

Esta convención se aplica a todo el trabajo nuevo del repositorio.

## Tipos

| Tipo | Uso |
| --- | --- |
| `feat` | Se añadió capacidad de producto. |
| `fix` | Se corrigió un comportamiento defectuoso. |
| `docs` | Se modificó exclusivamente documentación. |
| `refactor` | Se reorganizó código sin cambiar comportamiento. |
| `test` | Se añadieron o corrigieron pruebas. |
| `build` | Se modificaron dependencias o build. |
| `ci` | Se modificó automatización de integración o despliegue. |
| `chore` | Mantenimiento que no encaja en los anteriores. |
| `perf` | Se mejoró rendimiento. |
| `style` | Se modificó formato o estilo sin cambiar lógica. |

El scope es opcional, breve y estable:

```text
feat(draw): Added manual exclusions
fix(auth): Handled invalid password attempts
docs(api): Documented draw responses
```

## Pasado simple

Se usan verbos como:

- `Added`
- `Updated`
- `Removed`
- `Fixed`
- `Handled`
- `Created`
- `Documented`
- `Protected`
- `Validated`
- `Migrated`

Ejemplos válidos:

```text
feat: Added participant persistence
fix: Prevented duplicate draw generation
docs: Documented the authentication flow
refactor(draw): Extracted assignment validation
test(draw): Covered impossible family combinations
```

Ejemplos no válidos:

```text
feat: Add participant persistence
feat: Adding participant persistence
updated stuff
WIP
fix auth.
```

## Contenido del commit

- Un commit debe representar una intención coherente.
- No mezclar refactors ajenos con una corrección.
- Incluir migraciones y documentación cuando sean parte inseparable del cambio.
- No confirmar `.env`, claves, tokens, URLs secretas o datos personales.
- Revisar `git diff --staged` antes de confirmar.
- No reescribir ni aplastar trabajo de otra persona sin coordinación.

Si hay un cambio incompatible se puede añadir `!` y un cuerpo explicativo:

```text
feat(api)!: Changed draw generation response
```

El cuerpo también debe explicar en pasado qué cambió, por qué y cómo migrar.

## Ramas

El historial actual utiliza `main`. Cuando se trabaje con ramas, se usarán ramas cortas y descriptivas:

```text
feature/participant-persistence
fix/auth-token-hash
hotfix/reveal-token-leak
release/1.0.0
```

La política completa de ramas `develop`, releases y hotfixes todavía no está implantada. No se debe afirmar que
existe un Git Flow completo hasta que se creen esas ramas y se acuerden sus reglas. La convención de mensajes
anterior sí es obligatoria desde ahora.

## Pull requests

Una propuesta debe incluir:

- Problema y resultado.
- Alcance y elementos deliberadamente excluidos.
- Cómo se validó.
- Impacto en datos, seguridad o despliegue.
- Capturas para cambios visuales relevantes.
- Migración y rollback cuando corresponda.
- Documentación actualizada.
