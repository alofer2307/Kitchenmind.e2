CREATE TABLE `biometric_credentials` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`person_id` text NOT NULL,
	`provider` text NOT NULL,
	`external_template_id` text NOT NULL,
	`device_id` text,
	`method` text DEFAULT 'fingerprint' NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`enrolled_at` text NOT NULL,
	`enrolled_by` text NOT NULL,
	`revoked_at` text,
	`revoked_by` text,
	`reason` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`version` integer DEFAULT 1 NOT NULL,
	FOREIGN KEY (`organization_id`) REFERENCES `tenant_organizations`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`person_id`) REFERENCES `tenant_people`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`device_id`) REFERENCES `tenant_devices`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`enrolled_by`) REFERENCES `organization_memberships`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`revoked_by`) REFERENCES `organization_memberships`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_biometric_credentials_org_provider_external` ON `biometric_credentials` (`organization_id`,`provider`,`external_template_id`);--> statement-breakpoint
CREATE INDEX `idx_biometric_credentials_person_status` ON `biometric_credentials` (`person_id`,`status`);--> statement-breakpoint
CREATE INDEX `idx_biometric_credentials_device_status` ON `biometric_credentials` (`device_id`,`status`);--> statement-breakpoint
CREATE TABLE `employee_branch_assignments` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`employee_id` text NOT NULL,
	`branch_id` text NOT NULL,
	`is_primary` integer DEFAULT false NOT NULL,
	`starts_on` text NOT NULL,
	`ends_on` text,
	`reason` text DEFAULT '' NOT NULL,
	`assigned_by` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`version` integer DEFAULT 1 NOT NULL,
	FOREIGN KEY (`organization_id`) REFERENCES `tenant_organizations`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`employee_id`) REFERENCES `tenant_employees`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`branch_id`) REFERENCES `tenant_branches`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`assigned_by`) REFERENCES `organization_memberships`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_employee_branch_assignment_start` ON `employee_branch_assignments` (`organization_id`,`employee_id`,`branch_id`,`starts_on`);--> statement-breakpoint
CREATE INDEX `idx_employee_branch_assignment_effective` ON `employee_branch_assignments` (`organization_id`,`employee_id`,`starts_on`,`ends_on`);--> statement-breakpoint
CREATE INDEX `idx_employee_branch_assignment_branch_dates` ON `employee_branch_assignments` (`organization_id`,`branch_id`,`starts_on`,`ends_on`);--> statement-breakpoint
CREATE TABLE `employee_shift_assignments` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`employee_id` text NOT NULL,
	`shift_id` text NOT NULL,
	`starts_on` text NOT NULL,
	`ends_on` text,
	`reason` text DEFAULT '' NOT NULL,
	`assigned_by` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`version` integer DEFAULT 1 NOT NULL,
	FOREIGN KEY (`organization_id`) REFERENCES `tenant_organizations`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`employee_id`) REFERENCES `tenant_employees`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`shift_id`) REFERENCES `tenant_shifts`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`assigned_by`) REFERENCES `organization_memberships`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_employee_shift_assignment_start` ON `employee_shift_assignments` (`organization_id`,`employee_id`,`starts_on`);--> statement-breakpoint
CREATE INDEX `idx_employee_shift_assignment_effective` ON `employee_shift_assignments` (`organization_id`,`employee_id`,`starts_on`,`ends_on`);--> statement-breakpoint
CREATE INDEX `idx_employee_shift_assignment_shift_dates` ON `employee_shift_assignments` (`organization_id`,`shift_id`,`starts_on`,`ends_on`);--> statement-breakpoint
CREATE TABLE `operational_attendance_events` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`branch_id` text NOT NULL,
	`employee_id` text NOT NULL,
	`person_id` text,
	`shift_id` text,
	`device_id` text,
	`biometric_credential_id` text,
	`event_type` text NOT NULL,
	`late_minutes` integer,
	`adjusted_event_type` text,
	`original_event_id` text,
	`event_timestamp` text NOT NULL,
	`operational_date` text NOT NULL,
	`source` text NOT NULL,
	`idempotency_key` text NOT NULL,
	`synchronization_status` text DEFAULT 'synced' NOT NULL,
	`offline_event_id` text,
	`reason` text,
	`recorded_by_membership_id` text,
	`server_received_at` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`organization_id`) REFERENCES `tenant_organizations`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`branch_id`) REFERENCES `tenant_branches`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`employee_id`) REFERENCES `tenant_employees`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`person_id`) REFERENCES `tenant_people`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`shift_id`) REFERENCES `tenant_shifts`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`device_id`) REFERENCES `tenant_devices`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`biometric_credential_id`) REFERENCES `biometric_credentials`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`recorded_by_membership_id`) REFERENCES `organization_memberships`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_operational_attendance_org_idempotency` ON `operational_attendance_events` (`organization_id`,`idempotency_key`);--> statement-breakpoint
