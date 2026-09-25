CREATE TABLE `customer_subscription_items` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`subscription_id` text NOT NULL,
	`source_quote_line_id` text,
	`item_type` text NOT NULL,
	`code` text NOT NULL,
	`description` text NOT NULL,
	`quantity` integer DEFAULT 1 NOT NULL,
	`unit` text NOT NULL,
	`billing_period` text NOT NULL,
	`amount_minor` integer DEFAULT 0 NOT NULL,
	`currency` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`organization_id`) REFERENCES `tenant_organizations`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`subscription_id`) REFERENCES `customer_subscriptions`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`source_quote_line_id`) REFERENCES `quote_lines`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_customer_subscription_items_identity` ON `customer_subscription_items` (`subscription_id`,`item_type`,`code`);--> statement-breakpoint
CREATE INDEX `idx_customer_subscription_items_org` ON `customer_subscription_items` (`organization_id`,`subscription_id`);--> statement-breakpoint
CREATE TABLE `onboarding_status_history` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`project_id` text NOT NULL,
	`from_status` text,
	`to_status` text NOT NULL,
	`reason` text NOT NULL,
	`actor_type` text NOT NULL,
	`actor_id` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`organization_id`) REFERENCES `tenant_organizations`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`project_id`) REFERENCES `onboarding_projects`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE INDEX `idx_onboarding_status_history_org_time` ON `onboarding_status_history` (`organization_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `onboarding_template_sections` (
	`id` text PRIMARY KEY NOT NULL,
	`template_version_id` text NOT NULL,
	`code` text NOT NULL,
	`title` text NOT NULL,
	`description` text NOT NULL,
	`display_order` integer NOT NULL,
	`module_code` text,
	FOREIGN KEY (`template_version_id`) REFERENCES `onboarding_template_versions`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_onboarding_template_sections_version_code` ON `onboarding_template_sections` (`template_version_id`,`code`);--> statement-breakpoint
CREATE TABLE `onboarding_template_tasks` (
	`id` text PRIMARY KEY NOT NULL,
	`template_section_id` text NOT NULL,
	`code` text NOT NULL,
	`title` text NOT NULL,
	`description` text NOT NULL,
	`required` integer DEFAULT true NOT NULL,
	`module_code` text,
	`display_order` integer NOT NULL,
	FOREIGN KEY (`template_section_id`) REFERENCES `onboarding_template_sections`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_onboarding_template_tasks_section_code` ON `onboarding_template_tasks` (`template_section_id`,`code`);--> statement-breakpoint
CREATE TABLE `onboarding_template_versions` (
	`id` text PRIMARY KEY NOT NULL,
	`code` text NOT NULL,
	`version_number` integer NOT NULL,
	`status` text DEFAULT 'draft' NOT NULL,
	`notes` text DEFAULT '' NOT NULL,
	`effective_from` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`created_by` text NOT NULL,
	FOREIGN KEY (`created_by`) REFERENCES `platform_users`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_onboarding_template_versions_code_version` ON `onboarding_template_versions` (`code`,`version_number`);--> statement-breakpoint
CREATE INDEX `idx_onboarding_template_versions_status` ON `onboarding_template_versions` (`status`,`effective_from`);--> statement-breakpoint
CREATE TABLE `subscription_status_history` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`subscription_id` text NOT NULL,
	`from_status` text,
	`to_status` text NOT NULL,
	`reason` text NOT NULL,
	`actor_id` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`organization_id`) REFERENCES `tenant_organizations`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`subscription_id`) REFERENCES `customer_subscriptions`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE INDEX `idx_subscription_status_history_org_time` ON `subscription_status_history` (`organization_id`,`created_at`);