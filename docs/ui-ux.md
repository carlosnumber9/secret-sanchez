# UI y experiencia

## Dirección actual

La base visual implementada usa el preset shadcn `bgo6OSRWs` (`base-rhea`): paleta stone con primario rojo,
tipografías Outfit y Noto Sans, radios amplios y componentes compactos basados en Base UI. La prioridad es que un
organizador no técnico pueda completar el sorteo sin interpretar conceptos internos.

Los contenedores son la única adaptación deliberada al preset: tarjetas, paneles, filas y cabecera usan los mismos
colores semánticos con una translucidez contenida, saturación suave y `backdrop-filter`. Los tokens de vidrio viven
en `src/styles/tokens.css` y también alimentan la primitiva `Card`; el resto de controles debe mantenerse alineado con
el preset.

El layout base incorpora un regalo 3D ambiental de Kenney. Se mantiene desenfocado y con baja opacidad en una capa
fija situada siempre detrás de la interfaz. Rota y rebota por el viewport, puede salir parcialmente de pantalla y no
captura interacción. La animación se detiene cuando la pestaña queda oculta y se muestra estática si el sistema
solicita movimiento reducido.

## Navegación

La administración dispone de tres destinos principales:

- Inicio.
- Familia.
- Ediciones.

Sorteo y Envíos viven dentro de la edición elegida explícitamente.

La revelación utiliza un layout público separado y no muestra navegación administrativa.

## Responsabilidad de cada pantalla

### Login

- Explicar que el acceso está reservado a organizadores autorizados.
- Solicitar email y contraseña con autocompletado apropiado.
- Informar de validación, error o exceso de intentos.
- Evitar revelar si el email pertenece a la allowlist.

### Inicio

- Mostrar la familia maestra.
- Resumir núcleos, participantes y ediciones.
- Destacar una única siguiente acción.
- Advertir que local y Vercel comparten los mismos datos reales.

### Familia

- Visualizar cada unidad y sus personas en tablas compactas.
- Abrir las altas de unidad y participante desde dos botones de icono y formularios en diálogos HTML nativos.
- Exigir una unidad existente y seleccionada para dar de alta una persona; el formulario permite omitir el contacto y solo se habilita cuando el nombre y cualquier dato introducido son válidos.
- Editar email y teléfono directamente en las filas de `/familia`, como parte del borrador pendiente de `Guardar familia`.
- Mantener altas, ediciones, borrados y movimientos como borrador local y persistirlos juntos en una sola transacción al pulsar `Guardar familia`.
- Advertir con el diálogo nativo del navegador antes de abandonar la ruta cuando el borrador tiene cambios sin guardar.
- Reordenar unidades únicamente para organizar la vista actual, sin persistir ese orden.
- Marcar bebés mediante su icono y reforzar ese estado con una fila rosa y texto accesible.
- Crear, editar y eliminar con previsualización de impacto.
- Mostrar email, teléfono y preferencia.
- Señalar contactos incompatibles con el canal elegido.
- No mezclar el censo con la participación de una edición.

### Edición y sorteo

- Mostrar reglas efectivamente cargadas, no texto fijo.
- Validar viabilidad antes de habilitar el botón.
- Configurar núcleos, participantes y roles antes del reparto.
- Solicitar confirmación al generar, revocar o borrar.
- No mostrar el mapa completo de asignaciones.
- Tras completar, dirigir al panel de envíos.

### Envíos

- Una fila por participante que regala.
- Estado independiente por canal.
- Copia de respaldo sin revelar el receptor.
- Reintento individual y masivo con feedback.
- Diferenciar falta de contacto, pendiente, enviado, entregado y fallido.

### Revelación

- Funcionar correctamente en móvil.
- Mostrar a quién regala solamente después de una interacción clara.
- Explicar enlaces inválidos o sustituidos sin información sensible.
- Evitar cualquier dato del resto de participantes.

## Componentes y estilos

- Astro para contenido estático y estructura.
- React solo para interacción y estado cliente.
- Tailwind CSS 4 mediante el plugin oficial de Vite para Astro.
- shadcn/ui con configuración en `components.json` y componentes generados en `src/components/ui`.
- Wrappers Astro existentes conectados a las variantes del preset para mantener una API estable en las páginas.
- CSS junto al componente solo para layout o superficies translúcidas específicas.
- Colores, tipografías, radios, controles e iconos Lucide definidos por el preset.

