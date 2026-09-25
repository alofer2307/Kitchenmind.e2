CREATE TABLE `business_profile_dashboard_defaults` (
	`business_profile_code` text PRIMARY KEY NOT NULL,
	`preset_id` text NOT NULL,
	FOREIGN KEY (`preset_id`) REFERENCES `dashboard_presets`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE TABLE `dashboard_cache_entries` (
	`id` text PRIMARY KEY NOT NULL,
	`cache_key` text NOT NULL,
	`organization_id` text NOT NULL,
	`membership_id` text NOT NULL,
	`branch_id` text,
	`filters_json` text NOT NULL,
	`payload_json` text NOT NULL,
	`configuration_version` text NOT NULL,
	`generated_at` text NOT NULL,
	`expires_at` text NOT NULL,
	FOREIGN KEY (`organization_id`) REFERENCES `tenant_organizations`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`membership_id`) REFERENCES `organization_memberships`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`branch_id`) REFERENCES `tenant_branches`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_dashboard_cache_key` ON `dashboard_cache_entries` (`cache_key`);--> statement-breakpoint
CREATE INDEX `idx_dashboard_cache_scope_expiry` ON `dashboard_cache_entries` (`organization_id`,`membership_id`,`expires_at`);--> statement-breakpoint
CREATE TABLE `dashboard_metric_definitions` (
	`id` text PRIMARY KEY NOT NULL,
	`code` text NOT NULL,
	`label` text NOT NULL,
	`description` text NOT NULL,
	`unit` text NOT NULL,
	`data_source` text NOT NULL,
	`computation` text NOT NULL,
	`freshness_seconds` integer DEFAULT 300 NOT NULL,
	`source_status` text DEFAULT 'available' NOT NULL,
	`missing_behavior` text DEFAULT 'unavailable' NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`version` integer DEFAULT 1 NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_dashboard_metric_definitions_code` ON `dashboard_metric_definitions` (`code`);--> statement-breakpoint
CREATE TABLE `dashboard_preset_widgets` (
	`preset_id` text NOT NULL,
	`widget_id` text NOT NULL,
	`display_order` integer NOT NULL,
	`size` text DEFAULT 'medium' NOT NULL,
	`required` integer DEFAULT false NOT NULL,
	PRIMARY KEY(`preset_id`, `widget_id`),
	FOREIGN KEY (`preset_id`) REFERENCES `dashboard_presets`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`widget_id`) REFERENCES `dashboard_widget_definitions`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_dashboard_preset_widgets_order` ON `dashboard_preset_widgets` (`preset_id`,`display_order`);--> statement-breakpoint
CREATE TABLE `dashboard_presets` (
	`id` text PRIMARY KEY NOT NULL,
	`code` text NOT NULL,
	`name` text NOT NULL,
	`description` text NOT NULL,
	`audience` text NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`version` integer DEFAULT 1 NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_dashboard_presets_code` ON `dashboard_presets` (`code`);--> statement-breakpoint
CREATE TABLE `dashboard_widget_definitions` (
	`id` text PRIMARY KEY NOT NULL,
	`code` text NOT NULL,
	`name` text NOT NULL,
	`description` text NOT NULL,
	`category` text NOT NULL,
	`metric_code` text,
	`source_module_code` text,
	`required_permission` text,
	`source_status` text DEFAULT 'available' NOT NULL,
	`availability_reason` text,
	`supports_branch` integer DEFAULT true NOT NULL,
	`supports_period` integer DEFAULT false NOT NULL,
	`default_size` text DEFAULT 'medium' NOT NULL,
	`sensitive` integer DEFAULT false NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`version` integer DEFAULT 1 NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`metric_code`) REFERENCES `dashboard_metric_definitions`(`code`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_dashboard_widget_definitions_code` ON `dashboard_widget_definitions` (`code`);--> statement-breakpoint
CREATE INDEX `idx_dashboard_widget_definitions_status` ON `dashboard_widget_definitions` (`status`,`category`);--> statement-breakpoint
CREATE TABLE `organization_dashboard_overrides` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`target_type` text NOT NULL,
	`target_code` text NOT NULL,
	`enabled` integer,
	`size` text,
	`display_order` integer,
	`value_json` text DEFAULT '{}' NOT NULL,
	`effective_from` text NOT NULL,
	`effective_until` text,
	`reason` text NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`created_by_type` text NOT NULL,
	`created_by` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`version` integer DEFAULT 1 NOT NULL,
	FOREIGN KEY (`organization_id`) REFERENCES `tenant_organizations`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE INDEX `idx_org_dashboard_overrides_effective` ON `organization_dashboard_overrides` (`organization_id`,`target_type`,`target_code`,`status`,`effective_until`);--> statement-breakpoint
CREATE TABLE `role_dashboard_defaults` (
	`role_code` text PRIMARY KEY NOT NULL,
	`preset_id` text NOT NULL,
	`priority` integer DEFAULT 100 NOT NULL,
	FOREIGN KEY (`preset_id`) REFERENCES `dashboard_presets`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE TABLE `user_dashboard_preferences` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`membership_id` text NOT NULL,
	`preset_code` text NOT NULL,
	`layout_json` text DEFAULT '[]' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`version` integer DEFAULT 1 NOT NULL,
	FOREIGN KEY (`organization_id`) REFERENCES `tenant_organizations`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`membership_id`) REFERENCES `organization_memberships`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_user_dashboard_preferences_scope` ON `user_dashboard_preferences` (`organization_id`,`membership_id`);