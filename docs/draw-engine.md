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

## Persistencia

1. Autorizar al administrador sobre el grupo.
2. Cargar participantes, `draw_rules` y `exclusion_rules`.
3. Validar contactos y viabilidad.
4. Bloquear la edición y rechazar otro intento vigente.
5. Generar todo el reparto en memoria.
6. Crear el intento numerado, snapshots y asignaciones con hash y token cifrado.
7. Actualizar la edición y confirmar la transacción.
8. Preparar envíos posteriores, fuera de la transacción.

El panel administrativo nunca devuelve receptores. Los tokens solo se descifran en servidor para email o copia
manual autorizada.

## Revocación y relanzamiento

Juan puede revocar el intento vigente escribiendo `ANULAR REPARTO`. El intento pasa a `revoked`, conserva snapshots, asignaciones y logs, y sus tokens dejan de resolver. La edición vuelve a preparación y el siguiente intento recibe un número y tokens nuevos. La interfaz advierte que no puede deshacer una asignación ya conocida.

El borrado de una persona es distinto: elimina completos todos los intentos en los que aparece para no conservar repartos incompletos.

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
