// server/_core/index.ts
import "dotenv/config";
import express2 from "express";
import { createServer } from "http";
import net from "net";
import { createExpressMiddleware } from "@trpc/server/adapters/express";

// shared/const.ts
var COOKIE_NAME = "app_session_id";
var ONE_YEAR_MS = 1e3 * 60 * 60 * 24 * 365;
var AXIOS_TIMEOUT_MS = 3e4;
var UNAUTHED_ERR_MSG = "Please login (10001)";
var NOT_ADMIN_ERR_MSG = "You do not have required permission (10002)";

// server/_core/cookies.ts
function isSecureRequest(req) {
  if (req.protocol === "https") return true;
  const forwardedProto = req.headers["x-forwarded-proto"];
  if (!forwardedProto) return false;
  const protoList = Array.isArray(forwardedProto) ? forwardedProto : forwardedProto.split(",");
  return protoList.some((proto) => proto.trim().toLowerCase() === "https");
}
function getSessionCookieOptions(req) {
  return {
    httpOnly: true,
    path: "/",
    sameSite: "none",
    secure: isSecureRequest(req)
  };
}

// shared/_core/errors.ts
var HttpError = class extends Error {
  constructor(statusCode, message) {
    super(message);
    this.statusCode = statusCode;
    this.name = "HttpError";
  }
};
var ForbiddenError = (msg) => new HttpError(403, msg);

// server/_core/sdk.ts
import axios from "axios";
import { parse as parseCookieHeader } from "cookie";
import { SignJWT, jwtVerify } from "jose";

// server/db.ts
import { eq, and } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";

