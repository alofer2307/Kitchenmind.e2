# Identidad y acceso del cliente

KitchenMind usa cuatro conceptos distintos:

- Platform User: equipo interno con MFA y permisos `platform.*`.
- Customer User: cuenta nativa KitchenMind autenticada por correo y contraseña.
- Membership: vínculo explícito entre identidad y organización.
- Employee: persona operativa que puede no iniciar sesión.

La aceptación exige token válido, pendiente y no vencido, además de coincidencia exacta del correo normalizado. Después se crea o vincula el Customer User, una membresía activa, el rol correspondiente y el alcance autorizado.

Cada solicitud posterior vuelve a resolver la sesión y la membresía en servidor. Enviar otro `organizationId` no concede acceso. Suspender la membresía o la organización impide continuar.

Cuando una identidad tiene una sola membresía, KitchenMind selecciona esa organización automáticamente. Si tiene varias, la interfaz sólo ofrece las organizaciones devueltas por sus membresías activas y el servidor vuelve a validar la selección.

## Sesiones y contraseñas

La cookie `kitchenmind_session` contiene un token aleatorio; D1 conserva solamente su hash y vencimiento. La cookie es `HttpOnly`, `SameSite=Lax` y `Secure` en producción. Las contraseñas usan `scrypt` con salt individual. Ocho intentos fallidos provocan un bloqueo temporal de 15 minutos. El flujo de recuperación usa tokens de un solo uso con vencimiento y revoca sesiones existentes al establecer una contraseña nueva.

En producción, el correo de recuperación puede enviarse con Resend si existen `RESEND_API_KEY` y `AUTH_EMAIL_FROM`. El token nunca se devuelve al cliente en producción.

## Acceso al tablero

Después de autenticar, `/app` no confía en selecciones previas del navegador. El servidor resuelve una membresía activa, el estado operativo de la organización, roles, permisos y scopes. Una organización en onboarding continúa en `/app/onboarding`; una suspendida no obtiene dashboard. La identidad cliente nunca satisface permisos `platform.*`, y la fundadora inspecciona configuración desde Platform sin suplantar una membresía.
