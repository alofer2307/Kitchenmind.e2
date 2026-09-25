CREATE TABLE `quality_corrective_actions` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`branch_id` text NOT NULL,
	`log_instance_id` text NOT NULL,
	`answer_id` text,
	`title` text NOT NULL,
	`description` text NOT NULL,
	`severity` text DEFAULT 'warning' NOT NULL,
	`status` text DEFAULT 'open' NOT NULL,
	`assigned_to_membership_id` text,
	`due_at` text,
	`root_cause` text,
	`resolution` text,
	`verification_notes` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`created_by` text NOT NULL,
	`resolved_at` text,
	`resolved_by` text,
	`version` integer DEFAULT 1 NOT NULL,
	FOREIGN KEY (`organization_id`) REFERENCES `tenant_organizations`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`branch_id`) REFERENCES `tenant_branches`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`log_instance_id`) REFERENCES `quality_log_instances`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`answer_id`) REFERENCES `quality_log_answers`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`assigned_to_membership_id`) REFERENCES `organization_memberships`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`created_by`) REFERENCES `organization_memberships`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`resolved_by`) REFERENCES `organization_memberships`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_quality_corrective_answer` ON `quality_corrective_actions` (`answer_id`);--> statement-breakpoint
CREATE INDEX `idx_quality_corrective_org_status_due` ON `quality_corrective_actions` (`organization_id`,`status`,`due_at`);--> statement-breakpoint
CREATE INDEX `idx_quality_corrective_branch_status` ON `quality_corrective_actions` (`branch_id`,`status`);--> statement-breakpoint
CREATE TABLE `quality_evidence` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`branch_id` text NOT NULL,
	`log_instance_id` text NOT NULL,
	`answer_id` text,
	`corrective_action_id` text,
	`object_key` text NOT NULL,
	`file_name` text NOT NULL,
	`mime_type` text NOT NULL,
	`size_bytes` integer NOT NULL,
	`sha256` text NOT NULL,
	`note` text DEFAULT '' NOT NULL,
	`status` text DEFAULT 'available' NOT NULL,
	`captured_at` text NOT NULL,
	`captured_by` text NOT NULL,
	`version` integer DEFAULT 1 NOT NULL,
	FOREIGN KEY (`organization_id`) REFERENCES `tenant_organizations`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`branch_id`) REFERENCES `tenant_branches`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`log_instance_id`) REFERENCES `quality_log_instances`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`answer_id`) REFERENCES `quality_log_answers`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`corrective_action_id`) REFERENCES `quality_corrective_actions`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`captured_by`) REFERENCES `organization_memberships`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_quality_evidence_object_key` ON `quality_evidence` (`object_key`);--> statement-breakpoint
CREATE INDEX `idx_quality_evidence_org_log` ON `quality_evidence` (`organization_id`,`log_instance_id`,`captured_at`);--> statement-breakpoint
CREATE INDEX `idx_quality_evidence_action` ON `quality_evidence` (`corrective_action_id`,`captured_at`);--> statement-breakpoint
CREATE TABLE `quality_log_answers` (
	`id` text PRIMARY KEY NOT NULL,
	`log_instance_id` text NOT NULL,
	`field_id` text NOT NULL,
	`value_type` text NOT NULL,
	`has_value` integer DEFAULT true NOT NULL,
	`value_text` text,
	`numeric_value_milli` integer,
	`boolean_value` integer,
	`option_value` text,
	`in_range` integer,
	`notes` text DEFAULT '' NOT NULL,
	`captured_at` text NOT NULL,
	`captured_by` text NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`version` integer DEFAULT 1 NOT NULL,
	FOREIGN KEY (`log_instance_id`) REFERENCES `quality_log_instances`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`field_id`) REFERENCES `quality_template_fields`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`captured_by`) REFERENCES `organization_memberships`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_quality_answers_log_field` ON `quality_log_answers` (`log_instance_id`,`field_id`);--> statement-breakpoint
CREATE INDEX `idx_quality_answers_log_range` ON `quality_log_answers` (`log_instance_id`,`in_range`);--> statement-breakpoint
CREATE TABLE `quality_log_instances` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`branch_id` text NOT NULL,
	`template_version_id` text NOT NULL,
	`shift_id` text,
	`operational_date` text NOT NULL,
	`due_at` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`completion_percentage` integer DEFAULT 0 NOT NULL,
	`deviation_count` integer DEFAULT 0 NOT NULL,
	`assigned_to_membership_id` text,
	`started_at` text,
	`completed_at` text,
	`signed_at` text,
	`signed_by_membership_id` text,
	`signer_name_snapshot` text,
	`signature_statement` text,
	`revision_of_log_id` text,
	`revision_number` integer DEFAULT 1 NOT NULL,
	`revision_reason` text,
	`cancellation_reason` text,
	`idempotency_key` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`created_by` text NOT NULL,
	`version` integer DEFAULT 1 NOT NULL,
	FOREIGN KEY (`organization_id`) REFERENCES `tenant_organizations`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`branch_id`) REFERENCES `tenant_branches`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`template_version_id`) REFERENCES `quality_template_versions`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`shift_id`) REFERENCES `tenant_shifts`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`assigned_to_membership_id`) REFERENCES `organization_memberships`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`signed_by_membership_id`) REFERENCES `organization_memberships`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`created_by`) REFERENCES `organization_memberships`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_quality_logs_org_idempotency` ON `quality_log_instances` (`organization_id`,`idempotency_key`);--> statement-breakpoint
