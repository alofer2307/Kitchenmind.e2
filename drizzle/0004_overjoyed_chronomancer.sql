CREATE TABLE `onboarding_answers` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`project_id` text NOT NULL,
	`task_id` text NOT NULL,
	`answer_json` text NOT NULL,
	`answered_by_type` text NOT NULL,
	`answered_by` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`version` integer DEFAULT 1 NOT NULL,
	FOREIGN KEY (`organization_id`) REFERENCES `tenant_organizations`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`project_id`) REFERENCES `onboarding_projects`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`task_id`) REFERENCES `onboarding_tasks`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_onboarding_answers_org_task` ON `onboarding_answers` (`organization_id`,`task_id`);--> statement-breakpoint
CREATE INDEX `idx_onboarding_answers_project` ON `onboarding_answers` (`project_id`,`updated_at`);--> statement-breakpoint
CREATE TABLE `onboarding_dependencies` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`organization_id` text NOT NULL,
	`task_id` text NOT NULL,
	`depends_on_task_id` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `onboarding_projects`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`organization_id`) REFERENCES `tenant_organizations`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`task_id`) REFERENCES `onboarding_tasks`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`depends_on_task_id`) REFERENCES `onboarding_tasks`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_onboarding_dependencies_pair` ON `onboarding_dependencies` (`task_id`,`depends_on_task_id`);--> statement-breakpoint
CREATE INDEX `idx_onboarding_dependencies_org_project` ON `onboarding_dependencies` (`organization_id`,`project_id`);