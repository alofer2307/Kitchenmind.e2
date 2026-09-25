# Navegación de KitchenMind

## Rutas productivas

- `/`: acceso inteligente y pantalla de entrada.
- `/platform`: centro interno de la fundadora.
- `/platform/organizaciones`: aprovisionamiento y seguimiento.
- `/platform/organizaciones/[organizationId]/operacion`: supervisión de solo lectura.
- `/aceptar-invitacion`: validación y aceptación del acceso inicial.
- `/app/organizaciones`: selector para identidades con varias membresías.
- `/app/onboarding`: resumen y configuración reanudable.
- `/app/onboarding/[sectionCode]`: sección enlazable del onboarding.
- `/app`: cockpit de una organización activa.

## Reglas

Platform y cliente usan shells distintos. Un cliente nunca ve enlaces de Platform. La fundadora vuelve al control interno desde la vista supervisada sin convertirse en Customer User. El nombre de organización y sucursal permanece visible en operación.

En escritorio, el espacio cliente usa navegación lateral por módulos contratados. En móvil usa una barra inferior con Inicio, Pendientes, Acción, Módulos y Cuenta. Las opciones de módulos se derivan de entitlements efectivos; los módulos no contratados no aparecen.

## Demo aislado

`/demo` y `/demo/login` son la entrada explícita al piloto local. Las rutas operativas heredadas aún dependen de ese contexto, se rotulan como demo y no están enlazadas desde `/`, `/platform`, `/app` ni el onboarding productivo.
