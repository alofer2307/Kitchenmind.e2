# Arquitectura de KitchenMind

KitchenMind usa un núcleo único con módulos activados por organización.

## Superficies del producto

- **KitchenMind Platform** (`/platform`): superficie interna protegida en servidor con identidad propia, MFA, sesiones y auditoría durable.
- **Acceso productivo** (`/`): resuelve en servidor si la identidad debe entrar a Platform, elegir organización, continuar onboarding o abrir operación.
- **Espacio del cliente** (`/app`): dashboard tenant-aware con organización, sucursal, rol, módulos y conteos persistentes de configuración.
- **Centro de Calidad** (`/app/calidad` y `/app/calidad/[logId]`): plantillas versionadas, bitácoras, mediciones, evidencia privada y acciones correctivas persistentes.
- **Onboarding** (`/app/onboarding` y `/app/onboarding/[sectionCode]`): experiencia persistente, reanudable y sensible a entitlements.
- **Demo aislado** (`/demo`): conserva los módulos operativos heredados que aún usan el proveedor local; nunca es el destino predeterminado.

El perfil de negocio es una plantilla inicial, no una bifurcación del código. Una taquería y un comedor industrial comparten proveedores, servicios y repositorios; sólo cambian su configuración y entitlements.

## Flujo de dependencias

`UI → hooks → services → repositories → data provider`

- La UI presenta estado y captura intención; no consulta datos demo ni bases de datos.
- Los hooks coordinan carga, estados de espera y actualización reactiva.
- Los servicios contienen casos de uso y cálculos.
- Los repositorios definen contratos por dominio.
- `LocalDemoProvider` continúa únicamente como adaptador del demo explícito y de módulos operativos pendientes de migración.
- El dominio comercial usa `CommercialApplicationService → CommercialRepository → D1CommercialDataProvider`; ninguna pantalla ejecuta SQL ni consulta D1.
- `SupabaseProvider` sustituirá al proveedor demo sin reescribir pantallas.

La seguridad de Platform no utiliza el proveedor demo. Vive en D1 detrás de servicios de servidor y endpoints protegidos. Esta separación evita tratar un estado del navegador como autorización.

## Dominio comercial durable

Prospectos, contactos, seguimientos, diagnósticos, catálogo, versiones de precio y cotizaciones viven en D1. Los contratos de `repositories/commercial.contracts.ts` permiten reemplazar el adaptador por PostgreSQL/Supabase sin mover reglas a React.

El flujo autoritativo es:

`Platform UI → /api/platform/commercial → sesión + permiso → CommercialApplicationService → D1CommercialRepository → D1`

El motor de precios es una función de dominio pura. La UI solicita una vista previa al servidor y el servidor vuelve a calcular antes de persistir; nunca acepta totales enviados por el navegador.

## Multiempresa

Cada entidad operativa incluye `organizationId` y, cuando aplica, `branchId`. Los servicios siempre reciben el alcance antes de consultar o mutar. En producción, esta separación también se impondrá con Row Level Security.

## Resolución del acceso

`sesión nativa KitchenMind → sesión Platform o membresías cliente → estado de organización → onboarding o /app`

El navegador no decide el tenant. `/` consulta primero la puerta de Platform; si la identidad no es interna, `CustomerOnboardingService.customerAccess` devuelve únicamente membresías persistentes autorizadas. Una organización única se selecciona automáticamente y varias abren `/app/organizaciones`.

El inicio productivo consulta `/api/customer/dashboard`. `CustomerDashboardService` valida la entrada y delega en `D1DashboardRepository`, que vuelve a resolver identidad, membresía, estado de organización, permisos, scopes, módulos, features, preset, overrides, preferencias y filtros antes de consultar read models. Cambiar `organizationId` o `branchId` en la URL no concede acceso.

Los módulos operativos heredados todavía conservan persistencia demostrativa local y se migrarán dominio por dominio. La identidad productiva del cliente ya se obtiene de la autenticación nativa de KitchenMind; credenciales, sesiones, membresía, rol y alcance se resuelven en servidor y D1. Una migración futura podrá sustituir este proveedor por Supabase Auth y D1 por PostgreSQL/RLS sin mover reglas a los componentes. La cuenta de fundadora mantiene controles independientes descritos en `docs/platform-security.md`.

