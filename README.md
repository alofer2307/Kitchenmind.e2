# KitchenMind — Master Vercel 2026-09-19

KitchenMind es un SaaS B2B multiempresa y multisucursal para restaurantes, cocinas y comedores industriales. Esta entrega parte del último código completo recuperable de E.2 e integra los cambios confirmados del trabajo posterior en Work para convertirlo en un proyecto público normal, independiente del acceso privado de ChatGPT Sites.

## Estado de esta entrega

- Next.js App Router estándar para GitHub + Vercel.
- Acceso público con correo y contraseña propios de KitchenMind.
- Sesiones HTTP-only, hash de contraseñas con scrypt, bloqueo temporal por intentos y recuperación de contraseña.
- Invitaciones de clientes que crean cuenta y aceptan la organización sin depender de ChatGPT.
- Limpieza de CacheStorage, IndexedDB y sesión local al cerrar sesión.
- PWA sin cachear rutas autenticadas ni APIs privadas.
- D1 conservado como fuente de verdad para no romper el esquema multi-tenant existente.
- Adaptador D1 REST para Vercel con consultas por parámetros y batch.
- Migración `0012_native_auth_vercel.sql` para autenticación nativa.
- Endpoint `/api/health` para comprobar variables, conectividad y esquema.
- GitHub Actions de verificación y `vercel.json` incluidos.

## Módulos conservados

- KitchenMind Platform privada + MFA + permisos + auditoría.
- Prospectos, diagnósticos, catálogo, precios y cotizaciones.
- Aprovisionamiento, organizaciones, membresías, roles, scopes, entitlements y onboarding.
- Dashboard tenant-aware y multisucursal.
- Calidad, bitácoras, desviaciones y acciones correctivas.
- Personal, empleados, turnos e historial.
- Dispositivos, kiosco y asistencia idempotente/offline.
- Demo heredada aislada de los datos productivos.

## Comandos

```bash
npm ci
npm run dev
npm test
npm run typecheck
npm run build
```

Para migrar D1:

```bash
npm run db:migrate:remote
```

## Rutas principales

- `/login` — acceso productivo.
- `/recuperar` — recuperación de contraseña.
- `/aceptar-invitacion` — alta de cliente desde token.
- `/platform` — consola de la fundadora.
- `/platform/prospectos`
- `/platform/precios`
- `/platform/cotizaciones`
- `/app` — espacio del cliente.
- `/app/personal/empleados`
- `/app/personal/turnos`
- `/app/personal/asistencia`
- `/app/dispositivos`
- `/app/calidad`
- `/kiosk/asistencia`
- `/api/health`

## Despliegue

Lee `DEPLOY-VERCEL.md`. Nunca subas secretos al repositorio.

## Límite pendiente explícito

La persistencia binaria de evidencias de Calidad estaba ligada al bucket R2 privado del hosting anterior. En esta entrega se bloquea de forma segura hasta conectar un almacenamiento de objetos desde Vercel. El resto del producto no depende de ese adaptador para iniciar, autenticar usuarios u operar los módulos principales.
