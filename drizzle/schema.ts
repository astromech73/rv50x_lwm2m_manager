import { mysqlEnum, mysqlTable, text, timestamp, varchar, int, boolean, json, decimal, index } from "drizzle-orm/mysql-core";
import { relations } from "drizzle-orm";

/**
 * Core user table backing auth flow.
 * Extend this file with additional tables as your product grows.
 * Columns use camelCase to match both database fields and generated types.
 */
export const users = mysqlTable("users", {
  id: varchar("id", { length: 64 }).primaryKey(),
  username: varchar("username", { length: 255 }).notNull().unique(),
  email: varchar("email", { length: 320 }).unique(),
  passwordHash: text("passwordHash").notNull(),
  name: text("name"),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  isActive: boolean("isActive").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow(),
  updatedAt: timestamp("updatedAt").defaultNow(),
  lastSignedIn: timestamp("lastSignedIn"),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

/**
 * Sessions table - for persistent session storage
 */
export const sessions = mysqlTable("sessions", {
  id: varchar("id", { length: 255 }).primaryKey(),
  userId: varchar("userId", { length: 64 }).notNull(),
  token: text("token").notNull(),
  expiresAt: timestamp("expiresAt").notNull(),
  createdAt: timestamp("createdAt").defaultNow(),
  lastActivityAt: timestamp("lastActivityAt").defaultNow(),
});

export type Session = typeof sessions.$inferSelect;
export type InsertSession = typeof sessions.$inferInsert;

/**
 * Device Groups table - for organizing gateways
 */
export const deviceGroups = mysqlTable("device_groups", {
  id: varchar("id", { length: 64 }).primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  ownerId: varchar("ownerId", { length: 64 }).notNull(),
  createdAt: timestamp("createdAt").defaultNow(),
  updatedAt: timestamp("updatedAt").defaultNow(),
});

export type DeviceGroup = typeof deviceGroups.$inferSelect;
export type InsertDeviceGroup = typeof deviceGroups.$inferInsert;

/**
 * LWM2M Gateways table - stores information about connected RV50X gateways
 */
export const gateways = mysqlTable("gateways", {
  id: varchar("id", { length: 64 }).primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  endpoint: varchar("endpoint", { length: 255 }).notNull().unique(),
  ipAddress: varchar("ipAddress", { length: 45 }),
  status: mysqlEnum("status", ["online", "offline", "error"]).default("offline").notNull(),
  lastSeen: timestamp("lastSeen"),
  lwm2mVersion: varchar("lwm2mVersion", { length: 20 }),
  firmwareVersion: varchar("firmwareVersion", { length: 255 }),
  serialNumber: varchar("serialNumber", { length: 255 }),
  ownerId: varchar("ownerId", { length: 64 }).notNull(),
  groupId: varchar("groupId", { length: 64 }),
  location: varchar("location", { length: 255 }),
  tags: json("tags"),
  createdAt: timestamp("createdAt").defaultNow(),
  updatedAt: timestamp("updatedAt").defaultNow(),
}, (table) => ({
  ownerIdIdx: index("idx_owner_id").on(table.ownerId),
  statusIdx: index("idx_status").on(table.status),
}));

export type Gateway = typeof gateways.$inferSelect;
export type InsertGateway = typeof gateways.$inferInsert;

/**
 * LWM2M Objects table - stores the object definitions from the gateway
 */
export const lwm2mObjects = mysqlTable("lwm2m_objects", {
  id: varchar("id", { length: 64 }).primaryKey(),
  gatewayId: varchar("gatewayId", { length: 64 }).notNull(),
  objectId: int("objectId").notNull(),
  objectName: varchar("objectName", { length: 255 }).notNull(),
  description: text("description"),
  createdAt: timestamp("createdAt").defaultNow(),
});

export type LWM2MObject = typeof lwm2mObjects.$inferSelect;
export type InsertLWM2MObject = typeof lwm2mObjects.$inferInsert;

/**
 * LWM2M Resources table - stores variables and settings from the gateway
 */
export const lwm2mResources = mysqlTable("lwm2m_resources", {
  id: varchar("id", { length: 64 }).primaryKey(),
  objectId: varchar("objectId", { length: 64 }).notNull(),
  resourceId: int("resourceId").notNull(),
  resourceName: varchar("resourceName", { length: 255 }).notNull(),
  resourceType: mysqlEnum("resourceType", ["variable", "setting"]).notNull(),
  dataType: varchar("dataType", { length: 50 }),
  description: text("description"),
  constraints: json("constraints"),
  createdAt: timestamp("createdAt").defaultNow(),
});

export type LWM2MResource = typeof lwm2mResources.$inferSelect;
export type InsertLWM2MResource = typeof lwm2mResources.$inferInsert;

/**
 * LWM2M Resource Values table - stores current values of resources
 */
export const lwm2mResourceValues = mysqlTable("lwm2m_resource_values", {
  id: varchar("id", { length: 64 }).primaryKey(),
  resourceId: varchar("resourceId", { length: 64 }).notNull(),
  gatewayId: varchar("gatewayId", { length: 64 }).notNull(),
  value: text("value"),
  timestamp: timestamp("timestamp").defaultNow(),
  updatedAt: timestamp("updatedAt").defaultNow(),
}, (table) => ({
  gatewayIdIdx: index("idx_gateway_id").on(table.gatewayId),
  timestampIdx: index("idx_timestamp").on(table.timestamp),
}));

export type LWM2MResourceValue = typeof lwm2mResourceValues.$inferSelect;
export type InsertLWM2MResourceValue = typeof lwm2mResourceValues.$inferInsert;

/**
 * LWM2M Commands table - stores commands sent to gateways
 */
export const lwm2mCommands = mysqlTable("lwm2m_commands", {
  id: varchar("id", { length: 64 }).primaryKey(),
  gatewayId: varchar("gatewayId", { length: 64 }).notNull(),
  resourceId: varchar("resourceId", { length: 64 }).notNull(),
  commandType: mysqlEnum("commandType", ["read", "write", "execute"]).notNull(),
  value: text("value"),
  status: mysqlEnum("status", ["pending", "sent", "success", "failed"]).default("pending").notNull(),
  error: text("error"),
  createdAt: timestamp("createdAt").defaultNow(),
  completedAt: timestamp("completedAt"),
});

export type LWM2MCommand = typeof lwm2mCommands.$inferSelect;
export type InsertLWM2MCommand = typeof lwm2mCommands.$inferInsert;

/**
 * Configuration Templates table - for managing device configurations
 */
export const configTemplates = mysqlTable("config_templates", {
  id: varchar("id", { length: 64 }).primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  ownerId: varchar("ownerId", { length: 64 }).notNull(),
  config: json("config").notNull(),
  version: int("version").default(1).notNull(),
  createdAt: timestamp("createdAt").defaultNow(),
  updatedAt: timestamp("updatedAt").defaultNow(),
});

export type ConfigTemplate = typeof configTemplates.$inferSelect;
export type InsertConfigTemplate = typeof configTemplates.$inferInsert;

/**
 * Configuration Deployments table - tracks configuration pushes
 */
export const configDeployments = mysqlTable("config_deployments", {
  id: varchar("id", { length: 64 }).primaryKey(),
  templateId: varchar("templateId", { length: 64 }).notNull(),
  gatewayId: varchar("gatewayId", { length: 64 }).notNull(),
  status: mysqlEnum("status", ["pending", "in_progress", "success", "failed", "rolled_back"]).default("pending").notNull(),
  previousConfig: json("previousConfig"),
  error: text("error"),
  createdAt: timestamp("createdAt").defaultNow(),
  completedAt: timestamp("completedAt"),
});

export type ConfigDeployment = typeof configDeployments.$inferSelect;
export type InsertConfigDeployment = typeof configDeployments.$inferInsert;

/**
 * Alerts table - for connectivity and performance alerts
 */
export const alerts = mysqlTable("alerts", {
  id: varchar("id", { length: 64 }).primaryKey(),
  gatewayId: varchar("gatewayId", { length: 64 }).notNull(),
  alertType: mysqlEnum("alertType", [
    "offline",
    "low_signal",
    "high_error_rate",
    "firmware_mismatch",
    "sim_change",
    "connectivity_lost",
    "custom"
  ]).notNull(),
  severity: mysqlEnum("severity", ["info", "warning", "critical"]).default("info").notNull(),
  message: text("message").notNull(),
  isResolved: boolean("isResolved").default(false).notNull(),
  createdAt: timestamp("createdAt").defaultNow(),
  resolvedAt: timestamp("resolvedAt"),
});

export type Alert = typeof alerts.$inferSelect;
export type InsertAlert = typeof alerts.$inferInsert;

/**
 * Jobs table - for scheduled operations
 */
export const jobs = mysqlTable("jobs", {
  id: varchar("id", { length: 64 }).primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  ownerId: varchar("ownerId", { length: 64 }).notNull(),
  jobType: mysqlEnum("jobType", ["command", "configuration", "firmware_update", "reboot", "custom"]).notNull(),
  targetType: mysqlEnum("targetType", ["single", "group", "all"]).notNull(),
  targetId: varchar("targetId", { length: 64 }),
  schedule: varchar("schedule", { length: 255 }),
  isActive: boolean("isActive").default(true).notNull(),
  payload: json("payload"),
  createdAt: timestamp("createdAt").defaultNow(),
  updatedAt: timestamp("updatedAt").defaultNow(),
});

export type Job = typeof jobs.$inferSelect;
export type InsertJob = typeof jobs.$inferInsert;

/**
 * Job Executions table - tracks job runs
 */
export const jobExecutions = mysqlTable("job_executions", {
  id: varchar("id", { length: 64 }).primaryKey(),
  jobId: varchar("jobId", { length: 64 }).notNull(),
  gatewayId: varchar("gatewayId", { length: 64 }).notNull(),
  status: mysqlEnum("status", ["pending", "running", "success", "failed"]).default("pending").notNull(),
  result: json("result"),
  error: text("error"),
  startedAt: timestamp("startedAt"),
  completedAt: timestamp("completedAt"),
  createdAt: timestamp("createdAt").defaultNow(),
});

export type JobExecution = typeof jobExecutions.$inferSelect;
export type InsertJobExecution = typeof jobExecutions.$inferInsert;

/**
 * Automation Rules table - for conditional automation
 */
export const automationRules = mysqlTable("automation_rules", {
  id: varchar("id", { length: 64 }).primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  ownerId: varchar("ownerId", { length: 64 }).notNull(),
  isActive: boolean("isActive").default(true).notNull(),
  conditions: json("conditions").notNull(),
  actions: json("actions").notNull(),
  createdAt: timestamp("createdAt").defaultNow(),
  updatedAt: timestamp("updatedAt").defaultNow(),
});

export type AutomationRule = typeof automationRules.$inferSelect;
export type InsertAutomationRule = typeof automationRules.$inferInsert;

/**
 * Audit Logs table - for tracking all operations
 */
export const auditLogs = mysqlTable("audit_logs", {
  id: varchar("id", { length: 64 }).primaryKey(),
  userId: varchar("userId", { length: 64 }).notNull(),
  action: varchar("action", { length: 255 }).notNull(),
  resourceType: varchar("resourceType", { length: 100 }).notNull(),
  resourceId: varchar("resourceId", { length: 64 }),
  details: json("details"),
  createdAt: timestamp("createdAt").defaultNow(),
}, (table) => ({
  userIdIdx: index("idx_audit_user_id").on(table.userId),
  createdAtIdx: index("idx_audit_created_at").on(table.createdAt),
}));

export type AuditLog = typeof auditLogs.$inferSelect;
export type InsertAuditLog = typeof auditLogs.$inferInsert;

/**
 * Connectivity Metrics table - for tracking signal and connectivity
 */
export const connectivityMetrics = mysqlTable("connectivity_metrics", {
  id: varchar("id", { length: 64 }).primaryKey(),
  gatewayId: varchar("gatewayId", { length: 64 }).notNull(),
  signalStrength: int("signalStrength"),
  signalQuality: int("signalQuality"),
  cellularTechnology: varchar("cellularTechnology", { length: 50 }),
  activeSim: int("activeSim"),
  ipv4Address: varchar("ipv4Address", { length: 45 }),
  ipv6Address: varchar("ipv6Address", { length: 128 }),
  uptime: int("uptime"),
  errorRate: decimal("errorRate", { precision: 5, scale: 2 }),
  timestamp: timestamp("timestamp").defaultNow(),
}, (table) => ({
  gatewayIdIdx: index("idx_metrics_gateway_id").on(table.gatewayId),
  timestampIdx: index("idx_metrics_timestamp").on(table.timestamp),
}));

export type ConnectivityMetrics = typeof connectivityMetrics.$inferSelect;
export type InsertConnectivityMetrics = typeof connectivityMetrics.$inferInsert;

/**
 * Reports table - for scheduled reports
 */
export const reports = mysqlTable("reports", {
  id: varchar("id", { length: 64 }).primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  ownerId: varchar("ownerId", { length: 64 }).notNull(),
  reportType: mysqlEnum("reportType", ["connectivity", "performance", "alerts", "custom"]).notNull(),
  schedule: varchar("schedule", { length: 255 }),
  isActive: boolean("isActive").default(true).notNull(),
  config: json("config"),
  createdAt: timestamp("createdAt").defaultNow(),
  updatedAt: timestamp("updatedAt").defaultNow(),
});

export type Report = typeof reports.$inferSelect;
export type InsertReport = typeof reports.$inferInsert;

/**
 * Relations
 */
export const deviceGroupsRelations = relations(deviceGroups, ({ many }) => ({
  gateways: many(gateways),
}));

export const gatewaysRelations = relations(gateways, ({ one, many }) => ({
  group: one(deviceGroups, {
    fields: [gateways.groupId],
    references: [deviceGroups.id],
  }),
  objects: many(lwm2mObjects),
  resourceValues: many(lwm2mResourceValues),
  commands: many(lwm2mCommands),
  alerts: many(alerts),
  metrics: many(connectivityMetrics),
  deployments: many(configDeployments),
}));

export const lwm2mObjectsRelations = relations(lwm2mObjects, ({ one, many }) => ({
  gateway: one(gateways, {
    fields: [lwm2mObjects.gatewayId],
    references: [gateways.id],
  }),
  resources: many(lwm2mResources),
}));

export const lwm2mResourcesRelations = relations(lwm2mResources, ({ one, many }) => ({
  object: one(lwm2mObjects, {
    fields: [lwm2mResources.objectId],
    references: [lwm2mObjects.id],
  }),
  values: many(lwm2mResourceValues),
  commands: many(lwm2mCommands),
}));

export const lwm2mResourceValuesRelations = relations(lwm2mResourceValues, ({ one }) => ({
  resource: one(lwm2mResources, {
    fields: [lwm2mResourceValues.resourceId],
    references: [lwm2mResources.id],
  }),
  gateway: one(gateways, {
    fields: [lwm2mResourceValues.gatewayId],
    references: [gateways.id],
  }),
}));

export const lwm2mCommandsRelations = relations(lwm2mCommands, ({ one }) => ({
  gateway: one(gateways, {
    fields: [lwm2mCommands.gatewayId],
    references: [gateways.id],
  }),
  resource: one(lwm2mResources, {
    fields: [lwm2mCommands.resourceId],
    references: [lwm2mResources.id],
  }),
}));

export const configTemplatesRelations = relations(configTemplates, ({ many }) => ({
  deployments: many(configDeployments),
}));

export const configDeploymentsRelations = relations(configDeployments, ({ one }) => ({
  template: one(configTemplates, {
    fields: [configDeployments.templateId],
    references: [configTemplates.id],
  }),
  gateway: one(gateways, {
    fields: [configDeployments.gatewayId],
    references: [gateways.id],
  }),
}));

export const alertsRelations = relations(alerts, ({ one }) => ({
  gateway: one(gateways, {
    fields: [alerts.gatewayId],
    references: [gateways.id],
  }),
}));

export const jobsRelations = relations(jobs, ({ many }) => ({
  executions: many(jobExecutions),
}));

export const jobExecutionsRelations = relations(jobExecutions, ({ one }) => ({
  job: one(jobs, {
    fields: [jobExecutions.jobId],
    references: [jobs.id],
  }),
  gateway: one(gateways, {
    fields: [jobExecutions.gatewayId],
    references: [gateways.id],
  }),
}));

export const connectivityMetricsRelations = relations(connectivityMetrics, ({ one }) => ({
  gateway: one(gateways, {
    fields: [connectivityMetrics.gatewayId],
    references: [gateways.id],
  }),
}));

