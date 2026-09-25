# Seguridad de KitchenMind Platform

## Capas de acceso

1. La puerta pública autentica correo y contraseña contra credenciales nativas KitchenMind; la contraseña se almacena sólo como hash `scrypt`.
2. El bootstrap de propietaria exige coincidencia con `KITCHENMIND_PLATFORM_OWNER_EMAIL` y la contraseña inicial `KITCHENMIND_OWNER_PASSWORD`, ambas configuradas fuera del código.
3. La sesión pública usa un token aleatorio almacenado únicamente como hash en D1 y una cookie `HttpOnly`; cambiar contraseña revoca sesiones existentes.
4. Después del acceso principal, la propietaria debe verificar un TOTP de seis dígitos para entrar a Platform.
5. La sesión interna de Platform se mantiene separada, revocable y de duración limitada.
6. Cada endpoint vuelve a comprobar identidad, rol y permiso en el servidor.

El correo de la propietaria no aparece hardcodeado en componentes, JavaScript público ni migraciones.

## MFA y recuperación

- KitchenMind genera una clave TOTP compatible con aplicaciones de autenticación.
- El secreto se cifra con AES-256-GCM usando `KITCHENMIND_PLATFORM_MFA_KEY`.
- Se entregan diez códigos de recuperación una sola vez.
- La base conserva únicamente el hash de cada código.
- Un código utilizado se invalida de forma irreversible.
- Cinco intentos fallidos dentro de quince minutos bloquean temporalmente nuevos intentos.

La recuperación de la contraseña principal pertenece a KitchenMind y usa tokens de un solo uso con vencimiento. Los códigos de recuperación de Platform recuperan únicamente el segundo factor MFA.

## Sesiones

- Las sesiones guardan únicamente el hash del token.
- La pantalla de seguridad muestra cantidad activa, vencimiento e historial reciente.
- La propietaria puede cerrar todas las demás sesiones.
- Cerrar sesión revoca la sesión pública y la sesión interna de Platform, y el cliente limpia las cachés locales asociadas a la identidad.
- Cambiar `KITCHENMIND_PLATFORM_MFA_KEY` requiere un proceso controlado de rotación porque protege los secretos TOTP existentes.

## Auditoría

Se registran como mínimo:

- bootstrap de la propietaria;
- accesos o permisos denegados;
- alta y verificación de MFA;
- intentos fallidos;
- uso de códigos de recuperación;
- revocación de sesiones.

La auditoría de plataforma está separada de la auditoría de las organizaciones cliente.

## Permisos comerciales

Sprint B agrega permisos independientes para prospectos, diagnósticos, catálogo, pricing, cotizaciones, descuentos y auditoría comercial. `Platform Owner` los recibe mediante una actualización idempotente; no se asignan a usuarios de organizaciones.

Cada ruta vuelve a validar sesión y MFA en el servidor. Cada GET o POST comercial valida además el permiso granular; las mutaciones exigen mismo origen, tamaño limitado, entrada validada y control de frecuencia. Ocultar un botón no concede ni revoca autoridad.

La vista imprimible utiliza una proyección segura del servidor. Nunca incluye costos internos, margen, notas privadas, reglas técnicas, auditoría ni identificadores de origen.

## Roles futuros

El esquema permite añadir Platform Administrator, Sales, Implementation, Support y Billing. Agregar un colaborador exigirá un flujo explícito con permisos; nunca se deriva de un rol de una empresa cliente.

## Permisos de aprovisionamiento

Sprint C añade permisos separados para consultar, aprovisionar, activar y suspender organizaciones; gestionar onboarding; emitir o revocar invitaciones; consultar entitlements; y revisar importaciones. Platform Owner los obtiene mediante la misma inicialización idempotente.

La suspensión y reactivación requieren el permiso `platform.organizations.suspend`, motivo explícito y la versión vigente de la organización. La operación preserva todos los datos, actualiza de forma coherente la suscripción manual, invalida el acceso operativo mientras la organización está suspendida y registra auditoría de Platform y de la organización.

Una sesión de cliente nunca satisface un permiso `platform.*`. `/platform`, sus API y sus mutaciones vuelven a exigir identidad interna, MFA vigente y permiso granular. El enlace de invitación guarda únicamente un hash SHA-256, caduca, es de un solo uso y exige que el correo autenticado coincida con el destinatario.

## Acceso principal y supervisión

La ruta `/` consulta la puerta de seguridad de Platform en servidor. Una identidad interna con enrolamiento o reto pendiente entra a `/platform` para completar MFA; una identidad autorizada con sesión vigente también aterriza allí. La decisión no depende de React, `localStorage` ni parámetros del navegador.

Desde el detalle de una organización, Platform puede abrir `/platform/organizaciones/[organizationId]/operacion`. Es una vista de supervisión de solo lectura protegida por `platform.organizations.read`; no crea una membresía, no suplanta al cliente y no reutiliza una sesión Customer. Las acciones críticas continúan en el detalle auditado de la organización.

## Seguridad del Centro de Calidad

Calidad pertenece al espacio de cada organización, no a KitchenMind Platform. Sus permisos son independientes:

- `quality.logs.read`
- `quality.logs.capture`
- `quality.templates.manage`
- `quality.corrective.manage`
- `quality.evidence.upload`

Cada lectura y mutación resuelve en servidor sesión nativa, usuario activo, membresía activa, estado de organización, rol, permiso, entitlement `QUALITY` y alcance de sucursal. Las mutaciones exigen mismo origen, entrada validada y un límite de frecuencia por identidad; modificar `organizationId`, `branchId`, `logId` o `evidenceId` no amplía el alcance.

Las actualizaciones críticas usan versión esperada. Si dos sesiones intentan modificar el mismo registro, solamente una puede avanzar y la solicitud rechazada no genera un evento de auditoría exitoso.

Los metadatos de evidencia se guardan en D1; los binarios requieren un adaptador de almacenamiento privado conectado en Vercel. Cuando el adaptador está activo, los archivos se sirven sólo a través de un endpoint autorizado con `Cache-Control: private, no-store`, `X-Content-Type-Options: nosniff` y una política de contenido restrictiva. El nombre del archivo se trata como metadato; la clave de objeto es aleatoria y no se expone en la respuesta de snapshot.

La confirmación de cierre registra autoría, fecha y declaración aceptada. Se describe explícitamente como confirmación operacional y no como firma electrónica certificada.

## Seguridad de Personal, biometría y dispositivos

Personal usa permisos independientes para directorio, administración, asistencia, ajustes, exportación, biometría, turnos y dispositivos. Cada endpoint valida identidad, membresía activa, organización activa o restringida, entitlement `PERSONNEL`, permiso y scope de sucursal. Las escrituras se bloquean cuando la organización está restringida.

La respuesta también aplica mínimo privilegio: `personnel.employees.read` no implica conocer credenciales biométricas, eventos de asistencia ni inventario de dispositivos. Esos campos y métricas se omiten o se devuelven en cero hasta que exista el permiso correspondiente.

El kiosco no reutiliza una sesión administrativa. Presenta un token largo generado con entropía criptográfica; D1 conserva únicamente el hash SHA-256. Rotar o revocar invalida tokens previos. La autenticación comprueba credencial, dispositivo, sucursal y organización antes de actualizar `last_seen_at`.

La biometría se modela como referencia externa. Están prohibidos en D1, almacenamiento de objetos, navegador, logs y analítica: imagen de huella, WSQ, bitmap, base64 o plantilla biométrica cruda. Los lotes offline contienen sólo referencia externa, timestamps, claves idempotentes y metadatos mínimos del evento.
