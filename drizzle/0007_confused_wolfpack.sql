ALTER TABLE `dashboard_widget_definitions` ADD `widget_type` text DEFAULT 'metric' NOT NULL;--> statement-breakpoint
ALTER TABLE `dashboard_widget_definitions` ADD `supported_sizes_json` text DEFAULT '["small","medium","large","full"]' NOT NULL;--> statement-breakpoint
ALTER TABLE `dashboard_widget_definitions` ADD `required_feature_code` text;--> statement-breakpoint
ALTER TABLE `dashboard_widget_definitions` ADD `required_scope_type` text DEFAULT 'branch' NOT NULL;--> statement-breakpoint
ALTER TABLE `dashboard_widget_definitions` ADD `data_source_code` text DEFAULT 'dashboard_metric' NOT NULL;--> statement-breakpoint
ALTER TABLE `dashboard_widget_definitions` ADD `supported_filters_json` text DEFAULT '["branch","period"]' NOT NULL;--> statement-breakpoint
ALTER TABLE `dashboard_widget_definitions` ADD `refresh_policy` text DEFAULT 'cache_then_revalidate' NOT NULL;--> statement-breakpoint
ALTER TABLE `dashboard_widget_definitions` ADD `stale_after_seconds` integer DEFAULT 60 NOT NULL;--> statement-breakpoint
ALTER TABLE `dashboard_widget_definitions` ADD `empty_state_type` text DEFAULT 'zero' NOT NULL;--> statement-breakpoint
ALTER TABLE `dashboard_widget_definitions` ADD `sensitivity_level` text DEFAULT 'standard' NOT NULL;--> statement-breakpoint
ALTER TABLE `dashboard_widget_definitions` ADD `display_order` integer DEFAULT 0 NOT NULL;