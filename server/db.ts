import { eq, and } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { InsertUser, users, gateways, lwm2mObjects, lwm2mResources, lwm2mResourceValues, lwm2mCommands, Gateway, LWM2MObject, LWM2MResource, LWM2MResourceValue, LWM2MCommand, deviceGroups, configTemplates, alerts, connectivityMetrics, jobs, automationRules, auditLogs, sessions } from "../drizzle/schema";
import { ENV } from './_core/env';

let _db: ReturnType<typeof drizzle> | null = null;

// Lazily create the drizzle instance so local tooling can run without a DB.
export async function getDb() {
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

// ============================================================================
// User Management Functions
// ============================================================================

export async function createUser(user: InsertUser): Promise<any> {
  const db = await getDb();
  if (!db) return null;

  try {
    await db.insert(users).values(user);
    const result = await db.select().from(users).where(eq(users.id, user.id)).limit(1);
    return result[0];
  } catch (error) {
    console.error("[Database] Failed to create user:", error);
    return null;
  }
}

export async function updateUser(id: string, updates: Partial<InsertUser>): Promise<void> {
  const db = await getDb();
  if (!db) return;

  try {
    await db.update(users).set(updates).where(eq(users.id, id));
  } catch (error) {
    console.error("[Database] Failed to update user:", error);
  }
}

export async function getUser(id: string) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get user: database not available");
    return undefined;
  }

  const result = await db.select().from(users).where(eq(users.id, id)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function getUserByUsername(username: string): Promise<any> {
  const db = await getDb();
  if (!db) return null;

  try {
    const result = await db.select().from(users).where(eq(users.username, username)).limit(1);
    return result.length > 0 ? result[0] : null;
  } catch (error) {
    console.error("[Database] Failed to get user by username:", error);
    return null;
  }
}

export async function listUsers(): Promise<any[]> {
  const db = await getDb();
  if (!db) return [];

  try {
    return await db.select().from(users).where(eq(users.isActive, true));
  } catch (error) {
    console.error("[Database] Failed to list users:", error);
    return [];
  }
}

export async function deactivateUser(id: string): Promise<void> {
  const db = await getDb();
  if (!db) return;

  try {
    await db.update(users).set({ isActive: false }).where(eq(users.id, id));
  } catch (error) {
    console.error("[Database] Failed to deactivate user:", error);
  }
}

// ============================================================================
// Session Management Functions
// ============================================================================

export async function createSession(session: any): Promise<any> {
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

export async function getSession(sessionId: string): Promise<any> {
  const db = await getDb();
  if (!db) return null;

  try {
    const result = await db.select().from(sessions).where(eq(sessions.id, sessionId)).limit(1);
    return result.length > 0 ? result[0] : null;
  } catch (error) {
    console.error("[Database] Failed to get session:", error);
    return null;
  }
}

export async function deleteSession(sessionId: string): Promise<void> {
  const db = await getDb();
  if (!db) return;

  try {
    // Note: Drizzle delete is handled via raw SQL
    const sql = `DELETE FROM sessions WHERE id = '${sessionId}'`;
    await db.execute(sql);
  } catch (error) {
    console.error("[Database] Failed to delete session:", error);
  }
}

export async function updateSessionActivity(sessionId: string): Promise<void> {
  const db = await getDb();
  if (!db) return;

  try {
    await db.update(sessions).set({ lastActivityAt: new Date() }).where(eq(sessions.id, sessionId));
  } catch (error) {
    console.error("[Database] Failed to update session activity:", error);
  }
}

// ============================================================================
// LWM2M Gateway Functions
// ============================================================================

export async function createGateway(gateway: {
  id: string;
  name: string;
  endpoint: string;
  ipAddress?: string;
  ownerId: string;
  serialNumber?: string;
}): Promise<Gateway | null> {
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

export async function listGatewaysByOwner(ownerId: string): Promise<Gateway[]> {
  const db = await getDb();
  if (!db) return [];

  try {
    return await db.select().from(gateways).where(eq(gateways.ownerId, ownerId));
  } catch (error) {
    console.error("[Database] Failed to list gateways:", error);
    return [];
  }
}

export async function getGateway(id: string): Promise<Gateway | null> {
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

export async function updateGatewayStatus(id: string, status: "online" | "offline" | "error", ipAddress?: string): Promise<void> {
  const db = await getDb();
  if (!db) return;

  try {
    const updates: any = {
      status,
      lastSeen: new Date(),
    };
    if (ipAddress) {
      updates.ipAddress = ipAddress;
    }
    await db.update(gateways).set(updates).where(eq(gateways.id, id));
  } catch (error) {
    console.error("[Database] Failed to update gateway status:", error);
  }
}

// ============================================================================
// LWM2M Objects Functions
// ============================================================================

export async function createLWM2MObject(object: {
  id: string;
  gatewayId: string;
  objectId: number;
  objectName: string;
  description?: string;
}): Promise<any | null> {
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

export async function listLWM2MObjects(gatewayId: string): Promise<LWM2MObject[]> {
  const db = await getDb();
  if (!db) return [];

  try {
    return await db.select().from(lwm2mObjects).where(eq(lwm2mObjects.gatewayId, gatewayId));
  } catch (error) {
    console.error("[Database] Failed to list LWM2M objects:", error);
    return [];
  }
}

// ============================================================================
// LWM2M Resources Functions
// ============================================================================

export async function createLWM2MResource(resource: {
  id: string;
  objectId: string;
  resourceId: number;
  resourceName: string;
  resourceType: "variable" | "setting";
  dataType?: string;
  description?: string;
}): Promise<any | null> {
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

export async function listLWM2MResources(objectId: string): Promise<LWM2MResource[]> {
  const db = await getDb();
  if (!db) return [];

  try {
    return await db.select().from(lwm2mResources).where(eq(lwm2mResources.objectId, objectId));
  } catch (error) {
    console.error("[Database] Failed to list LWM2M resources:", error);
    return [];
  }
}

// ============================================================================
// LWM2M Resource Values Functions
// ============================================================================

export async function recordResourceValue(value: {
  id: string;
  resourceId: string;
  gatewayId: string;
  value: string;
  timestamp?: Date;
}): Promise<any | null> {
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

export async function getLatestResourceValue(resourceId: string): Promise<LWM2MResourceValue | null> {
  const db = await getDb();
  if (!db) return null;

  try {
    const result = await db
      .select()
      .from(lwm2mResourceValues)
      .where(eq(lwm2mResourceValues.resourceId, resourceId))
      .orderBy((t) => t.timestamp)
      .limit(1);
    return result.length > 0 ? result[0] : null;
  } catch (error) {
    console.error("[Database] Failed to get latest resource value:", error);
    return null;
  }
}

// ============================================================================
// LWM2M Commands Functions
// ============================================================================

export async function createCommand(command: {
  id: string;
  gatewayId: string;
  resourceId: string;
  commandType: "read" | "write" | "execute";
  value?: string;
  status?: "pending" | "sent" | "success" | "failed";
}): Promise<any | null> {
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

export async function getCommand(id: string): Promise<LWM2MCommand | null> {
  const db = await getDb();
  if (!db) return null;

  const result = await db.select().from(lwm2mCommands).where(eq(lwm2mCommands.id, id)).limit(1);
  return result.length > 0 ? result[0] : null;
}

export async function updateCommandStatus(id: string, status: "pending" | "sent" | "success" | "failed", error?: string): Promise<void> {
  const db = await getDb();
  if (!db) return;

  try {
    const updates: Record<string, any> = {
      status,
    };

    if (error) {
      updates.error = error;
    }

    if (status === "success" || status === "failed") {
      updates.completedAt = new Date();
    }

    await db.update(lwm2mCommands).set(updates).where(eq(lwm2mCommands.id, id));
  } catch (error) {
    console.error("[Database] Failed to update command status:", error);
  }
}

export async function listPendingCommands(gatewayId: string): Promise<LWM2MCommand[]> {
  const db = await getDb();
  if (!db) return [];

  return db.select().from(lwm2mCommands).where(and(eq(lwm2mCommands.gatewayId, gatewayId), eq(lwm2mCommands.status, "pending")));
}

// ============================================================================
// Device Groups Functions
// ============================================================================

export async function createDeviceGroup(group: {
  id: string;
  name: string;
  description?: string;
  ownerId: string;
}): Promise<any> {
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

export async function listDeviceGroups(ownerId: string): Promise<any[]> {
  const db = await getDb();
  if (!db) return [];

  try {
    return await db.select().from(deviceGroups).where(eq(deviceGroups.ownerId, ownerId));
  } catch (error) {
    console.error("[Database] Failed to list device groups:", error);
    return [];
  }
}

// ============================================================================
// Configuration Templates Functions
// ============================================================================

export async function createConfigTemplate(template: {
  id: string;
  name: string;
  description?: string;
  ownerId: string;
  config: any;
}): Promise<any> {
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

export async function listConfigTemplates(ownerId: string): Promise<any[]> {
  const db = await getDb();
  if (!db) return [];

  try {
    return await db.select().from(configTemplates).where(eq(configTemplates.ownerId, ownerId));
  } catch (error) {
    console.error("[Database] Failed to list config templates:", error);
    return [];
  }
}

// ============================================================================
// Alerts Functions
// ============================================================================

export async function createAlert(alert: {
  id: string;
  gatewayId: string;
  alertType: "offline" | "low_signal" | "high_error_rate" | "firmware_mismatch" | "sim_change" | "connectivity_lost" | "custom";
  severity: "info" | "warning" | "critical";
  message: string;
}): Promise<any> {
  const db = await getDb();
  if (!db) return null;

  try {
    await db.insert(alerts).values(alert);
    const result = await db.select().from(alerts).where(eq(alerts.id, alert.id)).limit(1);
    return result[0];
  } catch (error) {
    console.error("[Database] Failed to create alert:", error);
    return null;
  }
}

export async function listAlerts(gatewayId?: string, unresolved: boolean = false): Promise<any[]> {
  const db = await getDb();
  if (!db) return [];

  try {
    let conditions = [];
    if (gatewayId) conditions.push(eq(alerts.gatewayId, gatewayId));
    if (unresolved) conditions.push(eq(alerts.isResolved, false));
    
    const query = conditions.length > 0 
      ? db.select().from(alerts).where(and(...conditions))
      : db.select().from(alerts);
    
    return await query;
  } catch (error) {
    console.error("[Database] Failed to list alerts:", error);
    return [];
  }
}

export async function resolveAlert(alertId: string): Promise<void> {
  const db = await getDb();
  if (!db) return;

  try {
    await db.update(alerts).set({
      isResolved: true,
      resolvedAt: new Date(),
    }).where(eq(alerts.id, alertId));
  } catch (error) {
    console.error("[Database] Failed to resolve alert:", error);
  }
}

// ============================================================================
// Connectivity Metrics Functions
// ============================================================================

export async function recordConnectivityMetrics(metrics: {
  id: string;
  gatewayId: string;
  signalStrength?: number | null;
  signalQuality?: number | null;
  cellularTechnology?: string | null;
  activeSim?: number | null;
  ipv4Address?: string | null;
  ipv6Address?: string | null;
  uptime?: number | null;
  errorRate?: string | null;
}): Promise<any> {
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

export async function getLatestMetrics(gatewayId: string): Promise<any> {
  const db = await getDb();
  if (!db) return null;

  try {
    const result = await db
      .select()
      .from(connectivityMetrics)
      .where(eq(connectivityMetrics.gatewayId, gatewayId))
      .orderBy((t) => t.timestamp)
      .limit(1);
    return result.length > 0 ? result[0] : null;
  } catch (error) {
    console.error("[Database] Failed to get latest metrics:", error);
    return null;
  }
}

// ============================================================================
// Jobs Functions
// ============================================================================

export async function createJob(job: {
  id: string;
  name: string;
  description?: string;
  ownerId: string;
  jobType: "command" | "configuration" | "firmware_update" | "reboot" | "custom";
  targetType: "single" | "group" | "all";
  targetId?: string;
  schedule?: string;
  payload?: any;
}): Promise<any> {
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

export async function listJobs(ownerId: string): Promise<any[]> {
  const db = await getDb();
  if (!db) return [];

  try {
    return await db.select().from(jobs).where(eq(jobs.ownerId, ownerId));
  } catch (error) {
    console.error("[Database] Failed to list jobs:", error);
    return [];
  }
}

// ============================================================================
// Automation Rules Functions
// ============================================================================

export async function createAutomationRule(rule: {
  id: string;
  name: string;
  description?: string;
  ownerId: string;
  conditions: any;
  actions: any;
}): Promise<any> {
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

export async function listAutomationRules(ownerId: string): Promise<any[]> {
  const db = await getDb();
  if (!db) return [];

  try {
    return await db.select().from(automationRules).where(eq(automationRules.ownerId, ownerId));
  } catch (error) {
    console.error("[Database] Failed to list automation rules:", error);
    return [];
  }
}

// ============================================================================
// Audit Logs Functions
// ============================================================================

export async function createAuditLog(log: {
  id: string;
  userId: string;
  action: string;
  resourceType: string;
  resourceId?: string;
  details?: any;
}): Promise<void> {
  const db = await getDb();
  if (!db) return;

  try {
    await db.insert(auditLogs).values(log);
  } catch (error) {
    console.error("[Database] Failed to create audit log:", error);
  }
}

export async function listAuditLogs(userId?: string, limit: number = 100): Promise<any[]> {
  const db = await getDb();
  if (!db) return [];

  try {
    const query = userId 
      ? db.select().from(auditLogs).where(eq(auditLogs.userId, userId)).orderBy((t) => t.createdAt).limit(limit)
      : db.select().from(auditLogs).orderBy((t) => t.createdAt).limit(limit);
    
    return await query;
  } catch (error) {
    console.error("[Database] Failed to list audit logs:", error);
    return [];
  }
}



export async function getGatewayByEndpoint(endpoint: string): Promise<any> {
  const db = await getDb();
  if (!db) return null;

  try {
    const result = await db.select().from(gateways).where(eq(gateways.endpoint, endpoint)).limit(1);
    return result.length > 0 ? result[0] : null;
  } catch (error) {
    console.error("[Database] Failed to get gateway by endpoint:", error);
    return null;
  }
}

