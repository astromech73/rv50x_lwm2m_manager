CREATE TABLE `alerts` (
	`id` varchar(64) NOT NULL,
	`gatewayId` varchar(64) NOT NULL,
	`alertType` enum('offline','low_signal','high_error_rate','firmware_mismatch','sim_change','connectivity_lost','custom') NOT NULL,
	`severity` enum('info','warning','critical') NOT NULL DEFAULT 'info',
	`message` text NOT NULL,
	`isResolved` boolean NOT NULL DEFAULT false,
	`createdAt` timestamp DEFAULT (now()),
	`resolvedAt` timestamp,
	CONSTRAINT `alerts_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `audit_logs` (
	`id` varchar(64) NOT NULL,
	`userId` varchar(64) NOT NULL,
	`action` varchar(255) NOT NULL,
	`resourceType` varchar(100) NOT NULL,
	`resourceId` varchar(64),
	`details` json,
	`createdAt` timestamp DEFAULT (now()),
	CONSTRAINT `audit_logs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `automation_rules` (
	`id` varchar(64) NOT NULL,
	`name` varchar(255) NOT NULL,
	`description` text,
	`ownerId` varchar(64) NOT NULL,
	`isActive` boolean NOT NULL DEFAULT true,
	`conditions` json NOT NULL,
	`actions` json NOT NULL,
	`createdAt` timestamp DEFAULT (now()),
	`updatedAt` timestamp DEFAULT (now()),
	CONSTRAINT `automation_rules_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `config_deployments` (
	`id` varchar(64) NOT NULL,
	`templateId` varchar(64) NOT NULL,
	`gatewayId` varchar(64) NOT NULL,
	`status` enum('pending','in_progress','success','failed','rolled_back') NOT NULL DEFAULT 'pending',
	`previousConfig` json,
	`error` text,
	`createdAt` timestamp DEFAULT (now()),
	`completedAt` timestamp,
	CONSTRAINT `config_deployments_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `config_templates` (
	`id` varchar(64) NOT NULL,
	`name` varchar(255) NOT NULL,
	`description` text,
	`ownerId` varchar(64) NOT NULL,
	`config` json NOT NULL,
	`version` int NOT NULL DEFAULT 1,
	`createdAt` timestamp DEFAULT (now()),
	`updatedAt` timestamp DEFAULT (now()),
	CONSTRAINT `config_templates_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `connectivity_metrics` (
	`id` varchar(64) NOT NULL,
	`gatewayId` varchar(64) NOT NULL,
	`signalStrength` int,
	`signalQuality` int,
	`cellularTechnology` varchar(50),
	`activeSim` int,
	`ipv4Address` varchar(45),
	`ipv6Address` varchar(128),
	`uptime` int,
	`errorRate` decimal(5,2),
	`timestamp` timestamp DEFAULT (now()),
	CONSTRAINT `connectivity_metrics_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `device_groups` (
	`id` varchar(64) NOT NULL,
	`name` varchar(255) NOT NULL,
	`description` text,
	`ownerId` varchar(64) NOT NULL,
	`createdAt` timestamp DEFAULT (now()),
	`updatedAt` timestamp DEFAULT (now()),
	CONSTRAINT `device_groups_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `job_executions` (
	`id` varchar(64) NOT NULL,
	`jobId` varchar(64) NOT NULL,
	`gatewayId` varchar(64) NOT NULL,
	`status` enum('pending','running','success','failed') NOT NULL DEFAULT 'pending',
	`result` json,
	`error` text,
	`startedAt` timestamp,
	`completedAt` timestamp,
	`createdAt` timestamp DEFAULT (now()),
	CONSTRAINT `job_executions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `jobs` (
	`id` varchar(64) NOT NULL,
	`name` varchar(255) NOT NULL,
	`description` text,
	`ownerId` varchar(64) NOT NULL,
	`jobType` enum('command','configuration','firmware_update','reboot','custom') NOT NULL,
	`targetType` enum('single','group','all') NOT NULL,
	`targetId` varchar(64),
	`schedule` varchar(255),
	`isActive` boolean NOT NULL DEFAULT true,
	`payload` json,
	`createdAt` timestamp DEFAULT (now()),
	`updatedAt` timestamp DEFAULT (now()),
	CONSTRAINT `jobs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `reports` (
	`id` varchar(64) NOT NULL,
	`name` varchar(255) NOT NULL,
	`description` text,
	`ownerId` varchar(64) NOT NULL,
	`reportType` enum('connectivity','performance','alerts','custom') NOT NULL,
	`schedule` varchar(255),
	`isActive` boolean NOT NULL DEFAULT true,
	`config` json,
	`createdAt` timestamp DEFAULT (now()),
	`updatedAt` timestamp DEFAULT (now()),
	CONSTRAINT `reports_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `gateways` ADD `groupId` varchar(64);--> statement-breakpoint
ALTER TABLE `gateways` ADD `location` varchar(255);--> statement-breakpoint
ALTER TABLE `gateways` ADD `tags` json;--> statement-breakpoint
CREATE INDEX `idx_audit_user_id` ON `audit_logs` (`userId`);--> statement-breakpoint
CREATE INDEX `idx_audit_created_at` ON `audit_logs` (`createdAt`);--> statement-breakpoint
CREATE INDEX `idx_metrics_gateway_id` ON `connectivity_metrics` (`gatewayId`);--> statement-breakpoint
CREATE INDEX `idx_metrics_timestamp` ON `connectivity_metrics` (`timestamp`);--> statement-breakpoint
CREATE INDEX `idx_owner_id` ON `gateways` (`ownerId`);--> statement-breakpoint
CREATE INDEX `idx_status` ON `gateways` (`status`);--> statement-breakpoint
CREATE INDEX `idx_gateway_id` ON `lwm2m_resource_values` (`gatewayId`);--> statement-breakpoint
CREATE INDEX `idx_timestamp` ON `lwm2m_resource_values` (`timestamp`);