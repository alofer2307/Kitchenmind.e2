# Modelo de datos

## Jerarquía

`BusinessProfile / Plan → Organization → Branch → Users / Employees / Operation events`

Los registros comparten `id`, `createdAt`, `updatedAt` y `createdBy`. Los eventos operativos agregan identificador idempotente, origen y estado de sincronización.

## Dominios

- Organización: organizaciones, sucursales, roles y usuarios.
- Plataforma: perfiles de negocio, planes y suscripciones.
- Seguridad de plataforma: usuarios internos, roles, permisos, credenciales MFA, códigos de recuperación, sesiones y auditoría.
- Personal: empleados, identificadores, turnos y asistencia.
- Servicios: clientes, tipos de servicio y eventos de consumo.
- Inventario: productos, lotes y movimientos.
- Compras: proveedores y órdenes con líneas explicables.
- Calidad: plantillas, campos estructurados, capturas y acciones correctivas.
- Trazabilidad: audit log inmutable desde la interfaz.
- Comercial interno: prospectos, contactos, notas, seguimientos y diagnósticos versionados.
- Catálogo comercial: módulos, características, dependencias, perfiles recomendados, planes y prestaciones.
- Pricing: libros de precios, versiones, reglas, niveles y conceptos de implementación, soporte, capacitación y hardware.
- Cotizaciones: encabezado, snapshots por revisión, partidas, ajustes e historial de estado.

Los tipos fuente se encuentran en `types/domain.ts`. Los nombres de turnos, servicios, áreas, tolerancias y rangos son datos configurables.

## Provisión

Una organización conserva `businessProfileId`, `planId`, moneda, zona horaria, tamaño previsto, estado de onboarding y módulos activos. La suscripción es una entidad separada para que los estados de pago no se mezclen con el estado operacional del cliente.

Usuario y empleado son entidades distintas: un empleado puede registrar asistencia o recibir servicios sin tener acceso administrativo.

Los usuarios internos de KitchenMind Platform también son entidades distintas de los usuarios de cualquier organización. Una membresía de cliente nunca concede acceso al panel de la fundadora.

## Invariantes comerciales

- `prospects.version` y `quotes.version` implementan control de concurrencia optimista.
- Un diagnóstico completado se reemplaza por una revisión; no se sobrescribe.
- Una versión de precios publicada es inmutable.
- Cada revisión de cotización conserva empresa, contacto, diagnóstico, catálogo, selección, importes, descuentos, impuestos y condiciones como snapshots.
- `quotes.idempotency_key` evita dobles altas y `quote_sequences` asigna folios `KM-COT-AAAA-00001` en servidor.
- El dinero se guarda como entero en la unidad mínima de la moneda; las tasas se guardan en puntos base.
- Prospectos y cotizaciones se archivan o cancelan lógicamente; el historial no se elimina.

## Entidades multi-tenant productivas

- `tenant_organizations` conserva el origen en prospecto, cotización y revisión aceptada.
- `tenant_branches`, `tenant_areas` y `tenant_warehouses` siempre pertenecen a una organización.
- `customer_users` representa identidad; `organization_memberships` representa acceso a un tenant; `tenant_employees` representa personal operativo.
- `organization_roles`, `organization_role_permissions` y `membership_scopes` implementan RBAC y alcance.
- `organization_entitlements` y `organization_feature_limits` congelan módulos y cantidades contratadas; `organization_feature_overrides` conserva excepciones temporales auditadas sin reescribir el contrato.
- `provisioning_requests` y `provisioning_steps` conservan idempotencia y observabilidad.
- `onboarding_template_versions`, sus secciones y tareas conservan la definición publicada que genera cada proyecto; `onboarding_projects` guarda el número exacto utilizado.
- `onboarding_projects`, secciones, tareas, dependencias, respuestas estructuradas, importaciones, `onboarding_status_history` y verificaciones de activación conservan el avance y sus transiciones.
- `customer_subscriptions`, `customer_subscription_items` y `subscription_status_history` congelan el alcance manual inicial sin afirmar que existe un cobro.
- `organization_audit_events` es el historial append-only de acciones del cliente y soporte.

