CREATE TABLE IF NOT EXISTS mobile_attendance_policies (
  branch_id TEXT PRIMARY KEY NOT NULL REFERENCES tenant_branches(id),
  organization_id TEXT NOT NULL REFERENCES tenant_organizations(id),
  latitude REAL NOT NULL,
  longitude REAL NOT NULL,
  radius_meters INTEGER NOT NULL,
  max_accuracy_meters INTEGER NOT NULL,
  enabled INTEGER NOT NULL DEFAULT 0,
  updated_by_membership_id TEXT NOT NULL REFERENCES organization_memberships(id),
  updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS mobile_attendance_enrollments (
  id TEXT PRIMARY KEY NOT NULL,
  organization_id TEXT NOT NULL REFERENCES tenant_organizations(id),
  employee_id TEXT NOT NULL REFERENCES tenant_employees(id),
  email_normalized TEXT NOT NULL,
  token_hash TEXT NOT NULL UNIQUE,
  expires_at TEXT NOT NULL,
  used_at TEXT,
  created_by_membership_id TEXT NOT NULL REFERENCES organization_memberships(id),
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS mobile_attendance_enrollments_employee_idx ON mobile_attendance_enrollments(organization_id,employee_id,created_at);
CREATE TABLE IF NOT EXISTS mobile_attendance_accounts (
  employee_id TEXT PRIMARY KEY NOT NULL REFERENCES tenant_employees(id),
  organization_id TEXT NOT NULL REFERENCES tenant_organizations(id),
  auth_user_id TEXT NOT NULL,
  email_normalized TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  enrolled_at TEXT NOT NULL,
  revoked_at TEXT,
  UNIQUE(organization_id,auth_user_id)
);
CREATE TABLE IF NOT EXISTS mobile_attendance_evidence (
  event_id TEXT PRIMARY KEY NOT NULL REFERENCES operational_attendance_events(id),
  distance_meters INTEGER NOT NULL,
  accuracy_meters INTEGER NOT NULL,
  location_checked_at TEXT NOT NULL,
  policy_radius_meters INTEGER NOT NULL
);
INSERT OR IGNORE INTO organization_roles (id,organization_id,code,name,description,system_template,status,created_at,updated_at)
  SELECT id || ':role:employee','' || id,'employee','Empleado','Acceso personal al checado móvil.',1,'active',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP FROM tenant_organizations;
