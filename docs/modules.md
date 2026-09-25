# Módulos

Las organizaciones activan módulos mediante `activeModules`.

| Clave | Alcance |
| --- | --- |
| `core` | Dashboard, organización, sucursales, usuarios, roles y configuración |
| `personnel` | Empleados, turnos, asistencia, retardos y ausencias |
| `services` | Comensales, escaneo, tipos de servicio y conteos |
| `quality` | Bitácoras estructuradas, incidencias y acciones correctivas |
| `inventory` | Productos, lotes, caducidad, movimientos y rotación |
| `purchasing` | Proveedores, órdenes, recepción y precios |
| `production` | Menús, recetas, escandallos y consumos |
| `finance` | Costos y rentabilidad |
| `kiro` | Hallazgos y recomendaciones explicables |

Un módulo desactivado no debe habilitar rutas ni permisos asociados. En el proveedor Supabase, el control visual se complementará con autorización y RLS.

Los perfiles de negocio sólo recomiendan una combinación inicial. El plan define el máximo comercial disponible y la organización selecciona el subconjunto que realmente utilizará. `CORE` permanece siempre activo.

## Agregar un rol

Crear un registro en el repositorio de roles con permisos explícitos. Nunca usar el nombre visible del rol como regla de autorización.
