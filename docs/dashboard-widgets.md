# Catálogo de widgets

`dashboard_widget_definitions` contiene componentes aprobados y versionados. No admite JSX, scripts ni consultas arbitrarias.

Cada definición conserva código estable, nombre, categoría, tipo, tamaños soportados, módulo y feature requeridos, permiso, scope, fuente, filtros, política de refresco, umbral de obsolescencia, estado vacío, sensibilidad, orden, estado y versión.

## Agregar un widget

1. Crear o reutilizar una métrica en `dashboard_metric_definitions`.
2. Añadir la definición idempotente en `D1DashboardRepository.ensureCatalog`.
3. Asignar `requiredModuleCode`, `requiredFeatureCode`, `requiredPermission` y `requiredScopeType` mínimos.
4. Declarar la fuente `available` sólo cuando exista un read model durable multi-tenant.
5. Relacionarlo con uno o más presets en `dashboard_preset_widgets`.
6. Añadir su componente/icono aprobado y un estado vacío útil.
7. Probar módulo ausente, permiso ausente, scope ajeno, cero real y fuente no disponible.

Un override organizacional puede ocultar o redimensionar un widget, con motivo y vigencia. Una preferencia personal sólo altera presentación y guarda periodo/sucursal predeterminados dentro del conjunto ya autorizado. Si el scope cambia, el servidor descarta una sucursal predeterminada que dejó de estar autorizada.

Las fuentes heredadas de asistencia, servicios registrados, capturas de calidad, compras, producción, sincronización y mermas se mantienen como `unavailable`; no reciben ceros ficticios.