CREATE INDEX `idx_quality_logs_org_branch_date` ON `quality_log_instances` (`organization_id`,`branch_id`,`operational_date`);--> statement-breakpoint
CREATE INDEX `idx_quality_logs_org_status_due` ON `quality_log_instances` (`organization_id`,`status`,`due_at`);--> statement-breakpoint
CREATE INDEX `idx_quality_logs_template_date` ON `quality_log_instances` (`template_version_id`,`operational_date`);--> statement-breakpoint
CREATE INDEX `idx_quality_logs_revision_root` ON `quality_log_instances` (`revision_of_log_id`,`revision_number`);--> statement-breakpoint
CREATE TABLE `quality_template_fields` (
	`id` text PRIMARY KEY NOT NULL,
	`template_version_id` text NOT NULL,
	`code` text NOT NULL,
	`label` text NOT NULL,
	`description` text DEFAULT '' NOT NULL,
	`field_type` text NOT NULL,
	`unit` text,
	`required` integer DEFAULT true NOT NULL,
	`minimum_milli` integer,
	`maximum_milli` integer,
	`expected_boolean` integer,
	`options_json` text DEFAULT '[]' NOT NULL,
	`non_compliant_options_json` text DEFAULT '[]' NOT NULL,
	`deviation_severity` text DEFAULT 'warning' NOT NULL,
	`evidence_required_on_deviation` integer DEFAULT false NOT NULL,
	`display_order` integer NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`template_version_id`) REFERENCES `quality_template_versions`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_quality_template_fields_version_code` ON `quality_template_fields` (`template_version_id`,`code`);--> statement-breakpoint
CREATE INDEX `idx_quality_template_fields_version_order` ON `quality_template_fields` (`template_version_id`,`display_order`);--> statement-breakpoint
CREATE TABLE `quality_template_versions` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`root_template_id` text NOT NULL,
	`version_number` integer NOT NULL,
	`status` text DEFAULT 'draft' NOT NULL,
	`name_snapshot` text NOT NULL,
	`code_snapshot` text NOT NULL,
	`category` text NOT NULL,
	`instructions` text DEFAULT '' NOT NULL,
	`schedule_type` text DEFAULT 'adhoc' NOT NULL,
	`default_due_time` text,
	`idempotency_key` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`created_by` text NOT NULL,
	`published_at` text,
	`published_by` text,
	`locked_at` text,
	`version` integer DEFAULT 1 NOT NULL,
	FOREIGN KEY (`organization_id`) REFERENCES `tenant_organizations`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`root_template_id`) REFERENCES `tenant_quality_templates`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`created_by`) REFERENCES `organization_memberships`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`published_by`) REFERENCES `organization_memberships`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_quality_template_versions_root_version` ON `quality_template_versions` (`root_template_id`,`version_number`);--> statement-breakpoint
CREATE UNIQUE INDEX `idx_quality_template_versions_org_idempotency` ON `quality_template_versions` (`organization_id`,`idempotency_key`);--> statement-breakpoint
CREATE INDEX `idx_quality_template_versions_org_status` ON `quality_template_versions` (`organization_id`,`status`,`updated_at`);