# UI y experiencia

## Dirección actual

La interfaz usa una estética navideña cálida con superficies redondeadas, sombras de claymorphism, tipografía grande y
acciones primarias muy visibles. La prioridad es que un organizador no técnico pueda completar el sorteo sin
interpretar conceptos internos.

Los criterios finales de design system siguen abiertos. Los tokens actuales en `src/styles/tokens.css` deben
considerarse la base existente, no una especificación cerrada.

## Navegación

La administración dispone de cuatro destinos:

- Inicio.
- Familia.
- Sorteo.
- Envíos.

La revelación utiliza un layout público separado y no muestra navegación administrativa.

## Responsabilidad de cada pantalla

### Login

- Explicar el acceso sin contraseña.
- Solicitar un único email.
- Informar de envío, error o configuración ausente.
- Evitar revelar si el email pertenece a la allowlist.

### Inicio

- Mostrar el grupo y año activos.
- Resumir participantes, contactos incompletos y estado del sorteo.
- Destacar una única siguiente acción.
- Permitir abrir una revelación demo solamente en modo desarrollo o demo.

### Familia

- Visualizar núcleos y sus personas.
- Crear, editar y desactivar sin perder contexto.
- Mostrar email, teléfono y preferencia.
- Señalar contactos incompatibles con el canal elegido.
- Preparar exclusiones sin mostrar complejidad innecesaria.

### Sorteo

- Mostrar reglas efectivamente cargadas, no texto fijo.
- Validar viabilidad antes de habilitar el botón.
- Solicitar confirmación si la acción es irreversible.
- No mostrar el mapa completo de asignaciones.
- Tras completar, dirigir al panel de envíos.

### Envíos

- Una fila por participante que regala.
- Estado independiente por canal.
- Copia manual sin revelar el receptor.
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
- CSS junto al componente cuando es específico.
- Tokens globales para color, espacio, radio y sombra.
- Lucide para iconografía React.

Antes de crear un componente nuevo se debe comprobar si `Button`, `Card`, `StatusBadge` o los patrones existentes
cubren el caso.

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

La UI demo actual no cubre todos estos estados.
