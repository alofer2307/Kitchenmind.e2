# Métricas iniciales del dashboard

El servidor es la autoridad de cálculo. Los conteos siempre incluyen `organization_id` y aplican la sucursal autorizada cuando la entidad lo permite.

| Métrica | Fuente | Cálculo inicial | Estado |
|---|---|---|---|
| Personal activo | `tenant_employees` | empleados activos en el scope | Productiva |
| Turnos configurados | `tenant_shifts` | turnos activos de organización/sucursal | Productiva |
| Servicios configurados | `tenant_service_types` | tipos activos configurados | Productiva |
| Controles de calidad | `quality_template_versions` + raíz tenant | controles con al menos una versión publicada | Productiva |
| Productos activos | `tenant_products` | productos activos | Productiva |
| Almacenes activos | `tenant_warehouses` | almacenes activos | Productiva |
| Dispositivos vinculados | `tenant_devices` | dispositivos activos | Productiva |
| Movimientos de inventario | `tenant_inventory_movements` | movimientos desde el inicio del periodo | Productiva |
| Inventario bajo | productos + movimientos | saldo menor a `metadata.minimumStockMinor` | Productiva si existe umbral |
| Importaciones pendientes | `import_batches` | lotes pendientes, validando o procesando | Productiva |
| Preparación | `onboarding_projects` | porcentaje persistente calculado por onboarding | Productiva |
| Sucursales autorizadas | `tenant_branches` + scopes | sucursales activas dentro del alcance | Productiva |
| Asistencia de hoy | eventos heredados | no se calcula desde datos locales | Sin fuente productiva |
| Servicios registrados | eventos heredados | no se calcula desde datos locales | Sin fuente productiva |
| Alertas de calidad | `quality_corrective_actions` | acciones abiertas o en seguimiento dentro del alcance | Productiva |
| Compras pendientes | compras heredadas | no se calcula desde datos locales | Sin fuente productiva |
| Producción pendiente | producción heredada | no se calcula desde datos locales | Sin fuente productiva |
| Sincronización pendiente | cola heredada | no existe confirmación durable por tenant | Sin fuente productiva |
| Costo de merma | eventos/costos heredados | no existe fuente durable autorizada | Sin fuente productiva |

Un cero sólo significa cero cuando la fuente es productiva. Si falta fuente o umbral, la respuesta usa `unavailable` y explica el motivo.
