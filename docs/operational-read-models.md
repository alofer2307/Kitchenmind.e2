# Read models operativos

Los read models iniciales se implementan en `D1DashboardRepository`. Reciben organización, sucursal ya autorizada, inicio de periodo y entitlements efectivos. Nunca cargan una organización completa para filtrarla después en React.

Read models disponibles:

- configuración operativa: empleados, turnos, servicios, versiones publicadas de calidad, productos, almacenes y dispositivos;
- actividad durable: bitácoras y acciones correctivas de calidad, movimientos de inventario e importaciones;
- preparación: onboarding;
- multisucursal: conteos y última actividad por sucursal;
- atención: preparación incompleta, importaciones, catálogos vacíos e inventario bajo con umbral real.

No disponibles todavía: eventos productivos de asistencia, servicios, compras, producción, confirmaciones offline y costos de merma. Esos módulos heredados no alimentan el dashboard productivo. Calidad ya usa su repositorio D1 multi-tenant y dejó de depender de las capturas del demo.

Para añadir un read model:

1. persistir eventos con `organization_id`, scope, actor, idempotencia y auditoría;
2. definir semántica temporal y zona horaria;
3. añadir índice y consulta acotada;
4. declarar frescura y comportamiento sin datos;
5. probar dos tenants, scope parcial, reintentos y límites;
6. cambiar la fuente a `available` sólo después de publicar la migración.
