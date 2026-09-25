# Caché y frescura del dashboard

## Caché de servidor

`dashboard_cache_entries` conserva por 60 segundos una respuesta ya resuelta. La clave hash incluye organización, membresía, sucursal, periodo, versión de organización y membresía, roles, permisos, scopes efectivos, conjunto de sucursales autorizadas, módulos, features, preset, preferencia y stamps de catálogo/overrides.

Antes de leer la caché, el repositorio vuelve a validar identidad, membresía, estado, permisos y scopes. El payload también debe coincidir con organización y membresía. Por eso una clave enviada por el navegador nunca concede acceso.

Se invalida al guardar/restablecer una preferencia, aplicar un override o cambiar el catálogo global. Cambios de rol, permiso, scope, sucursal autorizada, entitlement, filtro predeterminado o versión producen otra clave aunque una fila anterior siga pendiente de expirar.

## Frescura visible

Cada widget conserva `updatedAt`, `staleAfterSeconds`, estado de fuente y estado del valor. El snapshot declara `live`, `server_cache` u `offline_snapshot`. La UI muestra la hora y nunca presenta una fuente ausente como cero.

## Escala

Las consultas iniciales usan agregados acotados e índices por organización/fecha. Al crecer el volumen, cada métrica puede migrar a una tabla agregada o job incremental conservando el mismo contrato y la misma clave de autorización.
