# Operación offline

KitchenMind mantiene los kioscos disponibles cuando la conexión se interrumpe.

## Flujo

1. El escaneo se valida contra los catálogos locales.
2. El evento se crea con UUID, clave idempotente y estado `pending`.
3. `OfflineQueue` guarda una referencia del evento en IndexedDB.
4. El kiosco muestra cuántos registros están pendientes.
5. Al regresar Internet, `SyncManager` verifica identidad e idempotencia y cambia el evento a `synced`.
6. Los elementos sincronizados salen de la cola; los fallidos permanecen para reintento.

## Recuperar la cola

- No borrar los datos del navegador ni desinstalar la PWA mientras existan pendientes.
- Reconectar el dispositivo y usar **Sincronizar** si el reintento automático no concluye.
- Los fallos conservan número de intentos y mensaje técnico.
- Restaurar los datos demo elimina el estado operacional local; debe usarse sólo fuera de un piloto real.

La cola es propia del dispositivo. Supabase será la fuente autoritativa cuando el proveedor productivo esté habilitado.
