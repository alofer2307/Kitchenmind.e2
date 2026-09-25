# Auditoría inicial del Sprint D

## Línea base

- Commit auditado: `7788576` (`fix(experience): connect productive access and redesign customer workspace`).
- El árbol de trabajo inició limpio; no se encontraron cambios de la usuaria que hubiera que separar.
- `npm run lint`, `npm run typecheck`, `npm test` y `npm run build` pasaban antes de modificar archivos. La línea base tenía 27 pruebas.
- El despliegue existente ya utilizaba Next.js App Router sobre Sites, D1, identidad del hosting, sesión Platform con MFA, permisos, auditoría, provisión y onboarding durable.

## Componentes reutilizados

- `D1TenancyDataProvider` como proveedor durable y preparado.
- Identidad SIWC y resolución de membresía cliente.
- Sesión Platform, MFA y catálogo idempotente de permisos.
- Entitlements, roles, scopes, sucursales y auditoría del Sprint C/C.1.
- Patrones existentes de services, repositories, API routes y migraciones Drizzle.
- Shell visual, tokens de marca y componentes responsivos de KitchenMind.

## Estado demostrativo y deuda relevante

- Las capturas operativas heredadas de asistencia, servicios, calidad, compras, producción, sincronización y merma todavía no tienen un read model D1 multi-tenant productivo.
- Por seguridad y honestidad, esas métricas deben permanecer como `unavailable`; no se pueden sustituir con los datos del demo, ceros ni `localStorage`.
- Los catálogos y movimientos creados durante onboarding sí son persistentes y pueden alimentar conteos reales iniciales.

## Riesgos controlados en el Sprint D

- Mezclar respuestas entre organizaciones, membresías o scopes mediante caché.
- Agregar una sucursal no autorizada dentro de un total multisucursal.
- Permitir que una preferencia agregue widgets, tamaños o filtros fuera del catálogo autorizado.
- Mostrar costos sensibles, acciones o controles administrativos sin permiso.
- Presentar una fuente ausente como un cero real.
- Perder cambios concurrentes de preferencias o catálogo.
- Conservar acciones habilitadas dentro de una copia offline.

La implementación se limitó al dominio de dashboards; no se añadieron cobros, suscripciones automáticas ni funciones de Sprints E/F.
