# Permisos de dashboard

Permisos base:

- `dashboard.read`
- `dashboard.configure_self`
- `dashboard.configure_organization`
- `dashboard.export`
- `dashboard.view_cross_branch`
- `dashboard.view_sensitive_costs`
- `dashboard.view_employee_details`
- `dashboard.view_quality_details`
- `dashboard.view_inventory_details`
- `dashboard.view_purchase_details`
- `dashboard.view_service_billing`
- `dashboard.view_sync_health`
- `dashboard.manage_presets`

Dueño y administrador reciben el catálogo completo mediante backfill idempotente. Los demás roles reciben sólo su dominio: Recursos Humanos personal; Calidad calidad; Almacén inventario; Compras inventario/compras; Producción inventario y costos sensibles; operador lectura mínima; auditor lectura transversal sin configuración organizacional.

La autorización efectiva es:

`identidad → membresía → organización → roles → permisos → scopes → entitlements → filtros → recurso`

Ocultar un botón no sustituye esta validación. Guardar preferencias no crea permisos ni amplía sucursales; el periodo y la sucursal predeterminados se vuelven a intersectar con el scope al abrir. Exportar vuelve a resolver el snapshot en servidor, exige `dashboard.export` y registra `dashboard.exported`. Los permisos globales `platform.dashboard_catalog.read/manage` sólo pertenecen a Platform y requieren MFA; la API también devuelve una capacidad de administración para que las acciones no aparezcan en modo de solo lectura.