// drizzle/schema.ts
import { mysqlEnum, mysqlTable, text, timestamp, varchar, int, boolean, json, decimal, index } from "drizzle-orm/mysql-core";
import { relations } from "drizzle-orm";
var users = mysqlTable("users", {
  id: varchar("id", { length: 64 }).primaryKey(),
  username: varchar("username", { length: 255 }).notNull().unique(),
  email: varchar("email", { length: 320 }).unique(),
  passwordHash: text("passwordHash").notNull(),
  name: text("name"),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  isActive: boolean("isActive").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow(),
  updatedAt: timestamp("updatedAt").defaultNow(),
  lastSignedIn: timestamp("lastSignedIn")
});
var sessions = mysqlTable("sessions", {
  id: varchar("id", { length: 255 }).primaryKey(),
  userId: varchar("userId", { length: 64 }).notNull(),
  token: text("token").notNull(),
  expiresAt: timestamp("expiresAt").notNull(),
  createdAt: timestamp("createdAt").defaultNow(),
  lastActivityAt: timestamp("lastActivityAt").defaultNow()
});
var deviceGroups = mysqlTable("device_groups", {
  id: varchar("id", { length: 64 }).primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  ownerId: varchar("ownerId", { length: 64 }).notNull(),
  createdAt: timestamp("createdAt").defaultNow(),
  updatedAt: timestamp("updatedAt").defaultNow()
});
var gateways = mysqlTable("gateways", {
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
  updatedAt: timestamp("updatedAt").defaultNow()
}, (table) => ({
  ownerIdIdx: index("idx_owner_id").on(table.ownerId),
  statusIdx: index("idx_status").on(table.status)
}));
var lwm2mObjects = mysqlTable("lwm2m_objects", {
  id: varchar("id", { length: 64 }).primaryKey(),
  gatewayId: varchar("gatewayId", { length: 64 }).notNull(),
  objectId: int("objectId").notNull(),
  objectName: varchar("objectName", { length: 255 }).notNull(),
  description: text("description"),
  createdAt: timestamp("createdAt").defaultNow()
});
var lwm2mResources = mysqlTable("lwm2m_resources", {
  id: varchar("id", { length: 64 }).primaryKey(),
  objectId: varchar("objectId", { length: 64 }).notNull(),
  resourceId: int("resourceId").notNull(),
  resourceName: varchar("resourceName", { length: 255 }).notNull(),
  resourceType: mysqlEnum("resourceType", ["variable", "setting"]).notNull(),
  dataType: varchar("dataType", { length: 50 }),
  description: text("description"),
  constraints: json("constraints"),
  createdAt: timestamp("createdAt").defaultNow()
});
var lwm2mResourceValues = mysqlTable("lwm2m_resource_values", {
  id: varchar("id", { length: 64 }).primaryKey(),
  resourceId: varchar("resourceId", { length: 64 }).notNull(),
  gatewayId: varchar("gatewayId", { length: 64 }).notNull(),
  value: text("value"),
  timestamp: timestamp("timestamp").defaultNow(),
  updatedAt: timestamp("updatedAt").defaultNow()
}, (table) => ({
  gatewayIdIdx: index("idx_gateway_id").on(table.gatewayId),
  timestampIdx: index("idx_timestamp").on(table.timestamp)
}));
var lwm2mCommands = mysqlTable("lwm2m_commands", {
  id: varchar("id", { length: 64 }).primaryKey(),
  gatewayId: varchar("gatewayId", { length: 64 }).notNull(),
  resourceId: varchar("resourceId", { length: 64 }).notNull(),
  commandType: mysqlEnum("commandType", ["read", "write", "execute"]).notNull(),
  value: text("value"),
  status: mysqlEnum("status", ["pending", "sent", "success", "failed"]).default("pending").notNull(),
  error: text("error"),
  createdAt: timestamp("createdAt").defaultNow(),
  completedAt: timestamp("completedAt")
});
var configTemplates = mysqlTable("config_templates", {
  id: varchar("id", { length: 64 }).primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  ownerId: varchar("ownerId", { length: 64 }).notNull(),
  config: json("config").notNull(),
  version: int("version").default(1).notNull(),
  createdAt: timestamp("createdAt").defaultNow(),
  updatedAt: timestamp("updatedAt").defaultNow()
});
var configDeployments = mysqlTable("config_deployments", {
  id: varchar("id", { length: 64 }).primaryKey(),
  templateId: varchar("templateId", { length: 64 }).notNull(),
  gatewayId: varchar("gatewayId", { length: 64 }).notNull(),
  status: mysqlEnum("status", ["pending", "in_progress", "success", "failed", "rolled_back"]).default("pending").notNull(),
  previousConfig: json("previousConfig"),
  error: text("error"),
  createdAt: timestamp("createdAt").defaultNow(),
  completedAt: timestamp("completedAt")
});
var alerts = mysqlTable("alerts", {
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
  resolvedAt: timestamp("resolvedAt")
});
var jobs = mysqlTable("jobs", {
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
  updatedAt: timestamp("updatedAt").defaultNow()
});
var jobExecutions = mysqlTable("job_executions", {
  id: varchar("id", { length: 64 }).primaryKey(),
  jobId: varchar("jobId", { length: 64 }).notNull(),
  gatewayId: varchar("gatewayId", { length: 64 }).notNull(),
  status: mysqlEnum("status", ["pending", "running", "success", "failed"]).default("pending").notNull(),
  result: json("result"),
  error: text("error"),
  startedAt: timestamp("startedAt"),
  completedAt: timestamp("completedAt"),
  createdAt: timestamp("createdAt").defaultNow()
});
var automationRules = mysqlTable("automation_rules", {
  id: varchar("id", { length: 64 }).primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  ownerId: varchar("ownerId", { length: 64 }).notNull(),
  isActive: boolean("isActive").default(true).notNull(),
  conditions: json("conditions").notNull(),
  actions: json("actions").notNull(),
  createdAt: timestamp("createdAt").defaultNow(),
  updatedAt: timestamp("updatedAt").defaultNow()
});
var auditLogs = mysqlTable("audit_logs", {
  id: varchar("id", { length: 64 }).primaryKey(),
  userId: varchar("userId", { length: 64 }).notNull(),
  action: varchar("action", { length: 255 }).notNull(),
  resourceType: varchar("resourceType", { length: 100 }).notNull(),
  resourceId: varchar("resourceId", { length: 64 }),
  details: json("details"),
  createdAt: timestamp("createdAt").defaultNow()
}, (table) => ({
  userIdIdx: index("idx_audit_user_id").on(table.userId),
  createdAtIdx: index("idx_audit_created_at").on(table.createdAt)
}));
var connectivityMetrics = mysqlTable("connectivity_metrics", {
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
  timestamp: timestamp("timestamp").defaultNow()
}, (table) => ({
  gatewayIdIdx: index("idx_metrics_gateway_id").on(table.gatewayId),
  timestampIdx: index("idx_metrics_timestamp").on(table.timestamp)
}));
var reports = mysqlTable("reports", {
  id: varchar("id", { length: 64 }).primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  ownerId: varchar("ownerId", { length: 64 }).notNull(),
  reportType: mysqlEnum("reportType", ["connectivity", "performance", "alerts", "custom"]).notNull(),
  schedule: varchar("schedule", { length: 255 }),
  isActive: boolean("isActive").default(true).notNull(),
  config: json("config"),
  createdAt: timestamp("createdAt").defaultNow(),
  updatedAt: timestamp("updatedAt").defaultNow()
});
var deviceGroupsRelations = relations(deviceGroups, ({ many }) => ({
  gateways: many(gateways)
}));
var gatewaysRelations = relations(gateways, ({ one, many }) => ({
  group: one(deviceGroups, {
    fields: [gateways.groupId],
    references: [deviceGroups.id]
  }),
  objects: many(lwm2mObjects),
  resourceValues: many(lwm2mResourceValues),
  commands: many(lwm2mCommands),
  alerts: many(alerts),
  metrics: many(connectivityMetrics),
  deployments: many(configDeployments)
}));
var lwm2mObjectsRelations = relations(lwm2mObjects, ({ one, many }) => ({
  gateway: one(gateways, {
    fields: [lwm2mObjects.gatewayId],
    references: [gateways.id]
  }),
  resources: many(lwm2mResources)
}));
var lwm2mResourcesRelations = relations(lwm2mResources, ({ one, many }) => ({
  object: one(lwm2mObjects, {
    fields: [lwm2mResources.objectId],
    references: [lwm2mObjects.id]
  }),
  values: many(lwm2mResourceValues),
  commands: many(lwm2mCommands)
}));
var lwm2mResourceValuesRelations = relations(lwm2mResourceValues, ({ one }) => ({
  resource: one(lwm2mResources, {
    fields: [lwm2mResourceValues.resourceId],
    references: [lwm2mResources.id]
  }),
  gateway: one(gateways, {
    fields: [lwm2mResourceValues.gatewayId],
    references: [gateways.id]
  })
}));
var lwm2mCommandsRelations = relations(lwm2mCommands, ({ one }) => ({
  gateway: one(gateways, {
    fields: [lwm2mCommands.gatewayId],
    references: [gateways.id]
  }),
  resource: one(lwm2mResources, {
    fields: [lwm2mCommands.resourceId],
    references: [lwm2mResources.id]
  })
}));
var configTemplatesRelations = relations(configTemplates, ({ many }) => ({
  deployments: many(configDeployments)
}));
var configDeploymentsRelations = relations(configDeployments, ({ one }) => ({
  template: one(configTemplates, {
    fields: [configDeployments.templateId],
    references: [configTemplates.id]
  }),
  gateway: one(gateways, {
    fields: [configDeployments.gatewayId],
    references: [gateways.id]
  })
}));
var alertsRelations = relations(alerts, ({ one }) => ({
  gateway: one(gateways, {
    fields: [alerts.gatewayId],
    references: [gateways.id]
  })
}));
var jobsRelations = relations(jobs, ({ many }) => ({
  executions: many(jobExecutions)
}));
var jobExecutionsRelations = relations(jobExecutions, ({ one }) => ({
  job: one(jobs, {
    fields: [jobExecutions.jobId],
    references: [jobs.id]
  }),
  gateway: one(gateways, {
    fields: [jobExecutions.gatewayId],
    references: [gateways.id]
  })
}));
var connectivityMetricsRelations = relations(connectivityMetrics, ({ one }) => ({
  gateway: one(gateways, {
    fields: [connectivityMetrics.gatewayId],
    references: [gateways.id]
  })
}));

