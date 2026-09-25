CREATE TABLE `activation_checks` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`code` text NOT NULL,
	`label` text NOT NULL,
	`status` text NOT NULL,
	`detail` text NOT NULL,
	`critical` integer DEFAULT true NOT NULL,
	`checked_at` text NOT NULL,
	FOREIGN KEY (`organization_id`) REFERENCES `tenant_organizations`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_activation_checks_org_code` ON `activation_checks` (`organization_id`,`code`);--> statement-breakpoint
CREATE TABLE `customer_subscriptions` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`status` text DEFAULT 'pending_activation' NOT NULL,
	`billing_cycle` text NOT NULL,
	`currency` text NOT NULL,
	`recurring_amount_minor` integer NOT NULL,
	`implementation_amount_minor` integer NOT NULL,
	`source_quote_version_id` text NOT NULL,
	`starts_at` text,
	`renews_at` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`organization_id`) REFERENCES `tenant_organizations`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`source_quote_version_id`) REFERENCES `quote_versions`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_customer_subscriptions_org` ON `customer_subscriptions` (`organization_id`);--> statement-breakpoint
CREATE TABLE `customer_users` (
	`id` text PRIMARY KEY NOT NULL,
	`auth_user_id` text NOT NULL,
	`email` text NOT NULL,
	`display_name` text NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`last_access_at` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_customer_users_auth` ON `customer_users` (`auth_user_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `idx_customer_users_email` ON `customer_users` (`email`);--> statement-breakpoint
CREATE TABLE `entitlement_history` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`action` text NOT NULL,
	`before_json` text,
	`after_json` text NOT NULL,
	`reason` text NOT NULL,
	`actor_id` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`organization_id`) REFERENCES `tenant_organizations`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE INDEX `idx_entitlement_history_org_time` ON `entitlement_history` (`organization_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `import_batches` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`type` text NOT NULL,
	`idempotency_key` text NOT NULL,
	`status` text NOT NULL,
	`total_rows` integer NOT NULL,
	`valid_rows` integer NOT NULL,
	`invalid_rows` integer NOT NULL,
	`created_by` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`completed_at` text,
	FOREIGN KEY (`organization_id`) REFERENCES `tenant_organizations`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_import_batches_org_key` ON `import_batches` (`organization_id`,`idempotency_key`);--> statement-breakpoint
CREATE TABLE `import_rows` (
	`id` text PRIMARY KEY NOT NULL,
	`batch_id` text NOT NULL,
	`row_number` integer NOT NULL,
	`status` text NOT NULL,
	`raw_json` text NOT NULL,
	`error_json` text,
	`entity_id` text,
	FOREIGN KEY (`batch_id`) REFERENCES `import_batches`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_import_rows_batch_row` ON `import_rows` (`batch_id`,`row_number`);--> statement-breakpoint
CREATE TABLE `membership_role_assignments` (
	`membership_id` text NOT NULL,
	`role_id` text NOT NULL,
	PRIMARY KEY(`membership_id`, `role_id`),
	FOREIGN KEY (`membership_id`) REFERENCES `organization_memberships`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`role_id`) REFERENCES `organization_roles`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE TABLE `membership_scopes` (
	`id` text PRIMARY KEY NOT NULL,
	`membership_id` text NOT NULL,
	`scope_type` text NOT NULL,
	`scope_id` text,
	`access_mode` text DEFAULT 'manage' NOT NULL,
	FOREIGN KEY (`membership_id`) REFERENCES `organization_memberships`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_membership_scopes_unique` ON `membership_scopes` (`membership_id`,`scope_type`,`scope_id`);--> statement-breakpoint
CREATE TABLE `onboarding_projects` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`template_version` integer DEFAULT 1 NOT NULL,
	`status` text DEFAULT 'not_started' NOT NULL,
	`completion_percentage` integer DEFAULT 0 NOT NULL,
	`target_date` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`version` integer DEFAULT 1 NOT NULL,
	`activated_at` text,
	FOREIGN KEY (`organization_id`) REFERENCES `tenant_organizations`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_onboarding_projects_org` ON `onboarding_projects` (`organization_id`);--> statement-breakpoint
CREATE TABLE `onboarding_sections` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`organization_id` text NOT NULL,
	`code` text NOT NULL,
	`title` text NOT NULL,
	`description` text NOT NULL,
	`display_order` integer NOT NULL,
	`module_code` text,
	`status` text DEFAULT 'pending' NOT NULL,
	`completion_percentage` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `onboarding_projects`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`organization_id`) REFERENCES `tenant_organizations`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_onboarding_sections_project_code` ON `onboarding_sections` (`project_id`,`code`);--> statement-breakpoint
CREATE TABLE `onboarding_tasks` (
	`id` text PRIMARY KEY NOT NULL,
	`section_id` text NOT NULL,
	`organization_id` text NOT NULL,
	`code` text NOT NULL,
	`title` text NOT NULL,
	`description` text NOT NULL,
	`required` integer DEFAULT true NOT NULL,
	`module_code` text,
	`status` text DEFAULT 'pending' NOT NULL,
	`blocked_reason` text,
	`completed_at` text,
	`completed_by` text,
	`display_order` integer NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`section_id`) REFERENCES `onboarding_sections`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`organization_id`) REFERENCES `tenant_organizations`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_onboarding_tasks_org_code` ON `onboarding_tasks` (`organization_id`,`code`);--> statement-breakpoint
CREATE INDEX `idx_onboarding_tasks_org_status` ON `onboarding_tasks` (`organization_id`,`status`);--> statement-breakpoint
CREATE TABLE `organization_audit_events` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`actor_type` text NOT NULL,
	`actor_id` text NOT NULL,
	`action` text NOT NULL,
	`entity` text NOT NULL,
	`entity_id` text,
	`outcome` text NOT NULL,
	`reason` text,
	`before_json` text,
	`after_json` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`organization_id`) REFERENCES `tenant_organizations`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE INDEX `idx_organization_audit_org_time` ON `organization_audit_events` (`organization_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `idx_organization_audit_actor_time` ON `organization_audit_events` (`actor_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `organization_entitlements` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`module_code` text,
	`feature_code` text,
	`source_type` text DEFAULT 'quote' NOT NULL,
	`source_quote_version_id` text NOT NULL,
	`enabled` integer DEFAULT true NOT NULL,
	`effective_from` text NOT NULL,
	`effective_until` text,
	`status` text DEFAULT 'active' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`created_by` text NOT NULL,
	FOREIGN KEY (`organization_id`) REFERENCES `tenant_organizations`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`source_quote_version_id`) REFERENCES `quote_versions`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_organization_entitlements_module` ON `organization_entitlements` (`organization_id`,`module_code`);--> statement-breakpoint
CREATE UNIQUE INDEX `idx_organization_entitlements_feature` ON `organization_entitlements` (`organization_id`,`feature_code`);--> statement-breakpoint
CREATE INDEX `idx_organization_entitlements_org_status` ON `organization_entitlements` (`organization_id`,`status`);--> statement-breakpoint
CREATE TABLE `organization_feature_limits` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`feature_code` text NOT NULL,
	`included_quantity` integer NOT NULL,
	`hard_limit` integer,
	`warning_threshold` integer,
	`unit` text NOT NULL,
	`current_usage` integer DEFAULT 0 NOT NULL,
	`reset_period` text,
	`source_quote_line_id` text,
	`effective_from` text NOT NULL,
	`effective_until` text,
	FOREIGN KEY (`organization_id`) REFERENCES `tenant_organizations`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`source_quote_line_id`) REFERENCES `quote_lines`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_organization_feature_limits_org_feature` ON `organization_feature_limits` (`organization_id`,`feature_code`);--> statement-breakpoint
CREATE TABLE `organization_invitations` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`email_normalized` text NOT NULL,
	`intended_role_id` text NOT NULL,
	`intended_scope_json` text DEFAULT '{"type":"organization"}' NOT NULL,
	`token_hash` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`expires_at` text NOT NULL,
	`accepted_at` text,
	`revoked_at` text,
	`created_by_platform_user_id` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`last_sent_at` text,
	`send_count` integer DEFAULT 1 NOT NULL,
	`version` integer DEFAULT 1 NOT NULL,
	FOREIGN KEY (`organization_id`) REFERENCES `tenant_organizations`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`intended_role_id`) REFERENCES `organization_roles`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`created_by_platform_user_id`) REFERENCES `platform_users`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_organization_invitations_token` ON `organization_invitations` (`token_hash`);--> statement-breakpoint
CREATE INDEX `idx_organization_invitations_org_status` ON `organization_invitations` (`organization_id`,`status`);--> statement-breakpoint
CREATE TABLE `organization_memberships` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`user_id` text NOT NULL,
	`status` text DEFAULT 'invited' NOT NULL,
	`display_name` text NOT NULL,
	`joined_at` text,
	`invited_by` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`version` integer DEFAULT 1 NOT NULL,
	`revoked_at` text,
	FOREIGN KEY (`organization_id`) REFERENCES `tenant_organizations`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`user_id`) REFERENCES `customer_users`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_organization_memberships_org_user` ON `organization_memberships` (`organization_id`,`user_id`);--> statement-breakpoint
CREATE INDEX `idx_organization_memberships_user_status` ON `organization_memberships` (`user_id`,`status`);--> statement-breakpoint
CREATE TABLE `organization_permissions` (
	`id` text PRIMARY KEY NOT NULL,
	`code` text NOT NULL,
	`description` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_organization_permissions_code` ON `organization_permissions` (`code`);--> statement-breakpoint
