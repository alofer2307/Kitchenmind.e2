# Matriz de autorización y aislamiento

Auditoría de Fase 1. Esta matriz describe los controles **de servidor**; la visibilidad de botones no se considera un control de seguridad.

## Identidades y fronteras

| Frontera | Autenticación | Autorización | Aislamiento |
|---|---|---|---|
| Cliente SaaS | cookie HTTP-only `kitchenmind_session` | membresía activa + permiso de rol + entitlement + scope | todas las consultas mutables deben incluir `organization_id`; recursos de sucursal pasan por `membership_scopes` |
| KitchenMind Platform | cookie anterior + `__Host-kitchenmind_platform` | sesión MFA activa + permiso `platform.*` | Platform es un plano de control global; cada acción sensible queda auditada |
| Empleado móvil | cookie HTTP-only + vínculo `mobile_attendance_accounts` | cuenta activa del empleado | vínculo exacto `auth_user_id`/empleado/organización/sucursal |
| Kiosco | bearer token aleatorio, almacenado como hash | dispositivo activo + capability | la organización y sucursal se derivan de la credencial, nunca del body |
| Invitación | token opaco de un uso, almacenado como SHA-256 | correo autenticado debe coincidir | la organización, rol y scope se derivan de la invitación |

## APIs

`Org` significa que `organizationId` se valida contra una membresía activa. `Branch` significa que además se exige scope de organización o scope explícito de sucursal con modo suficiente.

| Ruta / operación | Autenticación | Permiso servidor | Org / Branch | Service → repository | Riesgo residual de acceso cruzado |
|---|---|---|---|---|---|
| `POST /api/auth/login` | pública | credencial activa; bloqueo por intentos | N/A | native-auth | Bajo; respuesta no distingue usuario inexistente de contraseña incorrecta |
| `GET/POST /api/auth/logout` | cookie opcional | revoca únicamente hash de cookie actual | N/A | native-auth | Bajo; GET permite logout CSRF, sin exposición de datos |
| `POST /api/auth/request-reset` | pública | token solo para credencial activa; respuesta uniforme | N/A | native-auth | Bajo; entrega depende de Resend |
| `POST /api/auth/reset` | token opaco | token no usado/no vencido | N/A | native-auth | Bajo; revoca sesiones nativas y Platform |
| `POST /api/auth/invitation-register` | token de invitación | correo de la invitación; un uso | Org derivada | onboarding → tenancy | Bajo tras prueba de correo diferente |
| `POST /api/auth/employee-register` | token de empleado | correo/vínculo de enrollment | Org/Branch derivadas | mobile-attendance | Medio: requiere ampliar pruebas del ciclo completo |
| `GET/POST /api/customer/onboarding` | cookie, salvo preview de invitación | permisos de onboarding por acción | Org; recursos con branch se validan en repository | tenancy → d1-tenancy | Medio: superficie grande; faltan pruebas por cada tipo de recurso |
| `GET/POST /api/customer/dashboard` | cookie | `dashboard.read/configure`; override requiere gestión | Org/Branch | tenant-dashboard → d1-dashboard | Bajo/medio; probado indirectamente por patrón, falta suite por widget |
| `GET/POST /api/customer/operations` | cookie | permisos `personnel.*`, `devices.*` por acción | Org/Branch | tenant-operations → d1-operational | Bajo para empleados tras ataques A/B y branch A1/A2; ampliar a dispositivos/biometría |
| `GET /api/customer/operations/export` | cookie | `personnel.attendance.export` | Org/Branch | tenant-operations → d1-operational | Medio; falta prueba de descarga cruzada |
| `GET/POST /api/customer/quality` | cookie | permisos `quality.*` por acción | Org/Branch | tenant-quality → d1-quality | Medio; repository filtra org/scope, falta fixture exhaustivo de logs/acciones |
| `POST /api/customer/quality/evidence` | cookie | `quality.evidence.upload` | Org/Branch/Log | tenant-quality → d1-quality | Bloqueado: no existe object-store; metadatos sí se autorizan |
| `GET /api/customer/quality/evidence/:id` | cookie | lectura de Calidad | Org/Branch/Evidence | tenant-quality → d1-quality | Bloqueado por object-store; lookup usa org + evidencia |
| `GET /api/customer/quality/export` | cookie | `quality.reports.export` | Org/Branch/Log | tenant-quality → d1-quality | Medio; falta prueba binaria cross-tenant |
| `GET/POST /api/customer/mobile-attendance` | cookie | administración de Personal/asistencia | Org/Branch/Employee | mobile-attendance → D1 | Medio; falta suite dedicada para enrollment revocado |
| `GET/POST /api/employee/attendance` | cookie | cuenta móvil activa | Org/Branch derivadas del vínculo | mobile-attendance → D1 | Bajo por diseño; cliente no elige organizationId |
| `POST /api/kiosk/events` | bearer de dispositivo | capability `attendance`; activo/no vencido | Org/Branch derivadas del token | kiosk-operations → d1-operational | Medio; falta prueba criptográfica completa del bearer y rotación |
| `GET /api/platform/mfa/setup` | cookie nativa | usuario Platform + `platform.security.manage` | Global Platform | platform-security | Bajo |
| `POST /api/platform/mfa/enroll` | cookie nativa + enrollment sellado | TOTP válido | Global Platform | platform-security | Bajo; se prueba rechazo de código incorrecto |
| `POST /api/platform/mfa/challenge` | cookie nativa | TOTP/recovery + límites de intento | Global Platform | platform-security | Medio; falta prueba temporal completa con TOTP real |
| `POST /api/platform/security/revoke-others` | cookie nativa + MFA | sesión Platform activa | Global Platform | platform-security | Bajo |
| `POST /api/platform/security/signout` | cookie nativa + MFA | sesión Platform activa | Global Platform | platform-security | Bajo |
| `GET/POST /api/platform/commercial` | cookie nativa + MFA | permiso específico por `view`/`action` | Global Platform | commercial → d1-commercial | Bajo/medio; permisos están mapeados, falta prueba de cada transición |
| `GET/POST /api/platform/tenancy` | cookie nativa + MFA | permiso específico por `view`/`action` | Global Platform; org explícita auditada | tenancy → d1-tenancy | Bajo/medio; falta prueba integral de aprovisionamiento |
| `GET/POST /api/platform/dashboard` | cookie nativa + MFA | `platform.dashboard_catalog.read/manage` | Global Platform | tenant-dashboard → d1-dashboard | Bajo |
| `GET /api/health` | pública | solo estado, nunca secretos | N/A | runtime DB | Bajo; el check de esquema aún es parcial |

