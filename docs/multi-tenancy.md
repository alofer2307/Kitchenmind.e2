# Multi-tenancy

## Alcance

Todas las entidades operativas incluyen `organizationId`; cuando corresponde también incluyen `branchId`. Los eventos conservan actor, dispositivo, fecha e idempotencia.

La selección visual de una organización no constituye seguridad. El flujo productivo obtiene el tenant autorizado desde la identidad y la membresía persistente. D1 no ofrece RLS, por lo que el repositorio impone el filtro; PostgreSQL añadirá RLS como defensa adicional.

## Reglas para Supabase

- Una membresía relaciona identidad, organización, rol y alcance de sucursales.
- Ninguna política acepta `organizationId` del navegador como prueba de autorización.
- Cada tabla expuesta habilita RLS y tiene índices por `organization_id` y fechas de consulta.
- Las operaciones del panel KitchenMind se ejecutan en servidor con credenciales protegidas y auditoría.
- Los eventos de asistencia, servicio, inventario y auditoría usan inserción idempotente.
- Las pruebas intentan acceso cruzado entre dos organizaciones y deben recibir cero filas o rechazo.

## Separación de conceptos

- **Perfil**: recomendación inicial de producto.
- **Plan**: límites y módulos comercialmente disponibles.
- **Organización**: cliente y configuración operativa.
- **Suscripción**: ciclo y estado de cobro.
- **Usuario**: identidad con acceso al sistema.
- **Empleado**: persona operativa, con o sin cuenta.

## Estado implementado en D1

Los repositorios productivos reciben el tenant desde una membresía validada en servidor. Las consultas de onboarding, sucursales, áreas, almacenes, empleados y catálogos incluyen `organization_id`; las relaciones entre sucursal, almacén, producto y movimiento se verifican antes de insertar.

La matriz de autorización es:

`sesión nativa → usuario cliente → membresía activa → rol → permiso → alcance → entitlement → recurso del tenant`

Las pruebas crean dos organizaciones e intentan abrir la segunda con la identidad de la primera. El repositorio rechaza el acceso sin revelar sus datos. D1 no ofrece RLS, por lo que esta garantía vive en las rutas, servicios y repositorios; la traducción a políticas PostgreSQL está documentada en `future-supabase.md`.

## Selección de organización y sucursal

- `customerAccess` parte de `auth_user_id` y correo normalizado y devuelve solo membresías activas o suspendidas de esa identidad.
- El selector muestra únicamente ese resultado; una preferencia de interfaz nunca se usa como autorización.
- `customerWorkspace` vuelve a resolver la membresía y exige `organization.read`.
- Las sucursales se intersectan con `membership_scopes`. Una sucursal enviada por URL debe pertenecer a ese conjunto.
- Los conteos del dashboard incluyen siempre `organization_id` y la sucursal validada.
- Entitlements temporales se resuelven en servidor, incluyendo overrides vigentes.
- Al cambiar de organización se solicita un snapshot nuevo; no se conserva el snapshot anterior como fuente de datos.

## Aislamiento del dashboard

El resolver no acepta un tenant confiando en la URL. Parte de `auth_user_id` y correo, obtiene únicamente membresías activas y después intersecta sucursales con `membership_scopes`. Cada read model recibe `organization_id` y, cuando corresponde, el `branch_id` ya autorizado. Los widgets se eliminan antes de consultar o responder si falta un módulo, feature o permiso.

La clave de caché incluye `organization_id`, `membership_id`, sucursal, periodo, rol, permisos, módulos, features, preset, preferencia y stamps de catálogo/overrides. Por ello no se comparte un snapshot entre personas, organizaciones o configuraciones. Suspender una membresía u organización impide llegar a la lectura en caché.
