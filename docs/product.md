# Producto

## Visión

Secret Sánchez elimina la parte incómoda de organizar un Amigo Invisible familiar: reunir participantes, respetar
restricciones entre hogares, hacer un reparto válido y comunicarlo sin que el organizador tenga que revelar el
resultado completo.

El contexto inicial es el Amigo Invisible de Reyes de una familia concreta y el organizador principal es Juan. La
arquitectura admite más grupos y años, pero convertirlo en una plataforma pública multiusuario no forma parte del MVP
actual.

## Usuarios

### Organizador

Juan prepara el evento y necesita:

- Saber qué falta antes de sortear.
- Agrupar a las personas por núcleo familiar.
- Mantener contactos y preferencias de entrega.
- Definir restricciones sin entender el algoritmo.
- Generar un reparto válido con una acción clara.
- Entregar o copiar los enlaces secretos.
- Identificar errores, reintentar y saber qué enlaces se han abierto.

### Participante

Cada familiar necesita:

- Recibir un único enlace privado.
- Entender que no debe compartirlo.
- Descubrir de forma sencilla a quién hace el regalo.
- No crear una cuenta ni iniciar sesión.

## Principios de producto

1. **La sorpresa es prioritaria.** La administración no debe mostrar el reparto completo por defecto.
2. **El siguiente paso debe ser evidente.** El organizador no debería buscar qué queda pendiente.
3. **La familia se modela como vive.** Los núcleos permiten evitar regalos dentro del mismo hogar.
4. **La entrega admite excepciones.** Email y WhatsApp son automáticos; la copia por Juan es solo un respaldo.
5. **Un error no debe destruir un sorteo válido.** Regenerar, reenviar o corregir contactos requiere políticas
   explícitas.
6. **La privacidad vence a la comodidad.** Los tokens se buscan por hash, se cifran para entrega autorizada y sus secretos permanecen en servidor.

## Alcance del MVP

El MVP queda completo cuando existe un recorrido real y verificable:

1. Un administrador autorizado entra con email y contraseña.
2. Mantiene una familia maestra con núcleos, participantes y contactos.
3. Crea una edición de prueba o definitiva.
4. Activa personas y unidades, configura roles y canales y elige representantes.
5. La aplicación valida que el reparto es viable.
6. Genera un intento persistente que puede revocar y relanzar.
7. Cada regalador adulto o representante recibe automáticamente su enlace vigente.
8. El participante abre la revelación sin login.
9. El organizador consulta envíos, fallos, aperturas e intentos anulados.

## Fuera del alcance actual

- Registro público y autoservicio para cualquier organizador.
- Pagos o planes comerciales.
- Aplicaciones móviles nativas.
- Chat entre participantes.
- Listas de deseos o presupuesto del regalo.
- Emparejamientos entre grupos independientes.
- Automatizaciones complejas de campañas.

Estas ideas pueden evaluarse más adelante, pero no deben retrasar el recorrido principal.

## Conceptos

- **Familia:** censo permanente de núcleos y personas.
- **Edición:** preparación de prueba o definitiva asociada a una familia y un año.
- **Núcleo:** hogar o unidad familiar usada como restricción.
- **Participante:** persona que puede regalar, recibir o ambas cosas.
- **Bebé:** participante que recibe, no regala y no tiene contacto propio.
- **Representante:** adulto que recibe el enlace cuando su unidad regala a un bebé.
- **Intento de sorteo:** ejecución concreta, vigente o revocada, que contiene snapshots y asignaciones.
- **Asignación:** relación privada entre quien regala y quien recibe.
- **Enlace de revelación:** URL con un token secreto de una asignación.
- **Copia de respaldo:** el organizador obtiene y comparte un enlace fuera de la aplicación sin alterar su estado de entrega.