## Páginas privadas

| Rutas | Guardia | Datos |
|---|---|---|
| `/app`, `/app/organizaciones`, `/app/onboarding/**` | `requireKitchenMindUser`; service vuelve a validar membresía | Turso/D1 |
| `/app/personal/**`, `/app/dispositivos`, `/app/actividad` | `requireKitchenMindUser`; Operations repository valida permiso/scope | Turso/D1 |
| `/app/calidad/**`, `/app/configuracion/dashboard`, `/app/sucursales/**` | `requireKitchenMindUser`; repositories de dominio revalidan org/branch | Turso/D1 |
| `/checar`, `/checar/activar` | sesión nativa o token personal | Turso/D1 |
| `/platform/**` | `PlatformRoute` o gate servidor + sesión MFA + permiso | Turso/D1 |
| `/kiosk/asistencia` | UI pública; cada API requiere bearer de dispositivo | Turso/D1 |
| `/demo/**` | sesión demo local claramente marcada | `LocalDemoProvider`/localStorage, nunca datos SaaS |
| rutas heredadas `/inventario`, `/compras`, `/empleados`, `/turnos`, `/calidad`, `/configuracion`, `/actividad`, `/kiro`, `/sucursales` | redirect permanente de producto a `/demo/**` | no renderizan directamente el proveedor local |

## Invariantes verificadas automáticamente

1. Un miembro de Organización A no puede listar Organización B.
2. No puede crear recursos indicando `organizationId` de B.
3. No puede modificar ni dar de baja un recurso de B usando su UUID bajo A.
4. Un miembro limitado a sucursal A1 no puede listar, crear, modificar ni dar de baja recursos de A2.
5. Los recursos atacados permanecen sin cambios después de cada intento.
6. Una invitación no puede ser aceptada por una sesión con correo diferente.
7. Sesiones nativas revocadas o vencidas dejan de resolver identidad.
8. Reset de contraseña es de un uso y revoca sesiones.
9. Platform rechaza identidades no autorizadas y exige MFA/sesión de segundo factor.

## Riesgos abiertos de esta fase

- La suite de aislamiento profundiza Personal/Empleados; debe replicarse con fixtures ricos para Calidad, Dashboard, dispositivos, asistencia móvil y onboarding.
- No se ejecutaron pruebas contra Turso remoto ni producción.
- Evidencias necesitan object storage antes de poder probar aislamiento binario extremo a extremo.
- El bridge biométrico es externo al repositorio y necesita una suite contractual separada.
- `GET /api/auth/logout` permite cierre de sesión inducido desde otro sitio; no filtra datos, pero puede endurecerse eliminando GET cuando se cambie la UX.
