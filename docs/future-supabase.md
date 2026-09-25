# Migración futura a Supabase

1. Crear tablas equivalentes a los contratos de `types/domain.ts`.
2. Implementar `SupabaseProvider` bajo el contrato `KitchenMindDataProvider`.
3. Mapear fechas, estados y JSON estructurado sin cambiar la UI.
4. Usar Supabase Auth para identidad de usuario.
5. Añadir `organization_id` y `branch_id` indexados en toda tabla operativa.
6. Aplicar RLS que derive la organización autorizada de la sesión; nunca aceptar el alcance sólo desde el cliente.
7. Usar Storage para fotografías y evidencias, guardando únicamente sus rutas en PostgreSQL.
8. Migrar datos demo sólo en ambientes de demostración.

## Orden recomendado

1. Crear proyecto y ambientes de desarrollo/producción.
2. Aplicar migraciones para perfiles, planes, organizaciones, suscripciones, membresías y sucursales.
3. Implementar autenticación e invitaciones.
4. Probar RLS con dos organizaciones independientes.
5. Implementar `SupabaseProvider` y mantener `LocalDemoProvider` sólo como modo demostrativo explícito.
6. Migrar eventos y cola offline usando `upsert` con restricciones únicas por `idempotency_key`.

La aplicación no instancia Supabase mientras no existan variables y políticas verificadas.

## Migración del dominio comercial

1. Replicar las tablas comerciales de `db/schema.ts` en PostgreSQL conservando UUID, snapshots JSON, importes enteros, versiones e idempotencia.
2. Implementar `SupabaseCommercialDataProvider` bajo `CommercialDataProvider`; servicios y pantallas no cambian.
3. Mantener `platform_users` separado de usuarios y membresías cliente.
4. Ejecutar mutaciones comerciales sólo mediante funciones o rutas de servidor; las credenciales de servicio nunca llegan al navegador.
5. Aplicar RLS cerrada por defecto. Sólo identidades internas con una sesión Platform verificada pueden consultar este esquema.
6. Conservar restricciones únicas para folios, idempotencia, versiones, contactos principales y respuestas de diagnóstico.
7. Migrar snapshots sin recalcular cotizaciones históricas con el catálogo nuevo.
8. Probar acceso cruzado con una identidad cliente, una identidad Platform sin permiso y la propietaria.

## Seguridad de Platform durante la migración

KitchenMind Platform ya conserva usuarios internos, roles, MFA, sesiones y auditoría en una base durable del hosting. Al migrar a Supabase, estas tablas deben mantenerse separadas de `organization_memberships`; una membresía de cliente no puede satisfacer un permiso `platform.*`. La migración debe preservar hashes, cifrado, revocaciones e historial sin copiar secretos al navegador.

## Traducción del Sprint C

1. Replicar las tablas `tenant_*`, membresías, roles, entitlements, onboarding, importaciones y auditoría con UUID nativo.
2. Implementar `SupabaseTenancyDataProvider` bajo `TenancyDataProvider`; no cambiar pantallas ni reglas.
3. Derivar `organization_id` de la membresía de `auth.uid()` y habilitar RLS denegada por defecto en cada tabla cliente.
4. Separar políticas de lectura, captura, aprobación y administración; validar también sucursal y área.
5. Ejecutar aprovisionamiento mediante una función transaccional idempotente o una saga durable si se añaden correo, pagos o almacenamiento.
6. Conservar el hash de invitaciones y usar Supabase Auth solamente como identidad, nunca como entitlement.
7. Probar usuario sin membresía, membresía suspendida, acceso cruzado, módulo no contratado y alcance de sucursal.

## Traducción de Sprint D

1. Replicar catálogos, presets, defaults, overrides y preferencias con UUID, versiones y restricciones equivalentes.
2. Implementar read models PostgreSQL por métrica; mantener `DashboardRepository` y la UI sin cambios.
3. Derivar organización y sucursales desde `auth.uid()` mediante membresías y RLS cerrada por defecto.
4. Incluir organización, membresía, scope, filtros y versión de configuración en cualquier caché externa.
5. Invalidar por cambios de rol, permiso, entitlement, override, preferencia o estado de organización.
6. Mantener snapshots offline cifrados/segmentados como copias identificadas, nunca como autoridad ni fuente de permisos.
7. Ejecutar pruebas de RLS con dos tenants, scopes parciales, módulos distintos y roles con sensibilidad diferente.

## Traducción de Sprint E

1. Replicar raíces, versiones, campos, bitácoras, respuestas, acciones correctivas y metadatos de evidencia conservando IDs y relaciones de revisión.
2. Implementar `SupabaseQualityDataProvider` bajo `QualityDataProvider`; mantener servicios, reglas y pantallas sin cambios.
3. Guardar `numeric_value_milli` como entero y no recalcular respuestas ni cierres históricos durante la migración.
4. Aplicar RLS por membresía, `organization_id` y scope de sucursal. Las políticas de captura, configuración, acciones y lectura deben ser independientes.
5. Migrar objetos de R2 a un bucket privado de Supabase Storage verificando SHA-256, tamaño y relación antes de activar cada registro.
6. Entregar archivos mediante URLs firmadas breves o un endpoint autorizado; nunca hacer público el bucket.
7. Probar inmutabilidad, concurrencia, idempotencia, acceso cruzado y preservación exacta de revisiones con dos organizaciones.

## Traducción de Sprint E.2

1. Replicar empleados, personas, asignaciones, turnos, credenciales biométricas, dispositivos, credenciales de dispositivo, asistencia y lotes offline conservando UUID, versiones y restricciones únicas.
2. Implementar `SupabaseOperationalDataProvider` bajo `OperationalDataProvider`; mantener `TenantOperationsService`, reglas y pantallas.
3. Derivar organización y sucursales desde `auth.uid()` y membresías. Aplicar RLS separada para directorio, asistencia, biometría y dispositivos, no una política amplia única.
4. Mantener captura de kiosco detrás de una función/endpoint de servidor que valide el hash de la credencial de dispositivo. No exponer `service_role` al bridge ni al navegador.
5. Preservar la referencia biométrica como texto opaco; nunca migrar huellas crudas ni convertir Storage en repositorio de biometría.
6. Conservar restricciones de idempotencia y ejecutar la guarda anti-rebote en una función SQL transaccional para evitar carreras entre instancias.
7. Migrar historial append-only sin recalcular fechas operacionales, tipos de evento o retardos históricos.
8. Probar dos tenants, dos sucursales, rol de sólo directorio, token revocado, lote repetido, turno nocturno y doble captura concurrente.
