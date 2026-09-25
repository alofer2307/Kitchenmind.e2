# KitchenMind E.2 — Personal y Asistencia

## Implementado

- empleados persistentes, expediente, búsqueda y paginación server-side;
- importación CSV validada y transaccional, sin commits parciales;
- estados laborales y control optimista de concurrencia;
- historial efectivo de sucursales y turnos, incluidos turnos nocturnos;
- enrolamiento/revocación de referencias biométricas externas;
- inventario de dispositivos, configuración, heartbeat y estado de salud;
- tokens de dispositivo rotables, mostrados una vez y almacenados sólo como hash;
- asistencia durable con idempotencia, anti-rebote atómico y cálculo de retardo;
- ajustes manuales append-only con actor y motivo;
- lotes offline limitados a 250 eventos, con historial de ítems y reintento idempotente;
- kiosco de asistencia, exportación CSV/XLSX y métricas de Personal;
- autorización por identidad, membresía, estado de organización, entitlement, permiso y scope de sucursal;
- proyecciones que ocultan biometría, asistencia y dispositivos a roles sin permiso.

## Privacidad biométrica

D1 guarda `provider` y `external_template_id` como una referencia opaca. No guarda imágenes, WSQ, bitmaps, base64 ni plantillas biométricas crudas. La referencia se enmascara en la UI; las acciones de enrolamiento y revocación quedan auditadas.

## Diferido

- Comensales y servicios de comida productivos.
- Kiosco de servicio de alimentos.
- Adapter de fabricante para un lector físico específico.
- Envíos, cobros y facturación automáticos.

## Validación de esta entrega

- `npm run lint`: aprobado.
- `npm run typecheck`: aprobado.
- `npm run build`: aprobado.
- `npm test`: 48 aprobadas, 0 fallidas.

La validación automatizada comprueba SQLite desde cero y actualización desde Sprint E, flujo operativo completo, token hash-only, idempotencia, concurrencia, offline, auditoría, llaves foráneas y acceso mínimo. La prueba final con MFA, R2 y lector físico debe realizarla la propietaria en el entorno publicado.

