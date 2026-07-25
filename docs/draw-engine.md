# Motor de sorteo

## Objetivo

Generar una asignación uno-a-uno entre participantes activos que respete todas las restricciones y no revele el
reparto completo en la interfaz administrativa.

## Entrada

Cada participante aporta:

- `id`
- `familyIslandId`
- `active`
- `canGive`
- `canReceive`

La configuración aporta:

- `noSameIsland`
- Pares dirigidos de exclusión manual.

Los datos de contacto y el canal preferido no influyen en el reparto.

## Invariantes

Un resultado válido cumple:

1. Hay al menos dos personas que pueden regalar.
2. El número de quienes regalan coincide con el de quienes reciben.
3. Cada persona que regala tiene exactamente un receptor.
4. Cada receptor aparece exactamente una vez.
5. Nadie se asigna a sí mismo.
6. Nadie inactivo participa.
7. Se respetan `canGive` y `canReceive`.
8. Si la regla está activa, no hay asignaciones dentro del mismo núcleo.
9. Ninguna asignación coincide con una exclusión manual.

## Algoritmo

1. Filtra y baraja las personas que pueden regalar.
2. Construye la lista de receptores válidos.
3. Para cada persona, baraja sus candidatos.
4. Intenta una asignación y marca el receptor como usado.
5. Si el resto no tiene solución, deshace esa elección.
6. Al completar el conjunto, ejecuta una validación independiente.

El barajado usa `crypto.randomInt`; no es reproducible mediante seed. Backtracking garantiza que se exploren
alternativas, aunque el coste puede crecer en grupos muy grandes o muy restringidos. El caso familiar esperado es
pequeño.

## Errores de dominio

El servicio devuelve mensajes comprensibles cuando:

- Hay menos de dos participantes.
- No coincide el número de personas que dan y reciben.
- No existe solución para las reglas.
- La validación detecta una asignación inválida.

Estos errores deben mostrarse sin crear registros parciales.

## Persistencia actual

La acción de aplicación:

1. Carga participantes del grupo.
2. Ejecuta el dominio con `noSameIsland: true` y sin exclusiones.
3. Inserta un sorteo `generated`.
4. Crea un token por asignación.
5. Guarda el hash y devuelve temporalmente la URL.

## Bloqueo actual de los tokens

El endpoint reduce el resultado a `{ ok, message }`. No devuelve las URLs ni llama a notificaciones. Como el token en
claro no se almacena —decisión correcta de seguridad—, al terminar la petición desaparece la única información que
permite construir los enlaces.

No se debe habilitar el sorteo persistente en la UI hasta que la misma operación:

- Envíe inmediatamente las URLs por los canales elegidos, o
- Devuelva las URLs una única vez a una superficie segura para copia manual, o
- Combine ambos comportamientos con una política explícita.

Nunca se debe resolver el problema guardando tokens en claro de forma indefinida.

## Flujo persistente objetivo

1. Autorizar al administrador sobre el grupo.
2. Cargar participantes, `draw_rules` y `exclusion_rules`.
3. Validar contactos y viabilidad.
4. Generar todo el reparto en memoria.
5. Abrir una transacción.
6. Crear el sorteo y las asignaciones con hashes.
7. Actualizar estados del sorteo y grupo.
8. Confirmar la transacción.
9. Entregar los enlaces y crear logs por intento.
10. Mostrar un resumen sin receptores.

El envío externo no debe mantener una transacción de base de datos abierta. Se puede confirmar el sorteo y procesar
notificaciones de forma idempotente después.

## Regeneración

Antes de implementarla se debe decidir:

- Quién puede regenerar.
- Si requiere confirmación reforzada.
- Qué ocurre con los logs anteriores.
- Cómo se invalidan inmediatamente los tokens previos.
- Si se conserva el sorteo anterior como audit trail.
- Cuándo un sorteo pasa a `locked`.

La opción más segura para el MVP es conservar versiones, marcar una como vigente e invalidar las anteriores.

## Pruebas mínimas

- Dos participantes de núcleos distintos.
- Ninguna solución por pertenecer todos al mismo núcleo.
- Exclusión dirigida.
- Participantes inactivos.
- `canGive` y `canReceive` desequilibrados.
- Muchos sorteos aleatorios validando invariantes.
- Regresión para receptores duplicados.
- Persistencia atómica ante error.
- Regeneración e invalidación de tokens.
