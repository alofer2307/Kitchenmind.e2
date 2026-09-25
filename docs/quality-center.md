# Centro de Calidad

`/app/calidad` convierte Calidad en un dominio productivo multi-tenant. Sus datos oficiales viven en D1 y la evidencia en un bucket R2 privado. El demo de `/demo` permanece aislado y no alimenta este módulo.

## Flujo operativo

1. Una persona con `quality.templates.manage` crea un borrador con nombre, código, alcance, frecuencia y campos estructurados.
2. Define para cada campo tipo, unidad, obligatoriedad, criterio, severidad y si una desviación exige evidencia.
3. Publica la versión. Desde ese momento no se edita; cualquier cambio crea una nueva versión.
4. Una persona con `quality.logs.capture` programa la bitácora para sucursal, fecha y, cuando aplica, turno.
5. La captura puede guardarse parcialmente. El servidor normaliza los valores, calcula avance y evalúa criterios.
6. Una desviación crea o reactiva una acción correctiva vinculada a la respuesta.
7. La evidencia opcional u obligatoria se carga a R2 y sus metadatos se registran en D1.
8. El cierre exige respuestas obligatorias, evidencia requerida y confirmación de autoría.
9. Una corrección posterior crea `Rev. 2`, conserva la bitácora original y registra el motivo.

## Tipos de campo

| Tipo | Valor persistido | Criterio automático |
|---|---|---|
| Número | entero en milésimas | mínimo y/o máximo inclusivos |
| Sí/No | booleano | respuesta esperada opcional |
| Selección | opción del catálogo | opciones marcadas como no conformes |
| Texto | texto acotado | sin criterio automático |

Los criterios pertenecen a la versión publicada. Cambiarlos posteriormente no altera bitácoras anteriores.

## Versiones e inmutabilidad

- El borrador usa control de concurrencia con `version`.
- Publicar fija `published_at`, autor y `locked_at`.
- Una captura conserva el ID exacto de la versión usada.
- Cerrar fija autor, nombre mostrado, declaración y fechas.
- Las correcciones se enlazan mediante `revision_of_log_id`; no existe edición silenciosa del original.
- Las claves de idempotencia evitan duplicados al reintentar creación, programación o revisión.

## Acciones correctivas

Las acciones nacen en estado `open` y pueden pasar a `in_progress`, `resolved` o `cancelled`. Resolver exige causa raíz y solución; cancelar exige motivo. Cada cambio usa control de versión, actor, fecha y auditoría.

Una respuesta corregida antes de cerrar cancela automáticamente la acción pendiente asociada. Una corrección de una bitácora cerrada hereda el valor como una nueva captura y genera su propio seguimiento, sin reabrir el historial original.

## Evidencia

- Formatos: JPEG, PNG, WEBP y PDF.
- Límite actual: 5 MB por archivo.
- D1 guarda nombre, MIME, tamaño, SHA-256, nota, autor, fecha y relaciones.
- R2 guarda el objeto bajo una clave aleatoria con prefijo de organización.
- La API revalida identidad, membresía, permiso, entitlement y scope para cargar o descargar.
- Las mutaciones tienen límite por identidad y minuto; los reintentos seguros usan idempotencia.
- La vista nunca revela `object_key`.

## Dashboard

`quality_templates` cuenta controles con versión publicada. `quality_alerts` cuenta acciones `open` o `in_progress` dentro de las sucursales autorizadas. Las mutaciones de Calidad invalidan la caché del tenant para que el Centro de atención refleje el cambio siguiente.

## Límites honestos

El módulo conserva registros y evidencia, pero la organización sigue siendo responsable de definir controles, límites, frecuencia, capacitación y revisión conforme a su operación y normativa aplicable. La confirmación de cierre no es una firma electrónica certificada. No hay envío automático a autoridades ni certificación automática.
