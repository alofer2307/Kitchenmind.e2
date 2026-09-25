CREATE TABLE `platform_audit_events` (
	`id` text PRIMARY KEY NOT NULL,
	`platform_user_id` text,
	`auth_user_id` text,
	`action` text NOT NULL,
	`entity` text NOT NULL,
	`entity_id` text,
	`outcome` text NOT NULL,
	`reason` text,
	`metadata_json` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`platform_user_id`) REFERENCES `platform_users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `platform_audit_events_user_time_idx` ON `platform_audit_events` (`platform_user_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `platform_audit_events_auth_action_idx` ON `platform_audit_events` (`auth_user_id`,`action`,`created_at`);--> statement-breakpoint
CREATE TABLE `platform_mfa_credentials` (
	`id` text PRIMARY KEY NOT NULL,
	`platform_user_id` text NOT NULL,
	`type` text DEFAULT 'totp' NOT NULL,
	`encrypted_secret` text NOT NULL,
	`verified_at` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`platform_user_id`) REFERENCES `platform_users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `platform_mfa_user_unique` ON `platform_mfa_credentials` (`platform_user_id`);--> statement-breakpoint
CREATE TABLE `platform_permissions` (
	`id` text PRIMARY KEY NOT NULL,
	`code` text NOT NULL,
	`description` text DEFAULT '' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `platform_permissions_code_unique` ON `platform_permissions` (`code`);--> statement-breakpoint
CREATE TABLE `platform_recovery_codes` (
	`id` text PRIMARY KEY NOT NULL,
	`platform_user_id` text NOT NULL,
	`code_hash` text NOT NULL,
	`used_at` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`platform_user_id`) REFERENCES `platform_users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `platform_recovery_code_hash_unique` ON `platform_recovery_codes` (`code_hash`);--> statement-breakpoint
CREATE INDEX `platform_recovery_codes_user_idx` ON `platform_recovery_codes` (`platform_user_id`);--> statement-breakpoint
CREATE TABLE `platform_role_permissions` (
	`role_id` text NOT NULL,
	`permission_id` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	PRIMARY KEY(`role_id`, `permission_id`),
	FOREIGN KEY (`role_id`) REFERENCES `platform_roles`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`permission_id`) REFERENCES `platform_permissions`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `platform_roles` (
	`id` text PRIMARY KEY NOT NULL,
	`code` text NOT NULL,
	`name` text NOT NULL,
	`description` text DEFAULT '' NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `platform_roles_code_unique` ON `platform_roles` (`code`);--> statement-breakpoint
CREATE TABLE `platform_sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`platform_user_id` text NOT NULL,
	`token_hash` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`last_seen_at` text NOT NULL,
	`expires_at` text NOT NULL,
	`mfa_verified_at` text NOT NULL,
	`revoked_at` text,
	FOREIGN KEY (`platform_user_id`) REFERENCES `platform_users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `platform_sessions_token_hash_unique` ON `platform_sessions` (`token_hash`);--> statement-breakpoint
CREATE INDEX `platform_sessions_user_status_idx` ON `platform_sessions` (`platform_user_id`,`expires_at`,`revoked_at`);--> statement-breakpoint
CREATE TABLE `platform_user_roles` (
	`platform_user_id` text NOT NULL,
	`role_id` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	PRIMARY KEY(`platform_user_id`, `role_id`),
	FOREIGN KEY (`platform_user_id`) REFERENCES `platform_users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`role_id`) REFERENCES `platform_roles`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `platform_users` (
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
CREATE UNIQUE INDEX `platform_users_auth_user_id_unique` ON `platform_users` (`auth_user_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `platform_users_email_unique` ON `platform_users` (`email`);