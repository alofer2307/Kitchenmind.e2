CREATE TABLE `business_profile_recommendations` (
	`id` text PRIMARY KEY NOT NULL,
	`business_profile_code` text NOT NULL,
	`module_id` text NOT NULL,
	`feature_id` text,
	`priority` integer DEFAULT 100 NOT NULL,
	`reason` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`module_id`) REFERENCES `modules`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`feature_id`) REFERENCES `features`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_profile_recommendation_unique` ON `business_profile_recommendations` (`business_profile_code`,`module_id`,`feature_id`);--> statement-breakpoint
CREATE TABLE `commercial_notes` (
	`id` text PRIMARY KEY NOT NULL,
	`prospect_id` text NOT NULL,
	`author_platform_user_id` text NOT NULL,
	`content` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text,
	`edited_at` text,
	FOREIGN KEY (`prospect_id`) REFERENCES `prospects`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`author_platform_user_id`) REFERENCES `platform_users`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE INDEX `idx_commercial_notes_prospect_time` ON `commercial_notes` (`prospect_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `diagnoses` (
	`id` text PRIMARY KEY NOT NULL,
	`prospect_id` text NOT NULL,
	`template_id` text NOT NULL,
	`version_number` integer NOT NULL,
	`status` text DEFAULT 'draft' NOT NULL,
	`completion_percentage` integer DEFAULT 0 NOT NULL,
	`started_at` text NOT NULL,
	`completed_at` text,
	`created_by` text NOT NULL,
	`updated_by` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`prospect_id`) REFERENCES `prospects`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`template_id`) REFERENCES `diagnosis_templates`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`created_by`) REFERENCES `platform_users`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`updated_by`) REFERENCES `platform_users`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_diagnoses_prospect_version` ON `diagnoses` (`prospect_id`,`version_number`);--> statement-breakpoint
CREATE INDEX `idx_diagnoses_prospect_status` ON `diagnoses` (`prospect_id`,`status`);--> statement-breakpoint
CREATE TABLE `diagnosis_answers` (
	`id` text PRIMARY KEY NOT NULL,
	`diagnosis_id` text NOT NULL,
	`question_id` text NOT NULL,
	`value_json` text,
	`source` text DEFAULT 'diagnosis' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`created_by` text NOT NULL,
	FOREIGN KEY (`diagnosis_id`) REFERENCES `diagnoses`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`question_id`) REFERENCES `diagnosis_questions`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`created_by`) REFERENCES `platform_users`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_diagnosis_answers_diagnosis_question` ON `diagnosis_answers` (`diagnosis_id`,`question_id`);--> statement-breakpoint