// server/db.ts
var _db = null;
async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}
async function updateUser(id, updates) {
  const db = await getDb();
  if (!db) return;
  try {
    await db.update(users).set(updates).where(eq(users.id, id));
  } catch (error) {
    console.error("[Database] Failed to update user:", error);
  }
}
async function getUser(id) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get user: database not available");
    return void 0;
  }
  const result = await db.select().from(users).where(eq(users.id, id)).limit(1);
  return result.length > 0 ? result[0] : void 0;
}
async function createSession(session) {
  const db = await getDb();
  if (!db) return null;
  try {
    await db.insert(sessions).values(session);
    const result = await db.select().from(sessions).where(eq(sessions.id, session.id)).limit(1);
    return result[0];
  } catch (error) {
    console.error("[Database] Failed to create session:", error);
    return null;
  }
}
async function createGateway(gateway) {
  const db = await getDb();
  if (!db) return null;
  try {
    await db.insert(gateways).values(gateway);
    const result = await db.select().from(gateways).where(eq(gateways.id, gateway.id)).limit(1);
    return result[0];
  } catch (error) {
    console.error("[Database] Failed to create gateway:", error);
    return null;
  }
}
async function listGatewaysByOwner(ownerId) {
  const db = await getDb();
  if (!db) return [];
  try {
    return await db.select().from(gateways).where(eq(gateways.ownerId, ownerId));
  } catch (error) {
    console.error("[Database] Failed to list gateways:", error);
    return [];
  }
}
async function getGateway(id) {
  const db = await getDb();
  if (!db) return null;
  try {
    const result = await db.select().from(gateways).where(eq(gateways.id, id)).limit(1);
    return result.length > 0 ? result[0] : null;
  } catch (error) {
    console.error("[Database] Failed to get gateway:", error);
    return null;
  }
}
async function updateGatewayStatus(id, status, ipAddress) {
  const db = await getDb();
  if (!db) return;
  try {
    const updates = {
      status,
      lastSeen: /* @__PURE__ */ new Date()
    };
    if (ipAddress) {
      updates.ipAddress = ipAddress;
    }
    await db.update(gateways).set(updates).where(eq(gateways.id, id));
  } catch (error) {
    console.error("[Database] Failed to update gateway status:", error);
  }
}
async function createLWM2MObject(object) {
  const db = await getDb();
  if (!db) return null;
  try {
    await db.insert(lwm2mObjects).values(object);
    const result = await db.select().from(lwm2mObjects).where(eq(lwm2mObjects.id, object.id)).limit(1);
    return result[0];
  } catch (error) {
    console.error("[Database] Failed to create LWM2M object:", error);
    return null;
  }
}
async function listLWM2MObjects(gatewayId) {
  const db = await getDb();
  if (!db) return [];
  try {
    return await db.select().from(lwm2mObjects).where(eq(lwm2mObjects.gatewayId, gatewayId));
  } catch (error) {
    console.error("[Database] Failed to list LWM2M objects:", error);
    return [];
  }
}
async function createLWM2MResource(resource) {
  const db = await getDb();
  if (!db) return null;
  try {
    await db.insert(lwm2mResources).values(resource);
    const result = await db.select().from(lwm2mResources).where(eq(lwm2mResources.id, resource.id)).limit(1);
    return result[0];
  } catch (error) {
    console.error("[Database] Failed to create LWM2M resource:", error);
    return null;
  }
}
async function listLWM2MResources(objectId) {
  const db = await getDb();
  if (!db) return [];
  try {
    return await db.select().from(lwm2mResources).where(eq(lwm2mResources.objectId, objectId));
  } catch (error) {
    console.error("[Database] Failed to list LWM2M resources:", error);
    return [];
  }
}
async function recordResourceValue(value) {
  const db = await getDb();
  if (!db) return null;
  try {
    await db.insert(lwm2mResourceValues).values(value);
    const result = await db.select().from(lwm2mResourceValues).where(eq(lwm2mResourceValues.id, value.id)).limit(1);
    return result[0];
  } catch (error) {
    console.error("[Database] Failed to record resource value:", error);
    return null;
  }
}
async function getLatestResourceValue(resourceId) {
  const db = await getDb();
  if (!db) return null;
  try {
    const result = await db.select().from(lwm2mResourceValues).where(eq(lwm2mResourceValues.resourceId, resourceId)).orderBy((t2) => t2.timestamp).limit(1);
    return result.length > 0 ? result[0] : null;
  } catch (error) {
    console.error("[Database] Failed to get latest resource value:", error);
    return null;
  }
}
async function createCommand(command) {
  const db = await getDb();
  if (!db) return null;
  try {
    await db.insert(lwm2mCommands).values(command);
    const result = await db.select().from(lwm2mCommands).where(eq(lwm2mCommands.id, command.id)).limit(1);
    return result[0];
  } catch (error) {
    console.error("[Database] Failed to create command:", error);
    return null;
  }
}
async function getCommand(id) {
  const db = await getDb();
  if (!db) return null;
  const result = await db.select().from(lwm2mCommands).where(eq(lwm2mCommands.id, id)).limit(1);
  return result.length > 0 ? result[0] : null;
}
async function updateCommandStatus(id, status, error) {
  const db = await getDb();
  if (!db) return;
  try {
    const updates = {
      status
    };
    if (error) {
      updates.error = error;
    }
    if (status === "success" || status === "failed") {
      updates.completedAt = /* @__PURE__ */ new Date();
    }
    await db.update(lwm2mCommands).set(updates).where(eq(lwm2mCommands.id, id));
  } catch (error2) {
    console.error("[Database] Failed to update command status:", error2);
  }
}
async function listPendingCommands(gatewayId) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(lwm2mCommands).where(and(eq(lwm2mCommands.gatewayId, gatewayId), eq(lwm2mCommands.status, "pending")));
}
async function createDeviceGroup(group) {
  const db = await getDb();
  if (!db) return null;
  try {
    await db.insert(deviceGroups).values(group);
    const result = await db.select().from(deviceGroups).where(eq(deviceGroups.id, group.id)).limit(1);
    return result[0];
  } catch (error) {
    console.error("[Database] Failed to create device group:", error);
    return null;
  }
}
async function listDeviceGroups(ownerId) {
  const db = await getDb();
  if (!db) return [];
  try {
    return await db.select().from(deviceGroups).where(eq(deviceGroups.ownerId, ownerId));
  } catch (error) {
    console.error("[Database] Failed to list device groups:", error);
    return [];
  }
}
async function createConfigTemplate(template) {
  const db = await getDb();
  if (!db) return null;
  try {
    await db.insert(configTemplates).values(template);
    const result = await db.select().from(configTemplates).where(eq(configTemplates.id, template.id)).limit(1);
    return result[0];
  } catch (error) {
    console.error("[Database] Failed to create config template:", error);
    return null;
  }
}
async function listConfigTemplates(ownerId) {
  const db = await getDb();
  if (!db) return [];
  try {
    return await db.select().from(configTemplates).where(eq(configTemplates.ownerId, ownerId));
  } catch (error) {
    console.error("[Database] Failed to list config templates:", error);
    return [];
  }
}
async function listAlerts(gatewayId, unresolved = false) {
  const db = await getDb();
  if (!db) return [];
  try {
    let conditions = [];
    if (gatewayId) conditions.push(eq(alerts.gatewayId, gatewayId));
    if (unresolved) conditions.push(eq(alerts.isResolved, false));
    const query = conditions.length > 0 ? db.select().from(alerts).where(and(...conditions)) : db.select().from(alerts);
    return await query;
  } catch (error) {
    console.error("[Database] Failed to list alerts:", error);
    return [];
  }
}
async function resolveAlert(alertId) {
  const db = await getDb();
  if (!db) return;
  try {
    await db.update(alerts).set({
      isResolved: true,
      resolvedAt: /* @__PURE__ */ new Date()
    }).where(eq(alerts.id, alertId));
  } catch (error) {
    console.error("[Database] Failed to resolve alert:", error);
  }
}
async function recordConnectivityMetrics(metrics) {
  const db = await getDb();
  if (!db) return null;
  try {
    await db.insert(connectivityMetrics).values(metrics);
    const result = await db.select().from(connectivityMetrics).where(eq(connectivityMetrics.id, metrics.id)).limit(1);
    return result[0];
  } catch (error) {
    console.error("[Database] Failed to record connectivity metrics:", error);
    return null;
  }
}
async function getLatestMetrics(gatewayId) {
  const db = await getDb();
  if (!db) return null;
  try {
    const result = await db.select().from(connectivityMetrics).where(eq(connectivityMetrics.gatewayId, gatewayId)).orderBy((t2) => t2.timestamp).limit(1);
    return result.length > 0 ? result[0] : null;
  } catch (error) {
    console.error("[Database] Failed to get latest metrics:", error);
    return null;
  }
}
async function createJob(job) {
  const db = await getDb();
  if (!db) return null;
  try {
    await db.insert(jobs).values(job);
    const result = await db.select().from(jobs).where(eq(jobs.id, job.id)).limit(1);
    return result[0];
  } catch (error) {
    console.error("[Database] Failed to create job:", error);
    return null;
  }
}
async function listJobs(ownerId) {
  const db = await getDb();
  if (!db) return [];
  try {
    return await db.select().from(jobs).where(eq(jobs.ownerId, ownerId));
  } catch (error) {
    console.error("[Database] Failed to list jobs:", error);
    return [];
  }
}
async function createAutomationRule(rule) {
  const db = await getDb();
  if (!db) return null;
  try {
    await db.insert(automationRules).values(rule);
    const result = await db.select().from(automationRules).where(eq(automationRules.id, rule.id)).limit(1);
    return result[0];
  } catch (error) {
    console.error("[Database] Failed to create automation rule:", error);
    return null;
  }
}
async function listAutomationRules(ownerId) {
  const db = await getDb();
  if (!db) return [];
  try {
    return await db.select().from(automationRules).where(eq(automationRules.ownerId, ownerId));
  } catch (error) {
    console.error("[Database] Failed to list automation rules:", error);
    return [];
  }
}
async function listAuditLogs(userId, limit = 100) {
  const db = await getDb();
  if (!db) return [];
  try {
    const query = userId ? db.select().from(auditLogs).where(eq(auditLogs.userId, userId)).orderBy((t2) => t2.createdAt).limit(limit) : db.select().from(auditLogs).orderBy((t2) => t2.createdAt).limit(limit);
    return await query;
  } catch (error) {
    console.error("[Database] Failed to list audit logs:", error);
    return [];
  }
}