CREATE TABLE `organization_role_permissions` (
	`role_id` text NOT NULL,
	`permission_id` text NOT NULL,
	PRIMARY KEY(`role_id`, `permission_id`),
	FOREIGN KEY (`role_id`) REFERENCES `organization_roles`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`permission_id`) REFERENCES `organization_permissions`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE TABLE `organization_roles` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`code` text NOT NULL,
	`name` text NOT NULL,
	`description` text DEFAULT '' NOT NULL,
	`system_template` integer DEFAULT true NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`organization_id`) REFERENCES `tenant_organizations`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_organization_roles_org_code` ON `organization_roles` (`organization_id`,`code`);--> statement-breakpoint
CREATE TABLE `provisioning_requests` (
	`id` text PRIMARY KEY NOT NULL,
	`quote_id` text NOT NULL,
	`quote_version_id` text NOT NULL,
	`organization_id` text,
	`idempotency_key` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`requested_by` text NOT NULL,
	`started_at` text,
	`completed_at` text,
	`failed_at` text,
	`retry_count` integer DEFAULT 0 NOT NULL,
	`last_error_code` text,
	`last_error_summary` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`version` integer DEFAULT 1 NOT NULL,
	FOREIGN KEY (`quote_id`) REFERENCES `quotes`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`quote_version_id`) REFERENCES `quote_versions`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`organization_id`) REFERENCES `tenant_organizations`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`requested_by`) REFERENCES `platform_users`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_provisioning_requests_idempotency` ON `provisioning_requests` (`idempotency_key`);--> statement-breakpoint
