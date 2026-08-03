# Calidad y pruebas

## Estado actual

- `npm run build` ejecuta `astro check` y el build SSR.
- TypeScript usa la configuración estricta de Astro.
- Existe una suite unitaria con el runner nativo de Node y `tsx`.
- No hay scripts separados de lint o formato.
- No hay CI en el repositorio.

El build es el único control automático actual y debe ejecutarse antes de cerrar cambios de código.

## Objetivos

1. Proteger las invariantes del sorteo.
2. Evitar pérdida o exposición de tokens.
3. Verificar autorización por grupo.
4. Comprobar contratos de API.
5. Cubrir el recorrido crítico del organizador y la revelación.
6. Mantener accesibilidad básica y estados de error.

## Estrategia propuesta

La selección de herramientas sigue abierta; los niveles de prueba no dependen de un framework concreto.

### Unitarias

Prioridad máxima para código de dominio:

- `canAssign`.
- `validateDraw`.
- `generateDraw`.
- Hash y construcción de URLs.
- Selección de canales de notificación.

Las pruebas del sorteo deben repetir generaciones y validar invariantes, no afirmar una asignación aleatoria exacta.

### Integración

- Queries contra una base aislada.
- Creación atómica de sorteo y asignaciones.
- Restricciones e índices.
- Login por contraseña y cookies de Supabase con dobles controlados.
- Registro de notificaciones y reintentos.
- Lectura y marcado de una revelación.

### End-to-end

Recorrido mínimo:

1. Login de administrador.
2. Creación o carga del grupo.
3. Alta de núcleos y participantes.
4. Generación.
5. Acceso al panel de envíos.
6. Apertura de un enlace.

También debe cubrir sesión ausente, grupo ajeno, token inválido y sorteo imposible.

## Matriz de riesgo

| Área | Riesgo | Prioridad |
| --- | --- | --- |
| Sorteo | Asignación inválida o duplicada | Crítica |
| Tokens | Pérdida o exposición | Crítica |
| Autorización | Acceso a otro grupo | Crítica |
| Migraciones | Pérdida de datos | Alta |
| Notificaciones | Duplicados o entrega incorrecta | Alta |
| Auth | Credenciales o sesión rechazadas incorrectamente | Alta |
| UI administrativa | Estado inconsistente | Media |
| Estilos | Regresión visual | Media |

## Validación manual mientras no haya suite

- Ejecutar `npm run build`.
- Probar viewport móvil y escritorio.
- Navegar solo con teclado en formularios y acciones.
- Comprobar mensajes de carga, error y éxito.
- Confirmar que la consola y las respuestas no muestran secretos.
- Probar sesión válida, inválida y usuario no autorizado.
- Probar `/r` sin fragmento y con un token inexistente.
- Para cambios de algoritmo, ejecutar casos pequeños e imposibles con datos controlados.

## CI objetivo

Una primera pipeline debería:

1. Instalar con `npm ci`.
2. Ejecutar build.
3. Ejecutar pruebas unitarias.
4. Ejecutar lint cuando se defina.
5. Verificar que las migraciones están actualizadas.

No debe requerir secretos reales para validar una pull request.

## Decisiones pendientes

- Framework de pruebas.
- Base aislada o contenedorizada para integración.
- Herramienta end-to-end.
- Lint y formateador.
- Umbral de cobertura.
- Estrategia de regresión visual.