// server/_core/env.ts
var ENV = {
  appId: process.env.VITE_APP_ID ?? "",
  cookieSecret: process.env.JWT_SECRET ?? "",
  databaseUrl: process.env.DATABASE_URL ?? "",
  oAuthServerUrl: process.env.OAUTH_SERVER_URL ?? "",
  ownerId: process.env.OWNER_OPEN_ID ?? "",
  isProduction: process.env.NODE_ENV === "production",
  forgeApiUrl: process.env.BUILT_IN_FORGE_API_URL ?? "",
  forgeApiKey: process.env.BUILT_IN_FORGE_API_KEY ?? ""
};

// server/_core/sdk.ts
var isNonEmptyString = (value) => typeof value === "string" && value.length > 0;
var EXCHANGE_TOKEN_PATH = `/webdev.v1.WebDevAuthPublicService/ExchangeToken`;
var GET_USER_INFO_PATH = `/webdev.v1.WebDevAuthPublicService/GetUserInfo`;
var GET_USER_INFO_WITH_JWT_PATH = `/webdev.v1.WebDevAuthPublicService/GetUserInfoWithJwt`;
var OAuthService = class {
  constructor(client) {
    this.client = client;
    console.log("[OAuth] Initialized with baseURL:", ENV.oAuthServerUrl);
    if (!ENV.oAuthServerUrl) {
      console.error(
        "[OAuth] ERROR: OAUTH_SERVER_URL is not configured! Set OAUTH_SERVER_URL environment variable."
      );
    }
  }
  decodeState(state) {
    const redirectUri = atob(state);
    return redirectUri;
  }
  async getTokenByCode(code, state) {
    const payload = {
      clientId: ENV.appId,
      grantType: "authorization_code",
      code,
      redirectUri: this.decodeState(state)
    };
    const { data } = await this.client.post(
      EXCHANGE_TOKEN_PATH,
      payload
    );
    return data;
  }
  async getUserInfoByToken(token) {
    const { data } = await this.client.post(
      GET_USER_INFO_PATH,
      {
        accessToken: token.accessToken
      }
    );
    return data;
  }
};
var createOAuthHttpClient = () => axios.create({
  baseURL: ENV.oAuthServerUrl,
  timeout: AXIOS_TIMEOUT_MS
});
var SDKServer = class {
  client;
  oauthService;
  constructor(client = createOAuthHttpClient()) {
    this.client = client;
    this.oauthService = new OAuthService(this.client);
  }
  deriveLoginMethod(platforms, fallback) {
    if (fallback && fallback.length > 0) return fallback;
    if (!Array.isArray(platforms) || platforms.length === 0) return null;
    const set = new Set(
      platforms.filter((p) => typeof p === "string")
    );
    if (set.has("REGISTERED_PLATFORM_EMAIL")) return "email";
    if (set.has("REGISTERED_PLATFORM_GOOGLE")) return "google";
    if (set.has("REGISTERED_PLATFORM_APPLE")) return "apple";
    if (set.has("REGISTERED_PLATFORM_MICROSOFT") || set.has("REGISTERED_PLATFORM_AZURE"))
      return "microsoft";
    if (set.has("REGISTERED_PLATFORM_GITHUB")) return "github";
    const first = Array.from(set)[0];
    return first ? first.toLowerCase() : null;
  }
  /**
   * Exchange OAuth authorization code for access token
   * @example
   * const tokenResponse = await sdk.exchangeCodeForToken(code, state);
   */
  async exchangeCodeForToken(code, state) {
    return this.oauthService.getTokenByCode(code, state);
  }
  /**
   * Get user information using access token
   * @example
   * const userInfo = await sdk.getUserInfo(tokenResponse.accessToken);
   */
  async getUserInfo(accessToken) {
    const data = await this.oauthService.getUserInfoByToken({
      accessToken
    });
    const loginMethod = this.deriveLoginMethod(
      data?.platforms,
      data?.platform ?? data.platform ?? null
    );
    return {
      ...data,
      platform: loginMethod,
      loginMethod
    };
  }
  parseCookies(cookieHeader) {
    if (!cookieHeader) {
      return /* @__PURE__ */ new Map();
    }
    const parsed = parseCookieHeader(cookieHeader);
    return new Map(Object.entries(parsed));
  }
  getSessionSecret() {
    const secret = ENV.cookieSecret;
    return new TextEncoder().encode(secret);
  }
  /**
   * Create a session token for a user ID
   * @example
   * const sessionToken = await sdk.createSessionToken(userInfo.id);
   */
  async createSessionToken(userId, options = {}) {
    return this.signSession(
      {
        openId: userId,
        appId: ENV.appId,
        name: options.name || ""
      },
      options
    );
  }
  async signSession(payload, options = {}) {
    const issuedAt = Date.now();
    const expiresInMs = options.expiresInMs ?? ONE_YEAR_MS;
    const expirationSeconds = Math.floor((issuedAt + expiresInMs) / 1e3);
    const secretKey = this.getSessionSecret();
    return new SignJWT({
      openId: payload.openId,
      appId: payload.appId,
      name: payload.name
    }).setProtectedHeader({ alg: "HS256", typ: "JWT" }).setExpirationTime(expirationSeconds).sign(secretKey);
  }
  async verifySession(cookieValue) {
    if (!cookieValue) {
      console.warn("[Auth] Missing session cookie");
      return null;
    }
    try {
      const secretKey = this.getSessionSecret();
      const { payload } = await jwtVerify(cookieValue, secretKey, {
        algorithms: ["HS256"]
      });
      const { openId, appId, name } = payload;
      if (!isNonEmptyString(openId) || !isNonEmptyString(appId) || !isNonEmptyString(name)) {
        console.warn("[Auth] Session payload missing required fields");
        return null;
      }
      return {
        openId,
        appId,
        name
      };
    } catch (error) {
      console.warn("[Auth] Session verification failed", String(error));
      return null;
    }
  }
  async getUserInfoWithJwt(jwtToken) {
    const payload = {
      jwtToken,
      projectId: ENV.appId
    };
    const { data } = await this.client.post(
      GET_USER_INFO_WITH_JWT_PATH,
      payload
    );
    const loginMethod = this.deriveLoginMethod(
      data?.platforms,
      data?.platform ?? data.platform ?? null
    );
    return {
      ...data,
      platform: loginMethod,
      loginMethod
    };
  }
  async authenticateRequest(req) {
    const cookies = this.parseCookies(req.headers.cookie);
    const sessionCookie = cookies.get(COOKIE_NAME);
    const session = await this.verifySession(sessionCookie);
    if (!session) {
      throw ForbiddenError("Invalid session cookie");
    }
    const sessionUserId = session.openId;
    const signedInAt = /* @__PURE__ */ new Date();
    let user = await getUser(sessionUserId);
    if (!user) {
      try {
        throw new Error("OAuth is not configured for this deployment");
      } catch (error) {
        console.error("[Auth] Failed to sync user from OAuth:", error);
        throw ForbiddenError("Failed to sync user info");
      }
    }
    if (!user) {
      throw ForbiddenError("User not found");
    }
    await updateUser(user.id, {
      lastSignedIn: signedInAt
    });
    return user;
  }
};
var sdk = new SDKServer();

