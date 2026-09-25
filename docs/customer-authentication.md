# Autenticación productiva del cliente

## Identidades separadas

KitchenMind distingue Platform User, Customer User, Membership y Employee. La identidad principal se autentica con credenciales nativas de KitchenMind. Las contraseñas se almacenan únicamente como hash `scrypt`; las sesiones usan tokens aleatorios cuyo hash se persiste en D1 y la cookie del navegador es `HttpOnly`. Platform conserva además MFA, permisos `platform.*` y su sesión interna de seguridad. Un Customer User nunca satisface permisos `platform.*`.

## Destino después de iniciar sesión

La ruta `/` decide en servidor:

| Condición | Destino |
| --- | --- |
| Platform User con MFA pendiente | `/platform` y reto MFA |
| Platform User autorizado | `/platform` |
| Cliente con varias membresías | `/app/organizaciones` |
| Cliente con una organización no activa | `/app/onboarding` |
| Cliente con una organización activa o restringida | `/app` |
| Sin membresía | estado de acceso no disponible |
| Organización suspendida o cancelada | estado restringido, sin datos operativos |

La aceptación de invitación exige token vigente de un solo uso y correo coincidente. Solo se almacena el hash del token. Si el destinatario todavía no tiene cuenta, puede establecer su contraseña desde la propia invitación; después se crea o vincula el usuario, se activa la membresía, se asignan rol y alcance y se registra auditoría.

## Validación por solicitud

Cada consulta productiva sigue `sesión nativa → usuario activo → membresía activa → organización → permiso → alcance → entitlement → recurso`. El selector es una ayuda de navegación; el repositorio vuelve a verificar todos los identificadores. Suspender la membresía o la organización invalida el acceso a `/app`.

Cambiar la contraseña revoca las sesiones nativas existentes. El cierre de sesión elimina además CacheStorage e IndexedDB de KitchenMind para que un segundo usuario del mismo equipo no herede datos del anterior. La PWA no almacena HTML autenticado ni respuestas de APIs privadas.
