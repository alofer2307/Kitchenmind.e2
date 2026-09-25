# Auditoría inicial — Sprint C

## Estado verificado antes de cambios

- `npm run lint`: correcto.
- `npm run typecheck`: correcto.
- `npm test`: 15 pruebas correctas después del build existente.
- `npm run build`: correcto.
- Árbol de trabajo: limpio en `3672f49`.

## Arquitectura encontrada

Sprint A protege `/platform` con identidad de Sites, MFA, sesiones revocables, permisos y auditoría durable en D1. Sprint B usa servicios, repositorios y D1 para prospectos, diagnóstico, precios y cotizaciones inmutables. El producto operativo conserva una capa `LocalDemoProvider`, PWA y cola offline.

## Clasificación de organizaciones heredadas

- La pantalla y el asistente del “laboratorio de organizaciones” son demostrativos y usan el proveedor local.
- Perfiles, planes y módulos demo son reutilizables como referencia visual, no como autoridad contractual.
- Cotizaciones aceptadas y sus snapshots sí son productivos y se reutilizan como fuente del aprovisionamiento.
- Platform Security, MFA, auditoría y D1 son productivos y se conservan.

## Deuda y riesgos identificados

- Identidad, membresías y aislamiento de clientes no existían en almacenamiento durable.
- Un cliente externo aún no puede entrar mientras el Site conserve audiencia exclusiva de la propietaria.
- Los módulos operativos continúan usando datos demo y deben migrarse de manera incremental, no en Sprint C.
- D1 no ofrece Row Level Security; el aislamiento requiere validación obligatoria en rutas, servicios y repositorios hasta migrar a PostgreSQL/Supabase.
- No existe proveedor de correo; las invitaciones deben entregarse manualmente sin afirmar envío automático.

## Cambio mínimo elegido

Añadir un dominio multi-tenant D1 desacoplado, una migración aditiva, API Platform separada de API cliente, provisión idempotente, invitaciones con hash, RBAC, entitlements, onboarding e importación validada. No se reemplaza ni elimina la experiencia operativa existente.

## Validación final del Sprint C

- `npm run lint`: correcto.
- `npm run typecheck`: correcto.
- `npm run build`: correcto, incluidas las rutas privadas de Platform, invitación y onboarding cliente.
- `npm test`: 20 de 20 pruebas correctas.
- Migraciones `0002` a `0005`: aditivas, sin `DROP TABLE` ni `DELETE FROM`.
- Revisión de secretos: sin credenciales ni llaves privadas detectadas en el árbol del Sprint C.
- Persistencia oficial: D1; no se usa `localStorage` para identidad, membresías, organizaciones, entitlements, onboarding o importaciones.

La publicación conserva deliberadamente la audiencia privada de la propietaria. Por esa razón, el flujo técnico de invitación está completo, pero una empresa externa no podrá abrir el enlace hasta que KitchenMind autorice explícitamente una política de acceso para clientes.
