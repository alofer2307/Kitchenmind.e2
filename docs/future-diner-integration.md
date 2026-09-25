# Future diner integration

## Decisión de producto E.2

Comensales está **DEFERRED BY PRODUCT DECISION**.

No existe pantalla productiva, kiosco de servicios ni lectura de `services_today` en E.2. Las rutas previas de Servicios devuelven `notFound()`.

El futuro módulo podrá reutilizar:

`Person -> biometric credential -> device -> organization/branch`

sin crear una segunda identidad física para la misma persona.

Las tablas heredadas de servicios de 0011 se conservan para evitar una migración destructiva, pero no forman parte del release funcional de Personal/Asistencia E.2.
