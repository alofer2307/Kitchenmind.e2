# Despliegue de KitchenMind — GitHub + Vercel

La guía operativa principal es `DEPLOY-VERCEL.md`. Este documento resume las invariantes de publicación.

## 1. Validar el código

```bash
npm ci
npm test
npm run typecheck
npm run build
```

El workflow `.github/workflows/verify.yml` ejecuta esas comprobaciones en cada push a `main` y en pull requests. No promociones a producción un commit cuyo workflow falle.

## 2. Recursos y secretos

La base productiva `kitchenmind-production` está conectada mediante la integración Turso de Vercel. Conserva el esquema SQLite. También se admite una instalación Cloudflare D1 existente si se configuran sus tres variables de servidor.

Variables obligatorias:

- `TURSO_DATABASE_URL`
- `TURSO_AUTH_TOKEN`
- `KITCHENMIND_PLATFORM_OWNER_EMAIL`
- `KITCHENMIND_OWNER_PASSWORD`
- `KITCHENMIND_PLATFORM_MFA_KEY`
- `NEXT_PUBLIC_APP_URL`

Opcionales para recuperación por correo:

- `RESEND_API_KEY`
- `AUTH_EMAIL_FROM`

No guardes valores reales en Git, ZIPs, logs o código cliente.

## 3. Migraciones

Ejecuta una vez, con las variables anteriores disponibles:

```bash
npm run db:migrate:remote
```

`scripts/apply-d1-migrations.mjs` funciona con Turso o Cloudflare D1 y reconoce una instalación E.2 existente mediante sentinelas antes de aplicar las migraciones faltantes. `0012_native_auth_vercel.sql` agrega credenciales, sesiones y recuperación nativas; `0013_mobile_attendance.sql` agrega políticas por sucursal, invitaciones, cuentas y evidencia de ubicación del checado móvil.

## 4. Publicación

Importa el repositorio en Vercel como Next.js. `vercel.json` declara `npm ci` como instalación y `npm run build` como build. Después de publicar abre `/api/health`; producción debe responder `ready: true` antes de usarla.

## 5. Smoke test

1. Inicia sesión en `/login` con la cuenta propietaria y completa MFA de Platform.
2. Verifica prospectos, precios, cotizaciones y organizaciones existentes.
3. Abre una organización activa y confirma dashboard, Personal, turnos y asistencia.
4. Prueba una invitación de cliente en navegador privado: crear contraseña, aceptar membresía y completar onboarding.
5. Cierra sesión, entra con otro usuario y confirma que no aparece información del usuario anterior.
6. Verifica kiosco/dispositivo con una credencial vigente.
7. Confirma que un rol sin permisos no obtiene datos cambiando URL ni llamando directamente a la API.
8. La evidencia binaria de Calidad se prueba únicamente después de conectar el adaptador privado de objetos.

## 6. Checado móvil real

En la organización activa, carga empleados con correo único y asigna sus sucursales y turnos. En **Personal → Asistencia**, selecciona una sucursal; un usuario de RH con permiso de ajuste configura la latitud, longitud, radio y precisión permitidos. Verifica físicamente el centro antes de activar la casilla. Luego genera una invitación individual y comparte el enlace únicamente con la persona indicada. El enlace vence a los siete días y se usa una vez. La persona activa su cuenta con contraseña y entra en `/checar` desde su celular para registrar entrada y salida con permiso de ubicación.

Los eventos quedan en `operational_attendance_events`, la misma fuente de reportes y ajustes auditados. La hora de asistencia procede del servidor; se conserva la distancia calculada y precisión reportada, sin almacenar coordenadas individuales. Una ubicación del dispositivo puede alterarse con herramientas externas: para casos disputados usa los ajustes de RH y el registro de auditoría. El envío de enlaces es manual; no existe una automatización de WhatsApp. El kiosco con lector biométrico sigue siendo una alternativa opcional.

## 7. Bridge biométrico

El navegador no reconoce huellas por sí solo. KitchenMind espera un bridge local que implemente el contrato de `docs/biometric-architecture.md`. Hasta seleccionar lector y SDK, la arquitectura sólo maneja referencias externas opacas; nunca almacena huellas crudas.

## 8. Recuperación

Si una publicación falla, revierte el deployment en Vercel o corrige el código y vuelve a desplegar. No reviertas la base de forma destructiva, no edites una migración ya aplicada y no ejecutes `DROP` para "arreglar" un despliegue.
