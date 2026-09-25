# Personal — Sprint E.2

## Alcance

Personal es un dominio productivo tenant-aware separado de los usuarios que inician sesión en KitchenMind. Un empleado puede existir, registrar asistencia y tener biometría externa sin ser un `customer_user`.

## Modelo

- `tenant_employees`: relación laboral, número de empleado, sucursal principal, turno vigente, estado y vigencia laboral.
- `tenant_people`: identidad operativa reutilizable. En E.2 únicamente se expone el tipo `employee`.
- `employee_branch_assignments`: historial de sucursales con vigencia.
- `employee_shift_assignments`: historial de turnos con vigencia.

Estados laborales: `active`, `inactive`, `suspended`, `terminated`. Solo `active` registra asistencia normal.

## Importación masiva

`/app/personal/empleados` permite importar CSV con los encabezados:

`employee_number,name,email,branch_code,shift_code,hired_at,status`

La validación es previa y total. Si existe una fila duplicada o rechazada, el commit no inserta ninguna fila. El límite de una operación es 5,000 empleados.

## Seguridad

Todas las mutaciones validan membresía, permiso, módulo PERSONNEL y branch scope en servidor. El número de empleado es único por organización.