CREATE TABLE `diagnosis_questions` (
	`id` text PRIMARY KEY NOT NULL,
	`template_id` text NOT NULL,
	`section_code` text NOT NULL,
	`question_code` text NOT NULL,
	`label` text NOT NULL,
	`description` text,
	`field_type` text NOT NULL,
	`required` integer DEFAULT false NOT NULL,
	`options_json` text DEFAULT '[]' NOT NULL,
	`display_order` integer NOT NULL,
	`validation_rules_json` text,
	`visibility_condition_json` text,
	`module_code` text,
	`feature_code` text,
	`active` integer DEFAULT true NOT NULL,
	`version` integer DEFAULT 1 NOT NULL,
	FOREIGN KEY (`template_id`) REFERENCES `diagnosis_templates`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_diagnosis_questions_template_code` ON `diagnosis_questions` (`template_id`,`question_code`);--> statement-breakpoint
CREATE INDEX `idx_diagnosis_questions_template_order` ON `diagnosis_questions` (`template_id`,`section_code`,`display_order`);--> statement-breakpoint
CREATE TABLE `diagnosis_templates` (
	`id` text PRIMARY KEY NOT NULL,
	`code` text NOT NULL,
	`name` text NOT NULL,
	`version` integer NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`created_by` text NOT NULL,
	FOREIGN KEY (`created_by`) REFERENCES `platform_users`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_diagnosis_templates_code_version` ON `diagnosis_templates` (`code`,`version`);--> statement-breakpoint
CREATE TABLE `features` (
	`id` text PRIMARY KEY NOT NULL,
	`code` text NOT NULL,
	`module_id` text NOT NULL,
	`name` text NOT NULL,
	`description` text NOT NULL,
	`unit_type` text DEFAULT 'flat' NOT NULL,
	`billable` integer DEFAULT false NOT NULL,
	`configurable` integer DEFAULT true NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`module_id`) REFERENCES `modules`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_features_code` ON `features` (`code`);--> statement-breakpoint
CREATE INDEX `idx_features_module_status` ON `features` (`module_id`,`status`);--> statement-breakpoint
CREATE TABLE `follow_ups` (
	`id` text PRIMARY KEY NOT NULL,
	`prospect_id` text NOT NULL,
	`type` text NOT NULL,
	`scheduled_at` text NOT NULL,
	`responsible_platform_user_id` text NOT NULL,
	`description` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`result` text,
	`completed_at` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`created_by` text NOT NULL,
	FOREIGN KEY (`prospect_id`) REFERENCES `prospects`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`responsible_platform_user_id`) REFERENCES `platform_users`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`created_by`) REFERENCES `platform_users`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE INDEX `idx_follow_ups_status_date` ON `follow_ups` (`status`,`scheduled_at`);--> statement-breakpoint
CREATE INDEX `idx_follow_ups_prospect_date` ON `follow_ups` (`prospect_id`,`scheduled_at`);--> statement-breakpoint
CREATE TABLE `hardware_items` (
	`id` text PRIMARY KEY NOT NULL,
	`code` text NOT NULL,
	`name` text NOT NULL,
	`description` text NOT NULL,
	`unit_amount_minor` integer NOT NULL,
	`currency` text NOT NULL,
	`billing_period` text NOT NULL,
	`active` integer DEFAULT true NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_hardware_items_code` ON `hardware_items` (`code`);--> statement-breakpoint
CREATE TABLE `import_services` (
	`id` text PRIMARY KEY NOT NULL,
	`code` text NOT NULL,
	`name` text NOT NULL,
	`description` text NOT NULL,
	`unit_amount_minor` integer NOT NULL,
	`currency` text NOT NULL,
	`billing_period` text NOT NULL,
	`active` integer DEFAULT true NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_import_services_code` ON `import_services` (`code`);--> statement-breakpoint
CREATE TABLE `module_dependencies` (
	`module_id` text NOT NULL,
	`required_module_id` text NOT NULL,
	`reason` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	PRIMARY KEY(`module_id`, `required_module_id`),
	FOREIGN KEY (`module_id`) REFERENCES `modules`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`required_module_id`) REFERENCES `modules`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE TABLE `module_features` (
	`module_id` text NOT NULL,
	`feature_id` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	PRIMARY KEY(`module_id`, `feature_id`),
	FOREIGN KEY (`module_id`) REFERENCES `modules`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`feature_id`) REFERENCES `features`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE TABLE `modules` (
	`id` text PRIMARY KEY NOT NULL,
	`code` text NOT NULL,
	`name` text NOT NULL,
	`description` text NOT NULL,
	`category` text NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`display_order` integer NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`version` integer DEFAULT 1 NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_modules_code` ON `modules` (`code`);--> statement-breakpoint
CREATE TABLE `plan_features` (
	`plan_id` text NOT NULL,
	`feature_id` text NOT NULL,
	`included_quantity` integer,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	PRIMARY KEY(`plan_id`, `feature_id`),
	FOREIGN KEY (`plan_id`) REFERENCES `plans`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`feature_id`) REFERENCES `features`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE TABLE `plans` (
	`id` text PRIMARY KEY NOT NULL,
	`code` text NOT NULL,
	`name` text NOT NULL,
	`description` text NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_commercial_plans_code` ON `plans` (`code`);--> statement-breakpoint
CREATE TABLE `price_book_versions` (
	`id` text PRIMARY KEY NOT NULL,
	`price_book_id` text NOT NULL,
	`version_number` integer NOT NULL,
	`status` text DEFAULT 'draft' NOT NULL,
	`effective_from` text NOT NULL,
	`effective_until` text,
	`notes` text DEFAULT '' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`created_by` text NOT NULL,
	`published_at` text,
	`published_by` text,
	FOREIGN KEY (`price_book_id`) REFERENCES `price_books`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`created_by`) REFERENCES `platform_users`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`published_by`) REFERENCES `platform_users`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_price_book_versions_number` ON `price_book_versions` (`price_book_id`,`version_number`);--> statement-breakpoint
CREATE INDEX `idx_price_book_versions_status_effective` ON `price_book_versions` (`status`,`effective_from`,`effective_until`);--> statement-breakpoint
CREATE TABLE `price_books` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`currency` text NOT NULL,
	`country_code` text,
	`status` text DEFAULT 'active' NOT NULL,
	`active_version_id` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`created_by` text NOT NULL,
	FOREIGN KEY (`created_by`) REFERENCES `platform_users`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE INDEX `idx_price_books_market` ON `price_books` (`currency`,`country_code`,`status`);--> statement-breakpoint
CREATE TABLE `price_rules` (
	`id` text PRIMARY KEY NOT NULL,
	`price_book_version_id` text NOT NULL,
	`code` text NOT NULL,
	`name` text NOT NULL,
	`description` text NOT NULL,
	`charge_type` text NOT NULL,
	`billing_period` text NOT NULL,
	`unit_type` text NOT NULL,
	`module_code` text,
	`feature_code` text,
	`unit_amount_minor` integer NOT NULL,
	`currency` text NOT NULL,
	`minimum_quantity` integer DEFAULT 0 NOT NULL,
	`maximum_quantity` integer,
	`priority` integer DEFAULT 100 NOT NULL,
	`stacking_mode` text DEFAULT 'add' NOT NULL,
	`active` integer DEFAULT true NOT NULL,
	`internal_cost_minor` integer,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`price_book_version_id`) REFERENCES `price_book_versions`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_price_rules_version_code` ON `price_rules` (`price_book_version_id`,`code`);--> statement-breakpoint
CREATE INDEX `idx_price_rules_version_priority` ON `price_rules` (`price_book_version_id`,`active`,`priority`);--> statement-breakpoint
CREATE TABLE `price_tiers` (
	`id` text PRIMARY KEY NOT NULL,
	`price_rule_id` text NOT NULL,
	`minimum_quantity` integer NOT NULL,
	`maximum_quantity` integer,
	`unit_amount_minor` integer DEFAULT 0 NOT NULL,
	`flat_amount_minor` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`price_rule_id`) REFERENCES `price_rules`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_price_tiers_rule_min` ON `price_tiers` (`price_rule_id`,`minimum_quantity`);--> statement-breakpoint
CREATE INDEX `idx_price_tiers_rule_range` ON `price_tiers` (`price_rule_id`,`minimum_quantity`,`maximum_quantity`);--> statement-breakpoint
CREATE TABLE `prospect_contacts` (
	`id` text PRIMARY KEY NOT NULL,
	`prospect_id` text NOT NULL,
	`name` text NOT NULL,
	`position` text DEFAULT '' NOT NULL,
	`email` text NOT NULL,
	`normalized_email` text NOT NULL,
	`phone` text NOT NULL,
	`normalized_phone` text NOT NULL,
	`is_primary` integer DEFAULT false NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`created_by` text NOT NULL,
	FOREIGN KEY (`prospect_id`) REFERENCES `prospects`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`created_by`) REFERENCES `platform_users`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE INDEX `idx_prospect_contacts_prospect_status` ON `prospect_contacts` (`prospect_id`,`status`);--> statement-breakpoint
CREATE UNIQUE INDEX `idx_prospect_contacts_one_primary` ON `prospect_contacts` (`prospect_id`) WHERE "prospect_contacts"."is_primary" = 1 AND "prospect_contacts"."status" = 'active';--> statement-breakpoint
CREATE TABLE `prospects` (
	`id` text PRIMARY KEY NOT NULL,
	`legal_name` text,
	`commercial_name` text NOT NULL,
	`normalized_commercial_name` text NOT NULL,
	`business_profile_id` text,
	`business_type` text NOT NULL,
	`contact_name` text NOT NULL,
	`contact_position` text,
	`contact_phone` text NOT NULL,
	`normalized_contact_phone` text NOT NULL,
	`contact_email` text NOT NULL,
	`normalized_contact_email` text NOT NULL,
	`city` text NOT NULL,
	`state` text,
	`country_code` text NOT NULL,
	`estimated_branches` integer DEFAULT 1 NOT NULL,
	`estimated_employees` integer DEFAULT 0 NOT NULL,
	`estimated_admin_users` integer DEFAULT 1 NOT NULL,
	`estimated_devices` integer DEFAULT 0 NOT NULL,
	`estimated_daily_services` integer DEFAULT 0 NOT NULL,
	`estimated_warehouses` integer DEFAULT 0 NOT NULL,
	`operates_24_hours` integer DEFAULT false NOT NULL,
	`multi_branch` integer DEFAULT false NOT NULL,
	`requires_offline` integer DEFAULT false NOT NULL,
	`estimated_monthly_movements` integer,
	`primary_need` text NOT NULL,
	`current_problems` text DEFAULT '' NOT NULL,
	`current_systems` text DEFAULT '' NOT NULL,
	`acquisition_source` text,
	`status` text DEFAULT 'new' NOT NULL,
	`lost_reason` text,
	`next_action` text NOT NULL,
	`next_action_at` text,
	`owner_platform_user_id` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`created_by` text NOT NULL,
	`version` integer DEFAULT 1 NOT NULL,
	`archived_at` text,
	FOREIGN KEY (`owner_platform_user_id`) REFERENCES `platform_users`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`created_by`) REFERENCES `platform_users`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE INDEX `idx_prospects_status_updated` ON `prospects` (`status`,`updated_at`);--> statement-breakpoint
CREATE INDEX `idx_prospects_owner_next_action` ON `prospects` (`owner_platform_user_id`,`next_action_at`);--> statement-breakpoint
CREATE INDEX `idx_prospects_normalized_email` ON `prospects` (`normalized_contact_email`);--> statement-breakpoint
CREATE INDEX `idx_prospects_normalized_phone` ON `prospects` (`normalized_contact_phone`);--> statement-breakpoint
CREATE INDEX `idx_prospects_normalized_name` ON `prospects` (`normalized_commercial_name`);--> statement-breakpoint
CREATE TABLE `quote_adjustments` (
	`id` text PRIMARY KEY NOT NULL,
	`quote_version_id` text NOT NULL,
	`line_id` text,
	`type` text NOT NULL,
	`scope` text NOT NULL,
	`value` integer NOT NULL,
	`amount_minor` integer NOT NULL,
	`reason` text NOT NULL,
	`created_by` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`quote_version_id`) REFERENCES `quote_versions`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`line_id`) REFERENCES `quote_lines`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`created_by`) REFERENCES `platform_users`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE INDEX `idx_quote_adjustments_version` ON `quote_adjustments` (`quote_version_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `quote_lines` (
	`id` text PRIMARY KEY NOT NULL,
	`quote_version_id` text NOT NULL,
	`source_rule_id` text,
	`source_type` text NOT NULL,
	`source_id` text,
	`code` text NOT NULL,
	`description` text NOT NULL,
	`explanation` text NOT NULL,
	`billing_period` text NOT NULL,
	`unit_type` text NOT NULL,
	`quantity` integer NOT NULL,
	`unit_amount_minor` integer NOT NULL,
	`subtotal_minor` integer NOT NULL,
	`discount_minor` integer DEFAULT 0 NOT NULL,
	`tax_minor` integer DEFAULT 0 NOT NULL,
	`total_minor` integer NOT NULL,
	`internal_cost_minor` integer,
	`module_code` text,
	`feature_code` text,
	`display_order` integer NOT NULL,
	FOREIGN KEY (`quote_version_id`) REFERENCES `quote_versions`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`source_rule_id`) REFERENCES `price_rules`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE INDEX `idx_quote_lines_version_order` ON `quote_lines` (`quote_version_id`,`display_order`);--> statement-breakpoint
CREATE TABLE `quote_sequences` (
	`year` integer PRIMARY KEY NOT NULL,
	`next_value` integer NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE `quote_status_history` (
	`id` text PRIMARY KEY NOT NULL,
	`quote_id` text NOT NULL,
	`from_status` text,
	`to_status` text NOT NULL,
	`reason` text,
	`delivery_method` text,
	`recipient` text,
	`confirmed_by` text,
	`effective_at` text,
	`mark_prospect_lost` integer DEFAULT false NOT NULL,
	`created_by` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`quote_id`) REFERENCES `quotes`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`created_by`) REFERENCES `platform_users`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE INDEX `idx_quote_status_history_quote_time` ON `quote_status_history` (`quote_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `quote_versions` (
	`id` text PRIMARY KEY NOT NULL,
	`quote_id` text NOT NULL,
	`version_number` integer NOT NULL,
	`price_book_version_id` text NOT NULL,
	`diagnosis_id` text,
	`status` text DEFAULT 'draft' NOT NULL,
	`commercial_name_snapshot` text NOT NULL,
	`contact_snapshot_json` text NOT NULL,
	`currency` text NOT NULL,
	`valid_until` text NOT NULL,
	`billing_cycle` text NOT NULL,
	`commercial_terms` text DEFAULT '' NOT NULL,
	`internal_notes` text DEFAULT '' NOT NULL,
	`customer_notes` text DEFAULT '' NOT NULL,
	`selection_json` text NOT NULL,
	`subtotal_one_time_minor` integer NOT NULL,
	`subtotal_recurring_minor` integer NOT NULL,
	`discount_one_time_minor` integer DEFAULT 0 NOT NULL,
	`discount_recurring_minor` integer DEFAULT 0 NOT NULL,
	`discount_total_minor` integer DEFAULT 0 NOT NULL,
	`tax_one_time_minor` integer DEFAULT 0 NOT NULL,
	`tax_recurring_minor` integer DEFAULT 0 NOT NULL,
	`tax_total_minor` integer DEFAULT 0 NOT NULL,
	`total_one_time_minor` integer NOT NULL,
	`monthly_total_minor` integer NOT NULL,
	`total_recurring_minor` integer NOT NULL,
	`annual_total_minor` integer NOT NULL,
	`annual_equivalent_minor` integer NOT NULL,
	`first_payment_minor` integer NOT NULL,
	`internal_cost_minor` integer DEFAULT 0 NOT NULL,
	`estimated_monthly_margin_minor` integer DEFAULT 0 NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`created_by` text NOT NULL,
	`locked_at` text,
	FOREIGN KEY (`quote_id`) REFERENCES `quotes`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`price_book_version_id`) REFERENCES `price_book_versions`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`diagnosis_id`) REFERENCES `diagnoses`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`created_by`) REFERENCES `platform_users`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_quote_versions_quote_number` ON `quote_versions` (`quote_id`,`version_number`);--> statement-breakpoint
CREATE TABLE `quotes` (
	`id` text PRIMARY KEY NOT NULL,
	`quote_number` text NOT NULL,
	`prospect_id` text NOT NULL,
	`contact_id` text,
	`status` text DEFAULT 'draft' NOT NULL,
	`current_version_id` text,
	`currency` text NOT NULL,
	`valid_until` text NOT NULL,
	`owner_platform_user_id` text NOT NULL,
	`internal_owner_id` text NOT NULL,
	`idempotency_key` text NOT NULL,
	`sent_at` text,
	`viewed_at` text,
	`accepted_at` text,
	`rejected_at` text,
	`rejection_reason` text,
	`cancelled_at` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`created_by` text NOT NULL,
	`version` integer DEFAULT 1 NOT NULL,
	FOREIGN KEY (`prospect_id`) REFERENCES `prospects`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`contact_id`) REFERENCES `prospect_contacts`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`owner_platform_user_id`) REFERENCES `platform_users`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`internal_owner_id`) REFERENCES `platform_users`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`created_by`) REFERENCES `platform_users`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_quotes_number` ON `quotes` (`quote_number`);--> statement-breakpoint
