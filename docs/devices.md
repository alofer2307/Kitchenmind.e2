# Dispositivos — Sprint E.2

`/app/dispositivos` permite registrar dispositivos, vincularlos a sucursal, configurar capacidades de asistencia/enrolamiento y emitir o revocar credenciales.

La credencial completa se muestra una sola vez. El servidor conserva únicamente SHA-256.

El heartbeat actualiza `last_seen_at`, `last_health_at`, `bridge_version` y un estado de salud limitado. Online/offline se deriva de señales reales, no de la mera existencia del registro.
