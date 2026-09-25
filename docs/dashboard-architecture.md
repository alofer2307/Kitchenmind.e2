# Arquitectura de dashboards

## Flujo productivo

`/app → useDashboardQuery → /api/customer/dashboard → CustomerDashboardService → D1DashboardRepository → D1`

La API de cliente toma la identidad de la sesión nativa KitchenMind validada en servidor. El navegador puede solicitar organización, sucursal y periodo, pero esos valores son filtros, no autoridad.

El resolver aplica este orden:

1. valida identidad;
2. resuelve usuario, membresía activa y organización;
3. rechaza organizaciones fuera de estado `active` o `restricted`;
4. resuelve módulos y features con overrides vigentes;
5. resuelve permisos de los roles;
6. intersecta sucursales con scopes;
7. elige preset desde `role_dashboard_defaults` o `business_profile_dashboard_defaults`, respetando la prioridad persistente;
8. aplica overrides organizacionales vigentes;
9. aplica la preferencia personal y sus filtros predeterminados validados;
10. elimina widgets sin módulo, feature, permiso o scope;
11. valida filtros y normaliza la zona horaria de la sucursal, con cortes por día calendario local;
12. consulta read models con `organization_id` y la intersección exacta de sucursales autorizadas, incluso en agregaciones multisucursal;
13. devuelve valores, estado de fuente, frescura, explicación y capacidades.

Las rutas son `/app`, `/app/dashboard`, `/app/sucursales`, `/app/sucursales/[branchId]` y `/app/configuracion/dashboard`. El catálogo global vive en `/platform/catalogo/dashboard` y usa sesión Platform, MFA y permisos independientes.

## Extensión

La UI no ejecuta SQL ni compone permisos. Para agregar una fuente se implementa en `DashboardRepository`, se documenta en el catálogo de métricas y se prueba con dos tenants. El contrato permite reemplazar D1 por PostgreSQL sin cambiar los componentes.
