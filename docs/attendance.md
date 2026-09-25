# Asistencia — Sprint E.2

La fuente productiva es `operational_attendance_events` en D1. El navegador no es autoridad.

## Eventos

- `entry`
- `exit`
- `late`
- `incident`
- `manual_adjustment`

Los ajustes son append-only: nunca reescriben silenciosamente el evento original.

## Reglas

- Idempotencia por organización + idempotency key.
- Anti-rebote antes de alternar entrada/salida.
- Turnos nocturnos calculan una fecha operacional que puede pertenecer al día anterior.
- Retardo se deriva del inicio del turno + tolerancia.
- Un empleado inactivo, suspendido o dado de baja no registra asistencia normal.
- Un dispositivo no puede capturar empleados fuera de su organización/sucursal.

## Reportes

`/app/personal/asistencia` expone CSV y XLSX autorizados server-side por fecha operacional y branch scope.