CREATE UNIQUE INDEX `idx_provisioning_requests_quote` ON `provisioning_requests` (`quote_id`);--> statement-breakpoint
CREATE INDEX `idx_provisioning_requests_status_updated` ON `provisioning_requests` (`status`,`updated_at`);--> statement-breakpoint
CREATE TABLE `provisioning_steps` (
	`id` text PRIMARY KEY NOT NULL,
	`provisioning_request_id` text NOT NULL,
	`code` text NOT NULL,
	`name` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`attempt_count` integer DEFAULT 0 NOT NULL,
	`started_at` text,
	`completed_at` text,
	`last_error` text,
	FOREIGN KEY (`provisioning_request_id`) REFERENCES `provisioning_requests`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_provisioning_steps_request_code` ON `provisioning_steps` (`provisioning_request_id`,`code`);--> statement-breakpoint
CREATE TABLE `tenant_areas` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`branch_id` text NOT NULL,
	`code` text NOT NULL,
	`name` text NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`created_by` text NOT NULL,
	FOREIGN KEY (`organization_id`) REFERENCES `tenant_organizations`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`branch_id`) REFERENCES `tenant_branches`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_tenant_areas_org_branch_code` ON `tenant_areas` (`organization_id`,`branch_id`,`code`);--> statement-breakpoint
CREATE TABLE `tenant_branches` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`code` text NOT NULL,
	`name` text NOT NULL,
	`address` text DEFAULT '' NOT NULL,
	`timezone` text NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`created_by` text NOT NULL,
	`version` integer DEFAULT 1 NOT NULL,
	FOREIGN KEY (`organization_id`) REFERENCES `tenant_organizations`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_tenant_branches_org_code` ON `tenant_branches` (`organization_id`,`code`);--> statement-breakpoint
CREATE INDEX `idx_tenant_branches_org_status` ON `tenant_branches` (`organization_id`,`status`);--> statement-breakpoint
CREATE TABLE `tenant_devices` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`branch_id` text,
	`code` text NOT NULL,
	`name` text NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`metadata_json` text DEFAULT '{}' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`created_by` text NOT NULL,
	FOREIGN KEY (`organization_id`) REFERENCES `tenant_organizations`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`branch_id`) REFERENCES `tenant_branches`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_tenant_devices_org_code` ON `tenant_devices` (`organization_id`,`code`);--> statement-breakpoint
CREATE TABLE `tenant_employees` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`branch_id` text NOT NULL,
	`employee_number` text NOT NULL,
	`name` text NOT NULL,
	`email` text,
	`shift_id` text,
	`status` text DEFAULT 'active' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`created_by` text NOT NULL,
	FOREIGN KEY (`organization_id`) REFERENCES `tenant_organizations`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`branch_id`) REFERENCES `tenant_branches`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`shift_id`) REFERENCES `tenant_shifts`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_tenant_employees_org_number` ON `tenant_employees` (`organization_id`,`employee_number`);--> statement-breakpoint
CREATE TABLE `tenant_inventory_movements` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`branch_id` text NOT NULL,
	`warehouse_id` text NOT NULL,
	`product_id` text NOT NULL,
	`movement_type` text NOT NULL,
	`quantity_minor` integer NOT NULL,
	`unit` text NOT NULL,
	`reason` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`created_by` text NOT NULL,
	FOREIGN KEY (`organization_id`) REFERENCES `tenant_organizations`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`branch_id`) REFERENCES `tenant_branches`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`warehouse_id`) REFERENCES `tenant_warehouses`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`product_id`) REFERENCES `tenant_products`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE INDEX `idx_tenant_inventory_movements_org_time` ON `tenant_inventory_movements` (`organization_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `tenant_organizations` (
	`id` text PRIMARY KEY NOT NULL,
	`code` text NOT NULL,
	`slug` text NOT NULL,
	`commercial_name` text NOT NULL,
	`legal_name` text,
	`business_profile_id` text NOT NULL,
	`country_code` text NOT NULL,
	`default_currency` text NOT NULL,
	`default_timezone` text DEFAULT 'UTC' NOT NULL,
	`locale` text DEFAULT 'es-MX' NOT NULL,
	`tax_id` text,
	`contact_email` text NOT NULL,
	`contact_phone` text NOT NULL,
	`status` text DEFAULT 'provisioning' NOT NULL,
	`onboarding_status` text DEFAULT 'not_started' NOT NULL,
	`source_prospect_id` text NOT NULL,
	`source_quote_id` text NOT NULL,
	`source_quote_version_id` text NOT NULL,
	`activated_at` text,
	`suspended_at` text,
	`suspension_reason` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`created_by_platform_user_id` text NOT NULL,
	`version` integer DEFAULT 1 NOT NULL,
	`deleted_at` text,
	FOREIGN KEY (`source_prospect_id`) REFERENCES `prospects`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`source_quote_id`) REFERENCES `quotes`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`source_quote_version_id`) REFERENCES `quote_versions`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`created_by_platform_user_id`) REFERENCES `platform_users`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_tenant_organizations_code` ON `tenant_organizations` (`code`);--> statement-breakpoint
CREATE UNIQUE INDEX `idx_tenant_organizations_slug` ON `tenant_organizations` (`slug`);--> statement-breakpoint
CREATE UNIQUE INDEX `idx_tenant_organizations_source_quote` ON `tenant_organizations` (`source_quote_id`);--> statement-breakpoint
CREATE INDEX `idx_tenant_organizations_status_updated` ON `tenant_organizations` (`status`,`updated_at`);--> statement-breakpoint
CREATE TABLE `tenant_products` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`branch_id` text,
	`code` text NOT NULL,
	`name` text NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`metadata_json` text DEFAULT '{}' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`created_by` text NOT NULL,
	FOREIGN KEY (`organization_id`) REFERENCES `tenant_organizations`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`branch_id`) REFERENCES `tenant_branches`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_tenant_products_org_code` ON `tenant_products` (`organization_id`,`code`);--> statement-breakpoint
