# Sistema de experiencia de KitchenMind

## Principio visual

La interfaz se organiza alrededor de un **centro de atención operativa**: el primer viewport responde qué espacio está abierto, qué necesita acción y cuál es el siguiente paso. El fondo claro sostiene superficies blancas; azul profundo identifica contexto y seguridad; turquesa señala progreso y acciones principales.

## Jerarquía

1. Contexto: organización, sucursal, identidad y rol.
2. Atención: bloqueos y siguiente acción.
3. Estado: conteos persistentes y avance calculado.
4. Alcance: módulos contratados y configuración disponible.

No se usan números ficticios para llenar tarjetas. Un cero es un estado válido y debe acompañarse de una acción útil. Los módulos que todavía no tienen repositorios operativos productivos se describen como configuración disponible o transición pendiente.

## Responsive y accesibilidad

- Ancho mínimo soportado: 320 px; objetivos de QA desde 360×800.
- Controles táctiles principales de al menos 40–48 px.
- Tablas de Platform se transforman en tarjetas cuando el ancho no permite lectura segura.
- Navegación móvil fija con espacio para `safe-area-inset-bottom`.
- Estados de carga, vacío, error, restricción y éxito conservan título, explicación y siguiente acción.
- Contraste funcional entre azul profundo, superficies claras, turquesa, advertencia y error.
- El foco y la semántica proceden de los componentes de UI; los selectores incluyen etiquetas accesibles.

## Fuente de verdad

Las pantallas productivas usan D1 mediante servicios y repositorios. React administra interacción temporal; no es la base de datos. `localStorage` e IndexedDB quedan limitados al demo y al apoyo offline temporal, respectivamente.
