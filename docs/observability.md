# Observabilidad de dashboards

La observabilidad se apoya en datos durables y respuestas explícitas:

- `freshness.generatedAt`, `expiresAt`, `mode` y conteo de fuentes no disponibles;
- `dashboard_cache_entries` para inspeccionar scope, versión y expiración;
- `organization_audit_events` para preferencias, restablecimientos, overrides, rechazos de sucursal y exportaciones;
- `platform_audit_events` para cambios globales de widgets y overrides internos;
- errores públicos con códigos estables, sin SQL, secretos ni identificadores de otros tenants.

Indicadores operativos recomendados para una etapa posterior son latencia p50/p95 por preset, tasa de cache hit, fuentes stale/unavailable, rechazos por scope, conflictos de versión y errores por read model. No se agregan servicios externos en Sprint D.

Para diagnosticar una incidencia se revisa: identidad/membresía, organización, scopes, entitlements, preset resuelto, versión de preferencia, clave de caché y fuente del widget. Nunca se registran tokens de invitación, MFA, snapshots completos sensibles ni datos comerciales internos en logs cliente.