CREATE UNIQUE INDEX `idx_quotes_idempotency_key` ON `quotes` (`idempotency_key`);--> statement-breakpoint
CREATE INDEX `idx_quotes_prospect_status` ON `quotes` (`prospect_id`,`status`);--> statement-breakpoint
CREATE INDEX `idx_quotes_status_updated` ON `quotes` (`status`,`updated_at`);--> statement-breakpoint
CREATE INDEX `idx_quotes_status_valid_until` ON `quotes` (`status`,`valid_until`);--> statement-breakpoint
CREATE TABLE `setup_fees` (
	`id` text PRIMARY KEY NOT NULL,
	`code` text NOT NULL,
	`name` text NOT NULL,
	`description` text NOT NULL,
	`unit_amount_minor` integer NOT NULL,
	`currency` text NOT NULL,
	`billing_period` text NOT NULL,
	`active` integer DEFAULT true NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_setup_fees_code` ON `setup_fees` (`code`);--> statement-breakpoint
CREATE TABLE `support_levels` (
	`id` text PRIMARY KEY NOT NULL,
	`code` text NOT NULL,
	`name` text NOT NULL,
	`description` text NOT NULL,
	`unit_amount_minor` integer NOT NULL,
	`currency` text NOT NULL,
	`billing_period` text NOT NULL,
	`active` integer DEFAULT true NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_support_levels_code` ON `support_levels` (`code`);--> statement-breakpoint
CREATE TABLE `training_items` (
	`id` text PRIMARY KEY NOT NULL,
	`code` text NOT NULL,
	`name` text NOT NULL,
	`description` text NOT NULL,
	`unit_amount_minor` integer NOT NULL,
	`currency` text NOT NULL,
	`billing_period` text NOT NULL,
	`active` integer DEFAULT true NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_training_items_code` ON `training_items` (`code`);--> statement-breakpoint
ALTER TABLE `platform_audit_events` ADD `before_json` text;--> statement-breakpoint
ALTER TABLE `platform_audit_events` ADD `after_json` text;