# Flujo comercial de KitchenMind

## Operación diaria

1. En `/platform/prospectos/nuevo`, registrar empresa, contacto, tamaño, necesidad y siguiente acción.
2. Revisar la advertencia de posibles duplicados. Continuar sólo después de comparar empresa, correo y teléfono; ignorar la alerta queda auditado.
3. En la ficha, agregar contactos, notas internas y seguimientos.
4. Completar el diagnóstico por secciones. Datos ya capturados se precargan con origen `prospect`.
5. Finalizar el diagnóstico cuando las preguntas obligatorias lleguen a 100%. Para corregirlo después, crear una revisión.
6. Revisar módulos recomendados y crear una cotización con un catálogo publicado.
7. Marcarla lista, registrar el envío y esperar respuesta. El envío es manual en Sprint B.
8. Al aceptar, registrar quién confirmó, fecha y referencia. La oportunidad cambia a ganada, pero todavía no se crea una organización.

## Estados

Los prospectos usan `new`, `contacted`, `discovery`, `quoted`, `negotiation`, `won`, `lost`, `paused` y `archived`. Marcar perdido o archivar exige motivo y nunca borra el registro.

Los seguimientos usan `pending`, `completed` y `cancelled`. El inicio de Platform muestra vencidos y próximos.

Los diagnósticos usan `draft`, `in_progress`, `completed`, `superseded` y `cancelled`. Sólo una revisión permanece vigente.

## Agregar una pregunta

Agregarla mediante una migración o proceso administrativo idempotente en `diagnosis_questions`, asignando `template_id`, código único, sección, tipo, orden, validación y versión. La UI lee la definición persistente; no hay que editar el componente. Cambios incompatibles deben crear una nueva versión de plantilla.

## Agregar módulos o características

Registrar `modules`, `features`, `module_features` y, si aplica, `module_dependencies`. `CORE` sigue obligatorio. Las recomendaciones por perfil viven en `business_profile_recommendations`; son sugerencias, no reglas irreversibles.

## Cero recaptura

El prospecto alimenta el diagnóstico; el diagnóstico alimenta cantidades y módulos; la cotización toma empresa, contacto, diagnóstico y versión de precio. Sprint C consumirá la cotización aceptada para provisión sin volver a capturar esos datos.
