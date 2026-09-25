# Aprovisionamiento

## Fuente de verdad

Sólo una cotización `accepted`, con revisión bloqueada y prospecto `won`, puede iniciar el proceso. La selección y los importes se copian desde `quote_versions`; el catálogo vigente no recalcula contratos históricos.

## Idempotencia y recuperación

`provisioning_requests` tiene unicidad por cotización e `idempotency_key`. Repetir la solicitud devuelve la organización existente. Los pasos persistentes permiten observar validación, identificadores, organización, entitlements, sucursal, roles, onboarding, invitación y auditoría.

El proceso actual usa un batch transaccional D1 porque todos sus efectos son locales. Al añadir proveedores externos, conservar la solicitud y convertir los pasos externos en una saga reintentable; nunca borrar silenciosamente una organización parcial. El onboarding se genera desde la plantilla publicada y guarda su versión; la suscripción manual conserva módulos, características, límites e importes en partidas independientes.

## Invitación

La respuesta muestra una vez el enlace sin enviarlo. Emitir una nueva invitación reemplaza las pendientes y tiene un límite temporal para evitar abuso. El servidor almacena hash, destinatario, rol, alcance, expiración, actor y estado.

No pueden emitirse ni aceptarse invitaciones mientras la organización esté suspendida o cancelada. Suspender conserva todos los datos y el historial, bloquea el acceso del cliente desde la validación central de membresía y cambia la suscripción manual a `suspended`. Reactivar restaura el estado que corresponde al avance del onboarding y exige versión vigente, motivo y permiso de Platform.
