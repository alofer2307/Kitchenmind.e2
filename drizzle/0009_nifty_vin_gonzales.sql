CREATE INDEX `idx_import_batches_org_status` ON `import_batches` (`organization_id`,`status`);--> statement-breakpoint
CREATE INDEX `idx_tenant_devices_org_branch_status` ON `tenant_devices` (`organization_id`,`branch_id`,`status`);--> statement-breakpoint
CREATE INDEX `idx_tenant_employees_org_branch_status` ON `tenant_employees` (`organization_id`,`branch_id`,`status`);--> statement-breakpoint
CREATE INDEX `idx_tenant_inventory_movements_org_branch_time` ON `tenant_inventory_movements` (`organization_id`,`branch_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `idx_tenant_products_org_branch_status` ON `tenant_products` (`organization_id`,`branch_id`,`status`);--> statement-breakpoint
CREATE INDEX `idx_tenant_quality_templates_org_branch_status` ON `tenant_quality_templates` (`organization_id`,`branch_id`,`status`);--> statement-breakpoint
CREATE INDEX `idx_tenant_service_types_org_branch_status` ON `tenant_service_types` (`organization_id`,`branch_id`,`status`);--> statement-breakpoint
CREATE INDEX `idx_tenant_shifts_org_branch_status` ON `tenant_shifts` (`organization_id`,`branch_id`,`status`);--> statement-breakpoint
CREATE INDEX `idx_tenant_warehouses_org_branch_status` ON `tenant_warehouses` (`organization_id`,`branch_id`,`status`);