# Kiosco de asistencia — Sprint E.2

Ruta: `/kiosk/asistencia`.

El kiosco usa credencial Bearer de dispositivo y un bridge biométrico. No requiere sesión normal de usuario para capturar.

Flujo:

`lector -> bridge -> referencia externa -> API de dispositivo -> reglas -> D1 -> respuesta visual`

El endpoint E.2 acepta únicamente `eventKind=attendance`. Cualquier evento de servicio/comensal se rechaza por diseño.
