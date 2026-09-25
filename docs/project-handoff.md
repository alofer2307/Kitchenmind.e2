# Entrega maestra de KitchenMind para Vercel

Este repositorio es la fuente de verdad recuperable. La versión física parte de E.2 y reconstruye los cambios confirmados del trabajo posterior en Work: acceso público nativo, recuperación de contraseña, aceptación de invitaciones sin ChatGPT y aislamiento PWA/sesión.

## Recuperar en otra computadora

1. Instala Node.js 22.13 o posterior.
2. Descomprime el ZIP o clona el repositorio.
3. Ejecuta `npm ci`.
4. Ejecuta `npm test`, `npm run typecheck` y `npm run build`.
5. Configura las variables descritas en `.env.example`/`DEPLOY-VERCEL.md`.
6. Ejecuta `npm run db:migrate:remote` contra la D1 de KitchenMind.
7. Importa el repositorio en Vercel y valida `/api/health`.

## Contenido de la entrega

- código completo sin `node_modules`, cachés ni resultados de build;
- Next.js App Router estándar, sin Vinext ni bindings `cloudflare:workers`;
- migraciones D1, incluida `0012_native_auth_vercel.sql`;
- autenticación propia de KitchenMind y rutas de recuperación/invitación;
- service worker preparado para no cachear superficies autenticadas;
- workflow de GitHub para build verificable;
- manifiesto de handoff y documentación de despliegue.

Los datos productivos no están incluidos en el ZIP; permanecen en D1.

## Regla de continuidad

No edites migraciones ya aplicadas. Conserva la cadena UI → hooks/acciones → servicios → reglas → contratos → repositorios/proveedores → D1. URL, React state, localStorage o IndexedDB nunca son autoridad de tenant o permisos. No almacenes huellas crudas.

## Validación de esta reconstrucción

Las pruebas estáticas de preparación para Vercel y la validación sintáctica del código pasan en el entorno de reconstrucción. El build completo se deja además como gate obligatorio en GitHub Actions porque el entorno de empaquetado no pudo descargar dependencias de npm de forma fiable. La entrega no debe declararse desplegada hasta que ese workflow y el build de Vercel estén verdes.