CREATE TABLE `tenant_quality_templates` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`branch_id` text,
	`code` text NOT NULL,
	`name` text NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`metadata_json` text DEFAULT '{}' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`created_by` text NOT NULL,
	FOREIGN KEY (`organization_id`) REFERENCES `tenant_organizations`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`branch_id`) REFERENCES `tenant_branches`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_tenant_quality_templates_org_code` ON `tenant_quality_templates` (`organization_id`,`code`);--> statement-breakpoint
CREATE TABLE `tenant_service_types` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`branch_id` text,
	`code` text NOT NULL,
	`name` text NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`metadata_json` text DEFAULT '{}' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`created_by` text NOT NULL,
	FOREIGN KEY (`organization_id`) REFERENCES `tenant_organizations`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`branch_id`) REFERENCES `tenant_branches`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_tenant_service_types_org_code` ON `tenant_service_types` (`organization_id`,`code`);--> statement-breakpoint
CREATE TABLE `tenant_shifts` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`branch_id` text,
	`code` text NOT NULL,
	`name` text NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`metadata_json` text DEFAULT '{}' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`created_by` text NOT NULL,
	FOREIGN KEY (`organization_id`) REFERENCES `tenant_organizations`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`branch_id`) REFERENCES `tenant_branches`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_tenant_shifts_org_code` ON `tenant_shifts` (`organization_id`,`code`);--> statement-breakpoint
CREATE TABLE `tenant_warehouses` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`branch_id` text NOT NULL,
	`code` text NOT NULL,
	`name` text NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`created_by` text NOT NULL,
	FOREIGN KEY (`organization_id`) REFERENCES `tenant_organizations`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`branch_id`) REFERENCES `tenant_branches`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_tenant_warehouses_org_branch_code` ON `tenant_warehouses` (`organization_id`,`branch_id`,`code`);