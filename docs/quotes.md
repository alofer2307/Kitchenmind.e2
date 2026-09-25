# Cotizaciones persistentes

## Crear

1. Completar el diagnóstico del prospecto.
2. Publicar una versión de precios.
3. Abrir `/platform/cotizaciones/nueva` y seleccionar el prospecto.
4. Ajustar módulos, sucursales, empleados, usuarios, dispositivos, almacenes, volumen, implementación y adicionales.
5. Revisar el resumen calculado por el servidor.
6. Agregar vigencia, impuestos, condiciones y, si aplica, descuento con motivo.
7. Crear el borrador. El servidor asigna `KM-COT-AAAA-00001` e idempotencia evita un doble alta.

## Revisiones

Una revisión enviada o aceptada nunca se modifica. **Editar alcance en nueva revisión** precarga la selección vigente y permite cambiar módulos, cantidades, adicionales, vigencia, impuestos y condiciones. Se exige un motivo; la revisión anterior conserva su snapshot. La pestaña **Revisiones** muestra diferencias mensuales y módulos añadidos.

## Estados

- `draft`: editable mediante una nueva revisión.
- `ready`: validada contra prospecto, contacto, diagnóstico, catálogo, moneda, partidas, vigencia, términos y totales.
- `sent`: registra medio y destinatario; bloquea la revisión.
- `viewed`: registro manual opcional.
- `accepted`: exige persona y fecha de confirmación, bloquea definitivamente y marca el prospecto ganado.
- `rejected`: exige motivo; marcar el prospecto perdido es una decisión separada.
- `expired`: se calcula por vigencia; puede duplicarse en una nueva revisión con precios vigentes.
- `cancelled`: exige permiso y motivo; no elimina historial.

Repetir una transición ya aplicada es idempotente. Una versión obsoleta recibe conflicto en lugar de sobrescribir otra sesión.

## Vista para cliente

La vista imprimible incluye identidad, folio, revisión, fecha, vigencia, empresa, contacto, alcance, partidas, implementación, mensualidad/anualidad, descuentos, impuestos, total, condiciones y próximos pasos. Permite imprimir o guardar PDF desde el navegador.

La proyección del servidor excluye margen, costos internos, notas comerciales, auditoría, reglas técnicas e identificadores internos.

## Aceptar o rechazar

En **Flujo y envío**, registrar el comentario o referencia. Para aceptar, capturar quién confirmó y la fecha. Para rechazar, escribir motivo y decidir explícitamente si la oportunidad completa también debe marcarse como perdida. Nada crea todavía una organización: esa provisión pertenece al Sprint C.
