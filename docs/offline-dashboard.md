# Dashboard offline

El dashboard productivo es de lectura y D1 sigue siendo la autoridad. Después de una respuesta autorizada, el cliente puede conservar durante 15 minutos una copia no sensible en IndexedDB.

La clave incluye versión de esquema, `userId` y filtros canónicos. El registro conserva organización, membresía, hash de roles/permisos/scopes/módulos/features, preset, filtros, fecha de generación y vencimiento. Antes de mostrarlo se verifica TTL, identidad, filtros y hash de alcance.

Una copia offline:

- se etiqueta “Última información disponible · solo lectura”;
- cambia valores productivos a estado `stale`;
- elimina widgets sensibles y enlaces de acción;
- desactiva configuración, exportación, multisucursal y cambio de organización;
- no crea permisos ni confirma operaciones;
- se elimina para esa identidad al cerrar sesión o cambiar de organización;
- elimina todas las combinaciones de esa identidad ante rechazo 401/403 y sólo crea una nueva después de una revalidación exitosa.

Si no existe una copia vigente, se muestra un error recuperable. La cola offline heredada de kioscos no se considera fuente de métricas hasta que el servidor confirme eventos por tenant.