CREATE UNIQUE INDEX `idx_operational_attendance_device_offline` ON `operational_attendance_events` (`device_id`,`offline_event_id`);--> statement-breakpoint
CREATE INDEX `idx_operational_attendance_org_branch_date` ON `operational_attendance_events` (`organization_id`,`branch_id`,`operational_date`);--> statement-breakpoint
CREATE INDEX `idx_operational_attendance_org_employee_time` ON `operational_attendance_events` (`organization_id`,`employee_id`,`event_timestamp`);--> statement-breakpoint
CREATE INDEX `idx_operational_attendance_org_person_time` ON `operational_attendance_events` (`organization_id`,`person_id`,`event_timestamp`);--> statement-breakpoint
CREATE INDEX `idx_operational_attendance_branch_date_type` ON `operational_attendance_events` (`organization_id`,`branch_id`,`operational_date`,`event_type`);--> statement-breakpoint
CREATE INDEX `idx_operational_attendance_employee_date_type` ON `operational_attendance_events` (`organization_id`,`employee_id`,`operational_date`,`event_type`);--> statement-breakpoint
CREATE INDEX `idx_operational_attendance_sync_time` ON `operational_attendance_events` (`organization_id`,`synchronization_status`,`server_received_at`);--> statement-breakpoint
CREATE TABLE `operational_service_attempts` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`branch_id` text NOT NULL,
	`person_id` text,
	`service_type_id` text,
	`device_id` text,
	`event_id` text,
	`result` text NOT NULL,
	`reason` text,
	`attempted_at` text NOT NULL,
	`operational_date` text NOT NULL,
	`idempotency_key` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`organization_id`) REFERENCES `tenant_organizations`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`branch_id`) REFERENCES `tenant_branches`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`person_id`) REFERENCES `tenant_people`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`service_type_id`) REFERENCES `tenant_service_types`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`device_id`) REFERENCES `tenant_devices`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`event_id`) REFERENCES `operational_service_events`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_operational_service_attempt_org_key` ON `operational_service_attempts` (`organization_id`,`idempotency_key`);--> statement-breakpoint
CREATE INDEX `idx_operational_service_attempt_org_date_result` ON `operational_service_attempts` (`organization_id`,`operational_date`,`result`);--> statement-breakpoint
CREATE INDEX `idx_operational_service_attempt_device_time` ON `operational_service_attempts` (`device_id`,`attempted_at`);--> statement-breakpoint
CREATE TABLE `operational_service_events` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`branch_id` text NOT NULL,
	`person_id` text NOT NULL,
	`employee_id` text,
	`client_id` text,
	`cost_center_id` text,
	`service_type_id` text NOT NULL,
	`device_id` text,
	`biometric_credential_id` text,
	`event_timestamp` text NOT NULL,
	`operational_date` text NOT NULL,
	`source` text NOT NULL,
	`idempotency_key` text NOT NULL,
	`synchronization_status` text DEFAULT 'synced' NOT NULL,
	`offline_event_id` text,
	`override` integer DEFAULT false NOT NULL,
	`override_reason` text,
	`authorized_by_membership_id` text,
	`server_received_at` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`organization_id`) REFERENCES `tenant_organizations`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`branch_id`) REFERENCES `tenant_branches`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`person_id`) REFERENCES `tenant_people`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`employee_id`) REFERENCES `tenant_employees`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`client_id`) REFERENCES `tenant_clients`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`cost_center_id`) REFERENCES `tenant_cost_centers`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`service_type_id`) REFERENCES `tenant_service_types`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`device_id`) REFERENCES `tenant_devices`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`biometric_credential_id`) REFERENCES `biometric_credentials`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`authorized_by_membership_id`) REFERENCES `organization_memberships`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_operational_service_org_idempotency` ON `operational_service_events` (`organization_id`,`idempotency_key`);--> statement-breakpoint