// server/_core/oauth.ts
function getQueryParam(req, key) {
  const value = req.query[key];
  return typeof value === "string" ? value : void 0;
}
function registerOAuthRoutes(app) {
  app.get("/api/oauth/callback", async (req, res) => {
    const code = getQueryParam(req, "code");
    const state = getQueryParam(req, "state");
    if (!code || !state) {
      res.status(400).json({ error: "code and state are required" });
      return;
    }
    try {
      const tokenResponse = await sdk.exchangeCodeForToken(code, state);
      const userInfo = await sdk.getUserInfo(tokenResponse.accessToken);
      if (!userInfo.openId) {
        res.status(400).json({ error: "openId missing from user info" });
        return;
      }
      throw new Error("OAuth is not configured for this deployment");
      const sessionToken = await sdk.createSessionToken(userInfo.openId, {
        name: userInfo.name || "",
        expiresInMs: ONE_YEAR_MS
      });
      const cookieOptions = getSessionCookieOptions(req);
      res.cookie(COOKIE_NAME, sessionToken, { ...cookieOptions, maxAge: ONE_YEAR_MS });
      res.redirect(302, "/");
    } catch (error) {
      console.error("[OAuth] Callback failed", error);
      res.status(500).json({ error: "OAuth callback failed" });
    }
  });
}

// server/_core/systemRouter.ts
import { z } from "zod";