Antes de crear un componente nuevo se debe comprobar si existe en `src/components/ui` o puede añadirse con el CLI de
shadcn. `Button`, `Card` y `StatusBadge` conservan wrappers Astro para las páginas existentes.

## Ritmo y composición

- `page-shell` controla el ancho máximo y el gutter lateral fluido de todas las páginas.
- `page-stack` separa cabecera de página, acciones y contenido principal; `stack` se reserva para contenido interno.
- Las superficies usan `CardContent` o `--surface-padding`; no se inserta contenido directamente contra el borde de
  una tarjeta.
- Los formularios mantienen etiqueta, control, ayuda, acción y feedback en ese orden.
- Las acciones primarias alcanzan al menos 40–44 px de altura y ocupan todo el ancho disponible en móvil cuando
  compiten por espacio.
- Las filas y paneles conservan un padding mínimo de 16 px en móvil y aumentan de forma fluida en escritorio.
- La navegación móvil se desplaza horizontalmente en una sola línea para evitar saltos de altura impredecibles.
- Los estados asíncronos deshabilitan su acción, exponen feedback textual y usan regiones `aria-live` cuando procede.

## Accesibilidad mínima

- Navegación y formularios completos con teclado.
- `label` asociado a cada campo.
- Estado comunicado mediante texto, no solo color.
- `role="status"` para acciones asíncronas importantes.
- Foco visible.
- Contraste suficiente sobre superficies translúcidas.
- Texto alternativo o `aria-label` en botones de icono.
- Respeto por `prefers-reduced-motion` para animaciones.

## Estados obligatorios

Cada bloque que cargue datos reales debe diseñar:

- Cargando.
- Vacío.
- Error recuperable.
- Sin autorización.
- Éxito.
- Acción en curso y prevención de doble envío.

Las mutaciones principales implementan carga, feedback y prevención de doble envío.

## Identidad visual e instalación

- El icono implementado combina una caja de regalo crema con una cinta dorada en forma de interrogación sobre fondo
  rojo. El regalo comunica la celebración y la interrogación representa el carácter anónimo del sorteo.
- `public/favicon.svg` es la fuente vectorial del icono.
- La cabecera reutiliza esa fuente vectorial como marca del producto.
- El layout base publica favicon PNG, `apple-touch-icon` y `site.webmanifest`.
- El fondo 3D reutiliza `present-a-cube.glb` y su textura del Holiday Kit de Kenney bajo licencia CC0; la procedencia
  queda registrada junto al asset.
- El manifest incluye iconos de 192 y 512 píxeles, además de una variante `maskable`, para accesos directos e
  instalación desde navegadores móviles compatibles.
# UI y experiencia

## Navegación administrativa

- `Inicio`: resumen de la familia y accesos principales.
- `Familia`: censo permanente, contactos, movimientos y borrado destructivo.
- `Ediciones`: historial, creación y selección explícita.
- Dentro de una edición: configuración, reparto, reversión y envíos.

La navegación nunca elige implícitamente “el último sorteo”. `/sorteo` y `/envios` redirigen al listado de ediciones.

## Estados peligrosos

- Revocar exige escribir `ANULAR REPARTO` y explica que lo ya visto no puede olvidarse.
- Borrar una persona muestra intentos, asignaciones, logs y aperturas afectados y exige `ELIMINAR PERSONA`.
- Borrar una unidad permite mover integrantes o confirmar `ELIMINAR UNIDAD`.
- Las ediciones de prueba muestran de forma persistente que los emails se redirigen al administrador.

## Configuración de participantes

Cada edición agrupa a la familia por unidades. El switch de la unidad prevalece sobre los controles individuales. Los bebés se marcan únicamente en `/familia` y aparecen como etiqueta no editable: reciben, no regalan y no muestran canales. Cada unidad selecciona un representante adulto. La pantalla separa adultos, bebés, regaladores, receptores y unidades preparadas. Email y WhatsApp solo pueden seleccionarse cuando la persona tiene el dato correspondiente en la familia; una persona puede permanecer en el censo sin ningún contacto.

En envíos, Email y WhatsApp muestran estados independientes. Juan puede seleccionar asignaciones para reenviar y copiar cualquier enlace mediante un icono; la copia es un respaldo y no altera los estados.
