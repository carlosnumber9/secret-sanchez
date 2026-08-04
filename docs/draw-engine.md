# Motor de sorteo

## Dos capas del reparto

El intento se genera de forma transaccional mediante dos emparejamientos independientes.

### Adultos

- Solo entran adultos activos.
- El número de adultos regaladores debe coincidir con el de receptores.
- Cada regalador y receptor aparece una sola vez.
- Se evitan autoasignación, misma unidad y exclusiones dirigidas.
- Se utiliza backtracking con barajado mediante `crypto.randomInt`.

### Bebés

- Cada bebé activo recibe exactamente un regalo y nunca aparece como regalador personal.
- El regalador es una unidad familiar con representante válido.
- La unidad no puede ser la del bebé.
- Una unidad regala como máximo a un bebé.
- Una unidad que contiene bebés puede regalar a otro bebé.
- El mismo backtracking aleatorio busca una solución completa o rechaza el sorteo sin persistencia parcial.

Con el censo familiar acordado se generan 21 asignaciones adultas y 6 asignaciones de unidades para bebés.

## Validación previa

Antes de crear el intento se validan roles, igualdad adulta, representantes, canales, contactos y viabilidad de ambas capas. Solo los adultos que regalan y los representantes necesitan un canal automático porque son quienes reciben enlaces.

## Persistencia

1. Se bloquea la edición y se rechaza otro intento vigente.
2. Se generan ambas capas en memoria.
3. Se crean `draw_participants` y `draw_islands` con contactos y canales congelados.
4. Cada asignación recibe hash y ciphertext AES-256-GCM del token.
5. Se confirma el intento y la edición en una transacción.

El panel administrativo muestra a quién pertenece cada enlace, pero nunca el receptor. Las APIs públicas resuelven el receptor únicamente mediante un token de un intento no revocado.

## Revocación

`ANULAR REPARTO` conserva el intento y su historial, invalida sus tokens y desbloquea la edición. El siguiente intento usa un número y secretos nuevos. La información ya revelada no puede deshacerse.

## Pruebas

Las pruebas repiten las invariantes adultas y el escenario de 9 unidades y 6 bebés, comprobando unidades distintas, ausencia de asignación propia e imposibilidad explícita cuando faltan unidades.
