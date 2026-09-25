# Onboarding de organizaciones

## Panel interno

`/platform` es una superficie exclusiva del equipo KitchenMind. El acceso real se valida en servidor contra usuarios, roles y permisos de plataforma, exige MFA y genera auditoría. El campo demostrativo `platformAccess` ya no autoriza la ruta.

## Alta inicial

1. Seleccionar un perfil de negocio.
2. Capturar nombre, país, zona horaria y tamaño previsto.
3. Elegir plan y módulos permitidos.
4. Crear la primera sucursal y el administrador.
5. Crear la suscripción y registrar auditoría.
6. Entrar en la organización y continuar con turnos, empleados y catálogos.

El perfil sólo propone módulos. No crea una versión diferente de la aplicación ni impide modificar la configuración posteriormente.

## Flujo productivo

1. En `/platform/organizaciones`, elegir una cotización aceptada y sin organización previa.
2. KitchenMind valida estado, revisión bloqueada, prospecto ganado, CORE, contacto, moneda, país y cantidades.
3. Una solicitud idempotente crea organización, primera unidad, roles, permisos, módulos, límites, suscripción manual, proyecto de onboarding e invitación.
4. La fundadora copia el enlace temporal por un canal seguro; el sistema no afirma haber enviado correo.
5. El administrador acepta con el mismo correo e inicia `/app/onboarding`.
6. Confirma empresa y sucursal, crea catálogos, importa empleados y completa tareas aplicables.
7. Solicita revisión. Platform calcula verificaciones críticas y solamente entonces permite activar.

El acceso principal dirige automáticamente una organización no activa a `/app/onboarding`. La cabecera muestra organización y rol; si existen varias membresías, el selector solamente incluye las autorizadas. La ruta `/app/onboarding/[sectionCode]` permite volver directamente a una sección sin duplicar el proyecto ni el estado.

La primera vista muestra porcentaje calculado, módulos incluidos, siguiente tarea y bloqueos. El porcentaje no se escribe desde la UI. Las respuestas, recursos, importaciones y cambios de tarea se confirman únicamente después de persistir en D1 y cada mutación vuelve a validar membresía, permiso, alcance y entitlement.

El proyecto se materializa desde la versión publicada de `onboarding_template_versions`; cambiar la plantilla exige una versión nueva y no altera proyectos existentes. `onboarding_dependencies` impide solicitar revisión antes de completar sus requisitos y `onboarding_answers` conserva evidencia estructurada de la configuración. El porcentaje se deriva de las tareas obligatorias activas. Las secciones Personal, Servicios, Calidad e Inventario sólo aparecen si su módulo fue contratado; Dispositivos aparece cuando la cantidad contratada es mayor que cero. Cada transición del proyecto queda en `onboarding_status_history`.