Todas las relaciones operativas se validan usando `organization_id`; los códigos de sucursal, empleado, rol y catálogos tienen unicidad dentro de su tenant.

## Entidades de dashboard

- `dashboard_metric_definitions` documenta unidad, fuente, cálculo, frescura y tratamiento de ausencia.
- `dashboard_widget_definitions` versiona el componente aprobado, tamaños, filtros, módulo, feature, permiso, scope, fuente y sensibilidad.
- `dashboard_presets` y `dashboard_preset_widgets` definen composiciones iniciales; no guardan JSX ni código arbitrario.
- `role_dashboard_defaults` y `business_profile_dashboard_defaults` resuelven recomendaciones iniciales.
- `organization_dashboard_overrides` conserva motivo, vigencia, actor, estado y versión sin alterar entitlements contractuales.
- `user_dashboard_preferences` guarda por organización y membresía el tablero `operations`, preset, orden, tamaño, visibilidad y filtros predeterminados validados, con concurrencia optimista.
- `dashboard_cache_entries` contiene snapshots de lectura segregados por tenant, membresía, sucursal, filtros y versión de configuración.

Las auditorías de configuración y exportación reutilizan `organization_audit_events`; las acciones globales reutilizan `platform_audit_events`.

## Entidades productivas de Calidad

- `tenant_quality_templates` es la raíz estable del control y mantiene su alcance de organización o sucursal.
- `quality_template_versions` guarda cada revisión y bloquea la versión al publicarla.
- `quality_template_fields` congela tipos, unidades, obligatoriedad, criterios, opciones, severidad y requisito de evidencia de cada versión.
- `quality_log_instances` programa la bitácora, conserva fecha operacional, vencimiento, estado, autoría de cierre, porcentaje calculado y relación de revisión.
- `quality_log_answers` guarda valores estructurados. Los números se almacenan como enteros en milésimas (`numeric_value_milli`) para no depender de punto flotante.
- `quality_corrective_actions` representa el seguimiento persistente de cada desviación, con responsable, vencimiento, causa raíz, resolución, verificación y control de versión.
- `quality_evidence` guarda metadatos, hash y clave privada del objeto R2; el archivo no vive en JSON ni en el navegador.

Invariantes:

- una versión publicada no se edita;
- una bitácora cerrada no se edita;
- una corrección conserva `revision_of_log_id`, motivo y número de revisión;
- el cierre exige todos los campos obligatorios y la evidencia marcada como necesaria;
- una edición concurrente falla si cambió `version`;
- las consultas siempre cruzan `organization_id`, entitlement y alcance autorizado.

## Entidades productivas de Personal y Asistencia

- `tenant_employees` conserva el registro laboral vigente; `tenant_people` vincula al empleado con una identidad operativa que no implica acceso administrativo.
- `employee_branch_assignments` y `employee_shift_assignments` conservan vigencia, motivo y actor. Los cambios no destruyen asignaciones anteriores.
- `tenant_shifts.metadata_json` guarda horario, tolerancia y días configurados; las reglas de dominio interpretan cruces de medianoche.
- `biometric_credentials` guarda sólo proveedor y referencia externa opaca, con enrolamiento, revocación y versión.
- `tenant_devices` conserva vínculo de sucursal, tipo, proveedor, capacidades, configuración, salud y señales de heartbeat/sync.
- `tenant_device_credentials` guarda hash SHA-256, prefijo, estado y vigencia; nunca el token recuperable.
- `operational_attendance_events` es append-only e incluye fecha operacional, fuente, idempotencia, referencia al turno/dispositivo y relación opcional a un ajuste original.
- `operational_sync_batches` y `operational_sync_items` conservan el resultado durable de cada lote offline.

Invariantes E.2:

- número de empleado único por organización;
- referencia biométrica única por organización y proveedor;
- token de dispositivo autenticado contra hash y estado vigente;
- idempotencia única por organización y por evento offline de dispositivo;
- dos capturas concurrentes dentro de la ventana anti-rebote no crean dos asistencias;
- un ajuste agrega un evento; no actualiza el evento físico original;
- toda lectura cruza organización y sucursales autorizadas, y su proyección respeta permisos de biometría, asistencia y dispositivos.
