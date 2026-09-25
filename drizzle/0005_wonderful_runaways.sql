CREATE TABLE `organization_feature_overrides` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`target_type` text NOT NULL,
	`module_code` text,
	`feature_code` text,
	`enabled` integer,
	`override_limit` integer,
	`effective_from` text NOT NULL,
	`effective_until` text NOT NULL,
	`reason` text NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`created_by` text NOT NULL,
	`revoked_at` text,
	`revoked_by` text,
	FOREIGN KEY (`organization_id`) REFERENCES `tenant_organizations`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`created_by`) REFERENCES `platform_users`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`revoked_by`) REFERENCES `platform_users`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE INDEX `idx_organization_feature_overrides_module` ON `organization_feature_overrides` (`organization_id`,`module_code`,`status`,`effective_until`);--> statement-breakpoint
CREATE INDEX `idx_organization_feature_overrides_feature` ON `organization_feature_overrides` (`organization_id`,`feature_code`,`status`,`effective_until`);