CREATE UNIQUE INDEX `idx_operational_service_device_offline` ON `operational_service_events` (`device_id`,`offline_event_id`);--> statement-breakpoint
CREATE INDEX `idx_operational_service_org_branch_date` ON `operational_service_events` (`organization_id`,`branch_id`,`operational_date`);--> statement-breakpoint
CREATE INDEX `idx_operational_service_person_type_date` ON `operational_service_events` (`organization_id`,`person_id`,`service_type_id`,`operational_date`);--> statement-breakpoint
CREATE INDEX `idx_operational_service_client_date` ON `operational_service_events` (`organization_id`,`client_id`,`operational_date`);--> statement-breakpoint
CREATE INDEX `idx_operational_service_sync_time` ON `operational_service_events` (`organization_id`,`synchronization_status`,`server_received_at`);--> statement-breakpoint
CREATE TABLE `operational_sync_batches` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`branch_id` text NOT NULL,
	`device_id` text NOT NULL,
	`idempotency_key` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`event_count` integer DEFAULT 0 NOT NULL,
	`accepted_count` integer DEFAULT 0 NOT NULL,
	`rejected_count` integer DEFAULT 0 NOT NULL,
	`attempt_count` integer DEFAULT 0 NOT NULL,
	`last_error` text,
	`started_at` text NOT NULL,
	`completed_at` text,
	`last_attempt_at` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`organization_id`) REFERENCES `tenant_organizations`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`branch_id`) REFERENCES `tenant_branches`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`device_id`) REFERENCES `tenant_devices`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_operational_sync_batch_org_key` ON `operational_sync_batches` (`organization_id`,`idempotency_key`);--> statement-breakpoint
CREATE INDEX `idx_operational_sync_batch_org_status_time` ON `operational_sync_batches` (`organization_id`,`status`,`created_at`);--> statement-breakpoint
CREATE INDEX `idx_operational_sync_batch_device_status` ON `operational_sync_batches` (`device_id`,`status`,`created_at`);--> statement-breakpoint
CREATE TABLE `operational_sync_items` (
	`id` text PRIMARY KEY NOT NULL,
	`batch_id` text NOT NULL,
	`entity_type` text NOT NULL,
	`offline_event_id` text NOT NULL,
	`idempotency_key` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`server_entity_id` text,
	`error_code` text,
	`error_message` text,
	`attempt_count` integer DEFAULT 0 NOT NULL,
	`last_attempt_at` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`batch_id`) REFERENCES `operational_sync_batches`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_operational_sync_item_batch_offline` ON `operational_sync_items` (`batch_id`,`offline_event_id`);--> statement-breakpoint
