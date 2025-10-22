CREATE TABLE `gateways` (
	`id` varchar(64) NOT NULL,
	`name` varchar(255) NOT NULL,
	`endpoint` varchar(255) NOT NULL,
	`ipAddress` varchar(45),
	`status` enum('online','offline','error') NOT NULL DEFAULT 'offline',
	`lastSeen` timestamp,
	`lwm2mVersion` varchar(20),
	`firmwareVersion` varchar(255),
	`serialNumber` varchar(255),
	`ownerId` varchar(64) NOT NULL,
	`createdAt` timestamp DEFAULT (now()),
	`updatedAt` timestamp DEFAULT (now()),
	CONSTRAINT `gateways_id` PRIMARY KEY(`id`),
	CONSTRAINT `gateways_endpoint_unique` UNIQUE(`endpoint`)
);
--> statement-breakpoint
CREATE TABLE `lwm2m_commands` (
	`id` varchar(64) NOT NULL,
	`gatewayId` varchar(64) NOT NULL,
	`resourceId` varchar(64) NOT NULL,
	`commandType` enum('read','write','execute') NOT NULL,
	`value` text,
	`status` enum('pending','sent','success','failed') NOT NULL DEFAULT 'pending',
	`error` text,
	`createdAt` timestamp DEFAULT (now()),
	`completedAt` timestamp,
	CONSTRAINT `lwm2m_commands_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `lwm2m_objects` (
	`id` varchar(64) NOT NULL,
	`gatewayId` varchar(64) NOT NULL,
	`objectId` int NOT NULL,
	`objectName` varchar(255) NOT NULL,
	`description` text,
	`createdAt` timestamp DEFAULT (now()),
	CONSTRAINT `lwm2m_objects_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `lwm2m_resource_values` (
	`id` varchar(64) NOT NULL,
	`resourceId` varchar(64) NOT NULL,
	`gatewayId` varchar(64) NOT NULL,
	`value` text,
	`timestamp` timestamp DEFAULT (now()),
	`updatedAt` timestamp DEFAULT (now()),
	CONSTRAINT `lwm2m_resource_values_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `lwm2m_resources` (
	`id` varchar(64) NOT NULL,
	`objectId` varchar(64) NOT NULL,
	`resourceId` int NOT NULL,
	`resourceName` varchar(255) NOT NULL,
	`resourceType` enum('variable','setting') NOT NULL,
	`dataType` varchar(50),
	`description` text,
	`constraints` json,
	`createdAt` timestamp DEFAULT (now()),
	CONSTRAINT `lwm2m_resources_id` PRIMARY KEY(`id`)
);