// server/_core/notification.ts
import { TRPCError } from "@trpc/server";
var TITLE_MAX_LENGTH = 1200;
var CONTENT_MAX_LENGTH = 2e4;
var trimValue = (value) => value.trim();
var isNonEmptyString2 = (value) => typeof value === "string" && value.trim().length > 0;
var buildEndpointUrl = (baseUrl) => {
  const normalizedBase = baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`;
  return new URL(
    "webdevtoken.v1.WebDevService/SendNotification",
    normalizedBase
  ).toString();
};
var validatePayload = (input) => {
  if (!isNonEmptyString2(input.title)) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Notification title is required."
    });
  }
  if (!isNonEmptyString2(input.content)) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Notification content is required."
    });
  }
  const title = trimValue(input.title);
  const content = trimValue(input.content);
  if (title.length > TITLE_MAX_LENGTH) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: `Notification title must be at most ${TITLE_MAX_LENGTH} characters.`
    });
  }
  if (content.length > CONTENT_MAX_LENGTH) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: `Notification content must be at most ${CONTENT_MAX_LENGTH} characters.`
    });
  }
  return { title, content };
};
async function notifyOwner(payload) {
  const { title, content } = validatePayload(payload);
  if (!ENV.forgeApiUrl) {
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: "Notification service URL is not configured."
    });
  }
  if (!ENV.forgeApiKey) {
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: "Notification service API key is not configured."
    });
  }
  const endpoint = buildEndpointUrl(ENV.forgeApiUrl);
  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        accept: "application/json",
        authorization: `Bearer ${ENV.forgeApiKey}`,
        "content-type": "application/json",
        "connect-protocol-version": "1"
      },
      body: JSON.stringify({ title, content })
    });
    if (!response.ok) {
      const detail = await response.text().catch(() => "");
      console.warn(
        `[Notification] Failed to notify owner (${response.status} ${response.statusText})${detail ? `: ${detail}` : ""}`
      );
      return false;
    }
    return true;
  } catch (error) {
    console.warn("[Notification] Error calling notification service:", error);
    return false;
  }
}

// server/_core/trpc.ts
import { initTRPC, TRPCError as TRPCError2 } from "@trpc/server";
import superjson from "superjson";
var t = initTRPC.context().create({
  transformer: superjson
});
var router = t.router;
var publicProcedure = t.procedure;
var requireUser = t.middleware(async (opts) => {
  const { ctx, next } = opts;
  if (!ctx.user) {
    throw new TRPCError2({ code: "UNAUTHORIZED", message: UNAUTHED_ERR_MSG });
  }
  return next({
    ctx: {
      ...ctx,
      user: ctx.user
    }
  });
});
var protectedProcedure = t.procedure.use(requireUser);
var adminProcedure = t.procedure.use(
  t.middleware(async (opts) => {
    const { ctx, next } = opts;
    if (!ctx.user || ctx.user.role !== "admin") {
      throw new TRPCError2({ code: "FORBIDDEN", message: NOT_ADMIN_ERR_MSG });
    }
    return next({
      ctx: {
        ...ctx,
        user: ctx.user
      }
    });
  })
);

// server/_core/systemRouter.ts
var systemRouter = router({
  health: publicProcedure.input(
    z.object({
      timestamp: z.number().min(0, "timestamp cannot be negative")
    })
  ).query(() => ({
    ok: true
  })),
  notifyOwner: adminProcedure.input(
    z.object({
      title: z.string().min(1, "title is required"),
      content: z.string().min(1, "content is required")
    })
  ).mutation(async ({ input }) => {
    const delivered = await notifyOwner(input);
    return {
      success: delivered
    };
  })
});

// server/routers.ts
import { z as z2 } from "zod";

// server/auth.ts
import bcrypt from "bcrypt";
import crypto from "crypto";
import { eq as eq2 } from "drizzle-orm";
var SALT_ROUNDS = 10;
var SESSION_DURATION = 7 * 24 * 60 * 60 * 1e3;
var RECOVERY_CODE_DURATION = 24 * 60 * 60 * 1e3;
async function hashPassword(password) {
  return bcrypt.hash(password, SALT_ROUNDS);
}
async function verifyPassword(password, hash) {
  return bcrypt.compare(password, hash);
}
async function authenticateUser(username, password) {
  const db = await getDb();
  if (!db) return null;
  try {
    const result = await db.select().from(users).where(eq2(users.username, username)).limit(1);
    if (result.length === 0) {
      console.log("[Auth] User not found:", username);
      return null;
    }
    const user = result[0];
    if (!user.isActive) {
      console.log("[Auth] User is inactive:", username);
      return null;
    }
    const passwordMatch = await verifyPassword(password, user.passwordHash);
    if (!passwordMatch) {
      console.log("[Auth] Invalid password for user:", username);
      return null;
    }
    await db.update(users).set({ lastSignedIn: /* @__PURE__ */ new Date() }).where(eq2(users.id, user.id));
    return {
      id: user.id,
      username: user.username,
      email: user.email
    };
  } catch (error) {
    console.error("[Auth] Authentication error:", error);
    return null;
  }
}
async function createNewSession(userId) {
  try {
    const sessionId = crypto.randomUUID();
    const token = crypto.randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + SESSION_DURATION);
    const session = await createSession({
      id: sessionId,
      userId,
      token,
      expiresAt,
      createdAt: /* @__PURE__ */ new Date(),
      lastActivityAt: /* @__PURE__ */ new Date()
    });
    if (!session) {
      return null;
    }
    return sessionId;
  } catch (error) {
    console.error("[Auth] Failed to create session:", error);
    return null;
  }
}
async function changePassword(userId, currentPassword, newPassword) {
  const db = await getDb();
  if (!db) return false;
  try {
    const result = await db.select().from(users).where(eq2(users.id, userId)).limit(1);
    if (result.length === 0) {
      return false;
    }
    const user = result[0];
    const passwordMatch = await verifyPassword(currentPassword, user.passwordHash);
    if (!passwordMatch) {
      return false;
    }
    const newPasswordHash = await hashPassword(newPassword);
    await db.update(users).set({
      passwordHash: newPasswordHash,
      updatedAt: /* @__PURE__ */ new Date()
    }).where(eq2(users.id, userId));
    console.log("[Auth] Password changed for user:", user.username);
    return true;
  } catch (error) {
    console.error("[Auth] Failed to change password:", error);
    return false;
  }
}

// server/routers.ts
import { TRPCError as TRPCError3 } from "@trpc/server";
var appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query((opts) => opts.ctx.user),
    login: publicProcedure.input(z2.object({ username: z2.string(), password: z2.string() })).mutation(async ({ input, ctx }) => {
      const user = await authenticateUser(input.username, input.password);
      if (!user) {
        throw new TRPCError3({ code: "UNAUTHORIZED", message: "Invalid credentials" });
      }
      const sessionId = await createNewSession(user.id);
      if (!sessionId) {
        throw new TRPCError3({ code: "INTERNAL_SERVER_ERROR", message: "Failed to create session" });
      }
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.cookie(COOKIE_NAME, sessionId, { ...cookieOptions, maxAge: 7 * 24 * 60 * 60 * 1e3 });
      return { success: true, user };
    }),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true };
    }),
    changePassword: protectedProcedure.input(z2.object({ currentPassword: z2.string(), newPassword: z2.string() })).mutation(async ({ input, ctx }) => {
      const success = await changePassword(ctx.user.id, input.currentPassword, input.newPassword);
      if (!success) {
        throw new TRPCError3({ code: "BAD_REQUEST", message: "Invalid current password" });
      }
      return { success: true };
    })
  }),
  // ============================================================================
  // Gateway Management
  // ============================================================================
  gateways: router({
    /**
     * List all gateways for the current user
     */
    list: protectedProcedure.query(async ({ ctx }) => {
      return listGatewaysByOwner(ctx.user.id);
    }),
    /**
     * Get a specific gateway
     */
    get: protectedProcedure.input(z2.object({ id: z2.string() })).query(async ({ input }) => {
      const gateway = await getGateway(input.id);
      if (!gateway) {
        throw new TRPCError3({ code: "NOT_FOUND" });
      }
      return gateway;
    }),
    /**
     * Create a new gateway
     */
    create: protectedProcedure.input(
      z2.object({
        name: z2.string().min(1),
        endpoint: z2.string().min(1),
        ipAddress: z2.string().optional(),
        serialNumber: z2.string().optional()
      })
    ).mutation(async ({ input, ctx }) => {
      const gatewayId = `gw-${input.endpoint}-${Date.now()}`;
      const gateway = await createGateway({
        id: gatewayId,
        name: input.name,
        endpoint: input.endpoint,
        ipAddress: input.ipAddress,
        ownerId: ctx.user.id,
        serialNumber: input.serialNumber
      });
      if (!gateway) {
        throw new TRPCError3({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to create gateway"
        });
      }
      return gateway;
    }),
    /**
     * Update gateway status
     */
    updateStatus: protectedProcedure.input(
      z2.object({
        id: z2.string(),
        status: z2.enum(["online", "offline", "error"]),
        ipAddress: z2.string().optional()
      })
    ).mutation(async ({ input }) => {
      await updateGatewayStatus(input.id, input.status, input.ipAddress);
      return { success: true };
    })
  }),
  // ============================================================================
  // LWM2M Objects Management
  // ============================================================================
  objects: router({
    /**
     * List objects for a gateway
     */
    listByGateway: protectedProcedure.input(z2.object({ gatewayId: z2.string() })).query(async ({ input }) => {
      return listLWM2MObjects(input.gatewayId);
    }),
    /**
     * Create or update an LWM2M object
     */
    createOrUpdate: protectedProcedure.input(
      z2.object({
        id: z2.string(),
        gatewayId: z2.string(),
        objectId: z2.number(),
        objectName: z2.string(),
        description: z2.string().optional()
      })
    ).mutation(async ({ input }) => {
      const object = await createLWM2MObject({
        id: input.id,
        gatewayId: input.gatewayId,
        objectId: input.objectId,
        objectName: input.objectName,
        description: input.description
      });
      if (!object) {
        throw new TRPCError3({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to create/update object"
        });
      }
      return object;
    })
  }),
  // ============================================================================
  // LWM2M Resources Management
  // ============================================================================
  resources: router({
    /**
     * List resources for an object
     */
    listByObject: protectedProcedure.input(z2.object({ objectId: z2.string() })).query(async ({ input }) => {
      return listLWM2MResources(input.objectId);
    }),
    /**
     * Create or update an LWM2M resource
     */
    createOrUpdate: protectedProcedure.input(
      z2.object({
        id: z2.string(),
        objectId: z2.string(),
        resourceId: z2.number(),
        resourceName: z2.string(),
        resourceType: z2.enum(["variable", "setting"]),
        dataType: z2.string().optional(),
        description: z2.string().optional(),
        constraints: z2.any().optional()
      })
    ).mutation(async ({ input }) => {
      const resource = await createLWM2MResource({
        id: input.id,
        objectId: input.objectId,
        resourceId: input.resourceId,
        resourceName: input.resourceName,
        resourceType: input.resourceType,
        dataType: input.dataType,
        description: input.description
      });
      if (!resource) {
        throw new TRPCError3({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to create/update resource"
        });
      }
      return resource;
    }),
    /**
     * Get the latest value for a resource
     */
    getValue: protectedProcedure.input(z2.object({ resourceId: z2.string(), gatewayId: z2.string() })).query(async ({ input }) => {
      return getLatestResourceValue(input.resourceId);
    }),
    /**
     * Set a resource value
     */
    setValue: protectedProcedure.input(z2.object({ resourceId: z2.string(), gatewayId: z2.string(), value: z2.string() })).mutation(async ({ input }) => {
      const result = await recordResourceValue({ id: `${input.resourceId}-${Date.now()}`, resourceId: input.resourceId, gatewayId: input.gatewayId, value: input.value });
      if (!result) {
        throw new TRPCError3({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to set resource value"
        });
      }
      return result;
    })
  }),
  // ============================================================================
  // LWM2M Commands Management
  // ============================================================================
  commands: router({
    /**
     * Create a new command
     */
    create: protectedProcedure.input(
      z2.object({
        gatewayId: z2.string(),
        resourceId: z2.string(),
        commandType: z2.enum(["read", "write", "execute"]),
        value: z2.string().optional()
      })
    ).mutation(async ({ input }) => {
      const commandId = `cmd-${input.gatewayId}-${input.resourceId}-${Date.now()}`;
      const command = await createCommand({
        id: commandId,
        ...input
      });
      if (!command) {
        throw new TRPCError3({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to create command"
        });
      }
      return command;
    }),
    /**
     * Get a command
     */
    get: protectedProcedure.input(z2.object({ id: z2.string() })).query(async ({ input }) => {
      const command = await getCommand(input.id);
      if (!command) {
        throw new TRPCError3({ code: "NOT_FOUND" });
      }
      return command;
    }),
    /**
     * List pending commands for a gateway
     */
    listPending: protectedProcedure.input(z2.object({ gatewayId: z2.string() })).query(async ({ input }) => {
      return listPendingCommands(input.gatewayId);
    }),
    /**
     * Update command status
     */
    updateStatus: protectedProcedure.input(
      z2.object({
        id: z2.string(),
        status: z2.enum(["pending", "sent", "success", "failed"]),
        error: z2.string().optional()
      })
    ).mutation(async ({ input }) => {
      await updateCommandStatus(input.id, input.status, input.error);
      return { success: true };
    })
  }),
  // ============================================================================
  // Device Groups Management
  // ============================================================================
  deviceGroups: router({
    list: protectedProcedure.query(async ({ ctx }) => {
      return listDeviceGroups(ctx.user.id);
    }),
    create: protectedProcedure.input(
      z2.object({
        name: z2.string().min(1),
        description: z2.string().optional()
      })
    ).mutation(async ({ input, ctx }) => {
      const groupId = `grp-${Date.now()}`;
      const group = await createDeviceGroup({
        id: groupId,
        name: input.name,
        description: input.description,
        ownerId: ctx.user.id
      });
      return group;
    })
  }),
  // ============================================================================
  // Configuration Management
  // ============================================================================
  configurations: router({
    listTemplates: protectedProcedure.query(async ({ ctx }) => {
      return listConfigTemplates(ctx.user.id);
    }),
    createTemplate: protectedProcedure.input(
      z2.object({
        name: z2.string().min(1),
        description: z2.string().optional(),
        config: z2.record(z2.string(), z2.any())
      })
    ).mutation(async ({ input, ctx }) => {
      const templateId = `tpl-${Date.now()}`;
      const template = await createConfigTemplate({
        id: templateId,
        name: input.name,
        description: input.description,
        ownerId: ctx.user.id,
        config: input.config
      });
      return template;
    }),
    deployToGateway: protectedProcedure.input(
      z2.object({
        templateId: z2.string(),
        gatewayId: z2.string()
      })
    ).mutation(async ({ input }) => {
      const deploymentId = `dep-${Date.now()}`;
      return { id: deploymentId, status: "pending" };
    })
  }),
  // ============================================================================
  // Alerts & Monitoring
  // ============================================================================
  alerts: router({
    list: protectedProcedure.input(
      z2.object({
        gatewayId: z2.string().optional(),
        unresolved: z2.boolean().optional()
      })
    ).query(async ({ input }) => {
      return listAlerts(input.gatewayId, input.unresolved);
    }),
    resolve: protectedProcedure.input(z2.object({ id: z2.string() })).mutation(async ({ input }) => {
      await resolveAlert(input.id);
      return { success: true };
    })
  }),
  // ============================================================================
  // Connectivity Metrics
  // ============================================================================
  metrics: router({
    getLatest: protectedProcedure.input(z2.object({ gatewayId: z2.string() })).query(async ({ input }) => {
      return getLatestMetrics(input.gatewayId);
    }),
    record: protectedProcedure.input(
      z2.object({
        gatewayId: z2.string(),
        signalStrength: z2.number().optional(),
        signalQuality: z2.number().optional(),
        cellularTechnology: z2.string().optional(),
        activeSim: z2.number().optional(),
        ipv4Address: z2.string().optional(),
        ipv6Address: z2.string().optional(),
        uptime: z2.number().optional(),
        errorRate: z2.string().optional()
      })
    ).mutation(async ({ input }) => {
      const metricId = `met-${Date.now()}`;
      const metric = await recordConnectivityMetrics({
        id: metricId,
        ...input
      });
      return metric;
    })
  }),
  // ============================================================================
  // Jobs & Automation
  // ============================================================================
  jobs: router({
    list: protectedProcedure.query(async ({ ctx }) => {
      return listJobs(ctx.user.id);
    }),
    create: protectedProcedure.input(
      z2.object({
        name: z2.string().min(1),
        description: z2.string().optional(),
        jobType: z2.enum(["command", "configuration", "firmware_update", "reboot", "custom"]),
        targetType: z2.enum(["single", "group", "all"]),
        targetId: z2.string().optional(),
        schedule: z2.string().optional(),
        payload: z2.record(z2.string(), z2.any()).optional()
      })
    ).mutation(async ({ input, ctx }) => {
      const jobId = `job-${Date.now()}`;
      const job = await createJob({
        id: jobId,
        name: input.name,
        description: input.description,
        ownerId: ctx.user.id,
        jobType: input.jobType,
        targetType: input.targetType,
        targetId: input.targetId,
        schedule: input.schedule,
        payload: input.payload
      });
      return job;
    })
  }),
  // ============================================================================
  // Automation Rules
  // ============================================================================
  automation: router({
    listRules: protectedProcedure.query(async ({ ctx }) => {
      return listAutomationRules(ctx.user.id);
    }),
    createRule: protectedProcedure.input(
      z2.object({
        name: z2.string().min(1),
        description: z2.string().optional(),
        conditions: z2.record(z2.string(), z2.any()),
        actions: z2.record(z2.string(), z2.any())
      })
    ).mutation(async ({ input, ctx }) => {
      const ruleId = `rule-${Date.now()}`;
      const rule = await createAutomationRule({
        id: ruleId,
        name: input.name,
        description: input.description,
        ownerId: ctx.user.id,
        conditions: input.conditions,
        actions: input.actions
      });
      return rule;
    })
  }),
  // ============================================================================
  // Audit Logs
  // ============================================================================
  audit: router({
    listLogs: protectedProcedure.input(
      z2.object({
        limit: z2.number().optional()
      })
    ).query(async ({ input, ctx }) => {
      return listAuditLogs(ctx.user.id, input.limit);
    })
  })
});

// server/_core/context.ts
async function createContext(opts) {
  let user = null;
  try {
    user = await sdk.authenticateRequest(opts.req);
  } catch (error) {
    user = null;
  }
  return {
    req: opts.req,
    res: opts.res,
    user
  };
}

// server/_core/vite.ts
import express from "express";
import fs from "fs";
import { nanoid } from "nanoid";
import path2 from "path";
import { createServer as createViteServer } from "vite";

// vite.config.ts
import { jsxLocPlugin } from "@builder.io/vite-plugin-jsx-loc";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import path from "path";
import { defineConfig } from "vite";
import { vitePluginManusRuntime } from "vite-plugin-manus-runtime";
var plugins = [react(), tailwindcss(), jsxLocPlugin(), vitePluginManusRuntime()];
var vite_config_default = defineConfig({
  plugins,
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "client", "src"),
      "@shared": path.resolve(import.meta.dirname, "shared"),
      "@assets": path.resolve(import.meta.dirname, "attached_assets")
    }
  },
  envDir: path.resolve(import.meta.dirname),
  root: path.resolve(import.meta.dirname, "client"),
  publicDir: path.resolve(import.meta.dirname, "client", "public"),
  build: {
    outDir: path.resolve(import.meta.dirname, "dist/public"),
    emptyOutDir: true
  },
  server: {
    host: true,
    allowedHosts: [
      ".manuspre.computer",
      ".manus.computer",
      ".manus-asia.computer",
      ".manuscomputer.ai",
      ".manusvm.computer",
      "localhost",
      "127.0.0.1"
    ],
    fs: {
      strict: true,
      deny: ["**/.*"]
    }
  }
});

// server/_core/vite.ts
async function setupVite(app, server) {
  const serverOptions = {
    middlewareMode: true,
    hmr: { server },
    allowedHosts: true
  };
  const vite = await createViteServer({
    ...vite_config_default,
    configFile: false,
    server: serverOptions,
    appType: "custom"
  });
  app.use(vite.middlewares);
  app.use("*", async (req, res, next) => {
    const url = req.originalUrl;
    try {
      const clientTemplate = path2.resolve(
        import.meta.dirname,
        "../..",
        "client",
        "index.html"
      );
      let template = await fs.promises.readFile(clientTemplate, "utf-8");
      template = template.replace(
        `src="/src/main.tsx"`,
        `src="/src/main.tsx?v=${nanoid()}"`
      );
      const page = await vite.transformIndexHtml(url, template);
      res.status(200).set({ "Content-Type": "text/html" }).end(page);
    } catch (e) {
      vite.ssrFixStacktrace(e);
      next(e);
    }
  });
}
function serveStatic(app) {
  const distPath = process.env.NODE_ENV === "development" ? path2.resolve(import.meta.dirname, "../..", "dist", "public") : path2.resolve(import.meta.dirname, "public");
  if (!fs.existsSync(distPath)) {
    console.error(
      `Could not find the build directory: ${distPath}, make sure to build the client first`
    );
  }
  app.use(express.static(distPath));
  app.use("*", (_req, res) => {
    res.sendFile(path2.resolve(distPath, "index.html"));
  });
}

// server/_core/index.ts
function isPortAvailable(port) {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.listen(port, () => {
      server.close(() => resolve(true));
    });
    server.on("error", () => resolve(false));
  });
}
async function findAvailablePort(startPort = 3e3) {
  for (let port = startPort; port < startPort + 20; port++) {
    if (await isPortAvailable(port)) {
      return port;
    }
  }
  throw new Error(`No available port found starting from ${startPort}`);
}
async function startServer() {
  const app = express2();
  const server = createServer(app);
  app.use(express2.json({ limit: "50mb" }));
  app.use(express2.urlencoded({ limit: "50mb", extended: true }));
  registerOAuthRoutes(app);
  app.use(
    "/api/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext
    })
  );
  if (process.env.NODE_ENV === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }
  const preferredPort = parseInt(process.env.PORT || "3000");
  const port = await findAvailablePort(preferredPort);
  if (port !== preferredPort) {
    console.log(`Port ${preferredPort} is busy, using port ${port} instead`);
  }
  server.listen(port, () => {
    console.log(`Server running on http://localhost:${port}/`);
  });
}
startServer().catch(console.error);