CREATE INDEX `idx_operational_sync_item_batch_status` ON `operational_sync_items` (`batch_id`,`status`);--> statement-breakpoint
CREATE TABLE `quality_log_escalations` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`branch_id` text NOT NULL,
	`log_instance_id` text NOT NULL,
	`level` integer DEFAULT 1 NOT NULL,
	`severity` text DEFAULT 'warning' NOT NULL,
	`reason` text NOT NULL,
	`escalated_to_membership_id` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`organization_id`) REFERENCES `tenant_organizations`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`branch_id`) REFERENCES `tenant_branches`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`log_instance_id`) REFERENCES `quality_log_instances`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`escalated_to_membership_id`) REFERENCES `organization_memberships`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_quality_log_escalation_level` ON `quality_log_escalations` (`log_instance_id`,`level`);--> statement-breakpoint
CREATE INDEX `idx_quality_log_escalation_org_time` ON `quality_log_escalations` (`organization_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `quality_schedule_rules` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`branch_id` text NOT NULL,
	`template_version_id` text NOT NULL,
	`shift_id` text,
	`assigned_to_membership_id` text,
	`schedule_type` text NOT NULL,
	`days_of_week_json` text DEFAULT '[]' NOT NULL,
	`times_json` text DEFAULT '[]' NOT NULL,
	`interval_minutes` integer,
	`timezone` text NOT NULL,
	`start_date` text NOT NULL,
	`end_date` text,
	`status` text DEFAULT 'active' NOT NULL,
	`idempotency_key` text NOT NULL,
	`last_generated_through` text,
	`created_by` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`version` integer DEFAULT 1 NOT NULL,
	FOREIGN KEY (`organization_id`) REFERENCES `tenant_organizations`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`branch_id`) REFERENCES `tenant_branches`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`template_version_id`) REFERENCES `quality_template_versions`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`shift_id`) REFERENCES `tenant_shifts`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`assigned_to_membership_id`) REFERENCES `organization_memberships`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`created_by`) REFERENCES `organization_memberships`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_quality_schedule_org_key` ON `quality_schedule_rules` (`organization_id`,`idempotency_key`);--> statement-breakpoint
CREATE INDEX `idx_quality_schedule_org_branch_status` ON `quality_schedule_rules` (`organization_id`,`branch_id`,`status`);--> statement-breakpoint
CREATE INDEX `idx_quality_schedule_template_status` ON `quality_schedule_rules` (`template_version_id`,`status`);--> statement-breakpoint
CREATE INDEX `idx_quality_schedule_status_org` ON `quality_schedule_rules` (`status`,`organization_id`,`last_generated_through`);--> statement-breakpoint
CREATE TABLE `quality_schedule_runs` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`rule_id` text NOT NULL,
	`generated_through` text NOT NULL,
	`generated_count` integer DEFAULT 0 NOT NULL,
	`reused_count` integer DEFAULT 0 NOT NULL,
	`status` text NOT NULL,
	`error_summary` text,
	`idempotency_key` text NOT NULL,
	`started_at` text NOT NULL,
	`completed_at` text,
	FOREIGN KEY (`organization_id`) REFERENCES `tenant_organizations`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`rule_id`) REFERENCES `quality_schedule_rules`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_quality_schedule_runs_org_key` ON `quality_schedule_runs` (`organization_id`,`idempotency_key`);--> statement-breakpoint
CREATE INDEX `idx_quality_schedule_runs_rule_time` ON `quality_schedule_runs` (`rule_id`,`started_at`);--> statement-breakpoint
CREATE TABLE `tenant_clients` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`code` text NOT NULL,
	`name` text NOT NULL,
	`billing_reference` text,
	`status` text DEFAULT 'active' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`created_by` text NOT NULL,
	`version` integer DEFAULT 1 NOT NULL,
	FOREIGN KEY (`organization_id`) REFERENCES `tenant_organizations`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`created_by`) REFERENCES `organization_memberships`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_tenant_clients_org_code` ON `tenant_clients` (`organization_id`,`code`);--> statement-breakpoint
CREATE INDEX `idx_tenant_clients_org_status` ON `tenant_clients` (`organization_id`,`status`);--> statement-breakpoint
CREATE TABLE `tenant_cost_centers` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`client_id` text,
	`branch_id` text,
	`code` text NOT NULL,
	`name` text NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`created_by` text NOT NULL,
	`version` integer DEFAULT 1 NOT NULL,
	FOREIGN KEY (`organization_id`) REFERENCES `tenant_organizations`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`client_id`) REFERENCES `tenant_clients`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`branch_id`) REFERENCES `tenant_branches`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`created_by`) REFERENCES `organization_memberships`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_tenant_cost_centers_org_code` ON `tenant_cost_centers` (`organization_id`,`code`);--> statement-breakpoint
