# Auditoría previa al Sprint B — 4 de septiembre de 2026

## Estado inicial verificado

Antes de modificar el dominio comercial se revisaron rutas, componentes, hooks, providers, repositorios, servicios, reglas, tipos, migraciones, autenticación, PWA, hosting y pruebas. El árbol de Git estaba limpio en `39d67ae` y pasaron `npm run lint`, `npm test`, la comprobación estricta de TypeScript y `npm run build`.

## Base reutilizada

- `/platform` ya estaba protegido en servidor con identidad verificada, MFA, sesiones revocables, permisos y auditoría D1.
- La aplicación ya separaba UI, servicios, repositorios y proveedores.
- El diseño, navegación, PWA, kioscos y módulos operativos funcionaban y no necesitaban reescritura.
- Drizzle y el flujo de migraciones del hosting ya estaban disponibles.

## Deuda observada al iniciar

- Organizaciones y operación de clientes continúan como demostración local; todavía no existe aislamiento multi-tenant productivo de clientes.
- Prospectos, diagnóstico, precios y cotizaciones no existían de forma durable.
- Los planes y precios visibles eran demostrativos, sin publicación, snapshots ni historial contractual.
- No existían cobro, facturación fiscal, provisión productiva ni onboarding transaccional.

## Riesgos controlados en este sprint

- No usar estado del navegador como fuente comercial oficial.
- No mezclar usuarios cliente con permisos `platform.*`.
- Guardar dinero en unidad mínima y calcularlo en el servidor.
- Hacer inmutables las versiones publicadas y las revisiones enviadas.
- Aplicar idempotencia, control de versión y folios atómicos para evitar duplicados y sobrescrituras.

El Sprint B se construyó encima de Sprint A y no altera las funciones operativas existentes.