## Agregar una sucursal

1. Obtener el repositorio `provider.branches`.
2. Crear el registro con `organizationId`, código, zona horaria y estado.
3. Asignar usuarios y dispositivos autorizados a la sucursal.
4. No introducir nombres o límites de sucursal en componentes.

## Sprint C: aprovisionamiento productivo

El nuevo flujo durable es:

`Cotización aceptada → PlatformTenancyService → D1TenancyRepository → organización + alcance + onboarding + invitación`

La cotización aceptada permanece inmutable y se usa como snapshot comercial. `provisioning_requests.quote_id` e `idempotency_key` evitan crear dos organizaciones. La identidad de cliente procede de la sesión nativa KitchenMind, pero la autorización se resuelve con una membresía persistente, permisos de rol, alcance y entitlement; ningún `organizationId` enviado por el navegador es autoridad.

Las rutas cliente usan `/api/customer/onboarding`. Las rutas internas usan `/api/platform/tenancy` y conservan sesión Platform, MFA y permisos separados. Los módulos operativos demo continúan intactos mientras se migran dominio por dominio a los repositorios tenant-aware.

## Sprint D: centro operativo dinámico

La cadena productiva es:

`UI → useDashboardQuery → CustomerDashboardService → resolver → D1DashboardRepository → D1`

`/app` usa un preset inicial por rol y perfil, aplica overrides de organización y después preferencias personales. Finalmente elimina widgets que no cumplen módulo, feature, permiso o scope. El resultado incluye explicación del preset, frescura, capacidades y enlaces permitidos. `/platform/catalogo/dashboard` usa una API separada protegida por sesión Platform, MFA y permisos `platform.dashboard_catalog.*`.

La caché D1 dura 60 segundos y su clave incorpora organización, membresía, sucursal, periodo y versión de configuración. Nunca es una autorización: cada lectura vuelve a validar la membresía antes de reutilizarla.

## Sprint E: calidad e inocuidad operativa

La cadena productiva es:

`UI de Calidad → useQualityQuery → TenantQualityService → reglas puras → TenantQualityRepository → D1 + almacenamiento privado de objetos`

Las plantillas publicadas y las bitácoras cerradas son inmutables. Una corrección crea una revisión enlazada; no reescribe el original. Los valores numéricos se evalúan en servidor con precisión fija de milésimas, las desviaciones crean acciones correctivas y cada mutación relevante invalida la caché del dashboard de la organización.

D1 conserva metadatos, hash SHA-256, autor, alcance y relaciones de las evidencias. Los binarios deben vivir en un almacenamiento privado de objetos; el adaptador de Vercel queda como integración explícita pendiente. La descarga, cuando el adaptador esté activo, debe exigir de nuevo identidad, membresía, permiso, entitlement de `QUALITY` y scope de sucursal; conocer una URL u objeto no concede acceso.

## Sprint E.2: Personal, dispositivos y asistencia

La cadena productiva es:

`UI de Personal/Kiosco → API tenant o API de dispositivo → TenantOperationsService → reglas de asistencia → OperationalRepository → D1`

Las rutas administrativas resuelven sesión nativa, membresía, estado, permiso, entitlement `PERSONNEL` y scope. La API del kiosco usa una credencial independiente vinculada a un dispositivo activo, sucursal activa y organización activa. El token se entrega una vez; D1 conserva únicamente SHA-256 y prefijo de identificación.

El bridge biométrico es una frontera intercambiable. KitchenMind recibe `provider + externalTemplateId`, no una huella. La captura online aplica idempotencia y una guarda atómica anti-rebote; los lotes offline conservan batch, ítems, resultados y reintentos sin duplicar el evento.

Las consultas construyen proyecciones por permiso. Un rol con acceso sólo al directorio obtiene empleados, pero no credenciales biométricas, eventos de asistencia, dispositivos, sincronizaciones ni métricas derivadas de esos dominios. Comensales permanece fuera de las superficies productivas de E.2.
