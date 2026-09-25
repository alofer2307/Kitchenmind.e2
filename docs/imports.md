# Importaciones iniciales

El onboarding acepta CSV de empleados con hasta 500 filas por lote y encabezados `employeeNumber`, `name`, `branchCode`, `shiftCode` y `email`. También permite importar almacenes, productos, turnos, tipos de servicio y plantillas de calidad con `code`, `name`, `branchCode` y columnas adicionales propias del catálogo.

Antes de insertar se valida:

- número y nombre obligatorios;
- duplicados dentro del archivo y la organización;
- sucursal y turno del mismo tenant;
- formato básico de correo;
- límite contratado de empleados.

En los catálogos también se validan códigos duplicados, sucursal, alcance del usuario, módulo contratado y límites aplicables. Las columnas adicionales se conservan en el registro estructurado del catálogo.

Cada lote conserva tipo, total, válidas, inválidas, actor e idempotency key. Cada fila conserva entrada original, errores y entidad creada. Reenviar la misma clave no duplica empleados ni catálogos. Excel queda fuera hasta incorporar un lector estable y probado.
