# Motor de precios

## Catálogo versionado

El catálogo inicial se carga de forma idempotente como `Borrador — requiere revisión de la fundadora`. Una versión borrador permite editar reglas, costos internos y niveles. Publicar exige permiso y confirmación; después queda inmutable. Para cambiar precios se crea una nueva revisión.

Una cotización guarda el `priceBookVersionId` exacto. Publicar precios futuros nunca recalcula propuestas anteriores.

## Cálculo

`rules/pricing.rules.ts` recibe catálogo, módulos, características, cantidades, implementación, soporte, capacitación, hardware, ajustes, impuestos y periodicidad. Devuelve partidas, subtotales, descuentos, impuestos, total único, mensual, anual, primer pago, advertencias y explicación de cada regla.

Los importes son enteros en unidad mínima: `149000` representa `$1,490.00 MXN`. Los porcentajes usan puntos base: `1600` representa 16%. El redondeo sucede una sola vez por partida. React no calcula ni persiste totales.

## Niveles

En `/platform/precios/[priceBookId]` una versión borrador permite editar mínimo, máximo, importe unitario e importe fijo. Antes de guardar o publicar se rechazan rangos superpuestos, invertidos o discontinuos. Un máximo vacío representa un nivel sin límite superior.

## Descuentos

Se aceptan ajustes porcentuales o fijos por subtotal, recurrente, implementación o partida. Todo ajuste requiere motivo y permiso `platform.quotes.discount`; nunca puede superar su base ni producir un resultado negativo. Costos y márgenes permanecen exclusivamente en Platform.

## Publicar una versión

1. Abrir **Precios** y seleccionar el borrador.
2. Revisar moneda, reglas, costos y niveles.
3. Definir fecha efectiva y notas.
4. Escribir `PUBLICAR` y confirmar.
5. Crear una revisión para cualquier cambio posterior.
