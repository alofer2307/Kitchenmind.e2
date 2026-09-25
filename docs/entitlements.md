# Entitlements y límites

Los módulos y características nacen del snapshot aceptado, no del tipo de negocio. CORE es obligatorio. `organization_entitlements` controla disponibilidad y `organization_feature_limits` controla cantidades de sucursales, empleados, usuarios, dispositivos, almacenes y movimientos.

Antes de crear recursos, el servidor comprueba permiso, módulo, tenant, alcance y límite. El contador se actualiza junto con la mutación. Una excepción se registra en `organization_feature_overrides`, exige el permiso Platform correspondiente, motivo y fecha de vencimiento, y nunca modifica el contrato base. El servidor aplica el override activo más reciente y conserva antes y después en `entitlement_history`; al vencer, vuelve automáticamente al valor contractual.

El dashboard resuelve módulos y features vigentes antes de componer widgets. Un override visual puede ocultar, reordenar o redimensionar un widget, pero nunca habilita un módulo, feature, permiso o scope. La configuración visual tampoco modifica la cotización aceptada ni sus snapshots.