CREATE INDEX `idx_tenant_cost_centers_client_status` ON `tenant_cost_centers` (`client_id`,`status`);--> statement-breakpoint
CREATE TABLE `tenant_device_credentials` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`device_id` text NOT NULL,
	`token_hash` text NOT NULL,
	`token_prefix` text NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`issued_at` text NOT NULL,
	`issued_by` text NOT NULL,
	`expires_at` text,
	`last_used_at` text,
	`revoked_at` text,
	`revoked_by` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`organization_id`) REFERENCES `tenant_organizations`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`device_id`) REFERENCES `tenant_devices`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`issued_by`) REFERENCES `organization_memberships`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`revoked_by`) REFERENCES `organization_memberships`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_tenant_device_credentials_hash` ON `tenant_device_credentials` (`token_hash`);--> statement-breakpoint
CREATE INDEX `idx_tenant_device_credentials_device_status` ON `tenant_device_credentials` (`device_id`,`status`,`expires_at`);--> statement-breakpoint
CREATE TABLE `tenant_people` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`branch_id` text NOT NULL,
	`employee_id` text,
	`client_id` text,
	`cost_center_id` text,
	`external_number` text,
	`name` text NOT NULL,
	`first_name` text,
	`last_name` text,
	`second_last_name` text,
	`photo_reference` text,
	`person_type` text DEFAULT 'employee' NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`created_by` text NOT NULL,
	`version` integer DEFAULT 1 NOT NULL,
	FOREIGN KEY (`organization_id`) REFERENCES `tenant_organizations`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`branch_id`) REFERENCES `tenant_branches`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`employee_id`) REFERENCES `tenant_employees`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`client_id`) REFERENCES `tenant_clients`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`cost_center_id`) REFERENCES `tenant_cost_centers`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`created_by`) REFERENCES `organization_memberships`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_tenant_people_employee` ON `tenant_people` (`employee_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `idx_tenant_people_org_external` ON `tenant_people` (`organization_id`,`external_number`);--> statement-breakpoint
CREATE INDEX `idx_tenant_people_org_branch_status` ON `tenant_people` (`organization_id`,`branch_id`,`status`);--> statement-breakpoint
CREATE INDEX `idx_tenant_people_client_status` ON `tenant_people` (`client_id`,`status`);--> statement-breakpoint
ALTER TABLE `quality_corrective_actions` ADD `immediate_correction` text;--> statement-breakpoint
ALTER TABLE `quality_corrective_actions` ADD `preventive_action` text;--> statement-breakpoint
ALTER TABLE `quality_corrective_actions` ADD `verified_at` text;--> statement-breakpoint
ALTER TABLE `quality_corrective_actions` ADD `verified_by` text REFERENCES organization_memberships(id);--> statement-breakpoint
ALTER TABLE `quality_evidence` ADD `evidence_type` text DEFAULT 'general' NOT NULL;--> statement-breakpoint
ALTER TABLE `tenant_devices` ADD `device_type` text DEFAULT 'kiosk' NOT NULL;--> statement-breakpoint
ALTER TABLE `tenant_devices` ADD `provider` text DEFAULT 'generic' NOT NULL;--> statement-breakpoint
ALTER TABLE `tenant_devices` ADD `serial_number` text;--> statement-breakpoint
ALTER TABLE `tenant_devices` ADD `capabilities_json` text DEFAULT '[]' NOT NULL;--> statement-breakpoint
ALTER TABLE `tenant_devices` ADD `configuration_json` text DEFAULT '{}' NOT NULL;--> statement-breakpoint
ALTER TABLE `tenant_devices` ADD `health_json` text DEFAULT '{}' NOT NULL;--> statement-breakpoint
ALTER TABLE `tenant_devices` ADD `bridge_version` text;--> statement-breakpoint
ALTER TABLE `tenant_devices` ADD `last_health_at` text;--> statement-breakpoint
ALTER TABLE `tenant_devices` ADD `last_seen_at` text;--> statement-breakpoint
ALTER TABLE `tenant_devices` ADD `last_sync_at` text;--> statement-breakpoint
ALTER TABLE `tenant_devices` ADD `registered_at` text DEFAULT '1970-01-01T00:00:00.000Z' NOT NULL;--> statement-breakpoint
ALTER TABLE `tenant_devices` ADD `version` integer DEFAULT 1 NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX `idx_tenant_devices_org_serial` ON `tenant_devices` (`organization_id`,`serial_number`);--> statement-breakpoint
CREATE INDEX `idx_tenant_devices_org_seen` ON `tenant_devices` (`organization_id`,`last_seen_at`);--> statement-breakpoint
CREATE INDEX `idx_tenant_devices_org_health` ON `tenant_devices` (`organization_id`,`branch_id`,`last_health_at`);--> statement-breakpoint
ALTER TABLE `tenant_employees` ADD `hired_at` text;--> statement-breakpoint
ALTER TABLE `tenant_employees` ADD `terminated_at` text;--> statement-breakpoint
ALTER TABLE `tenant_employees` ADD `version` integer DEFAULT 1 NOT NULL;--> statement-breakpoint
CREATE INDEX `idx_organization_audit_org_entity_time` ON `organization_audit_events` (`organization_id`,`entity_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `idx_quality_answers_range_time` ON `quality_log_answers` (`in_range`,`captured_at`,`log_instance_id`,`field_id`);--> statement-breakpoint
CREATE INDEX `idx_quality_logs_status_due_org` ON `quality_log_instances` (`status`,`due_at`,`organization_id`);