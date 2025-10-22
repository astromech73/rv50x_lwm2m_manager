import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, protectedProcedure, router } from "./_core/trpc";
import { z } from "zod";
import * as db from "./db";
import * as auth from "./auth";
import { TRPCError } from "@trpc/server";

export const appRouter = router({
  system: systemRouter,

  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    
    login: publicProcedure
      .input(z.object({ username: z.string(), password: z.string() }))
      .mutation(async ({ input, ctx }) => {
        const user = await auth.authenticateUser(input.username, input.password);
        if (!user) {
          throw new TRPCError({ code: "UNAUTHORIZED", message: "Invalid credentials" });
        }
        const sessionId = await auth.createNewSession(user.id);
        if (!sessionId) {
          throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Failed to create session" });
        }
        const cookieOptions = getSessionCookieOptions(ctx.req);
        ctx.res.cookie(COOKIE_NAME, sessionId, { ...cookieOptions, maxAge: 7 * 24 * 60 * 60 * 1000 });
        return { success: true, user };
      }),

    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),

    changePassword: protectedProcedure
      .input(z.object({ currentPassword: z.string(), newPassword: z.string() }))
      .mutation(async ({ input, ctx }) => {
        const success = await auth.changePassword(ctx.user.id, input.currentPassword, input.newPassword);
        if (!success) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Invalid current password" });
        }
        return { success: true };
      }),
  }),

  // ============================================================================
  // Gateway Management
  // ============================================================================
  gateways: router({
    /**
     * List all gateways for the current user
     */
    list: protectedProcedure.query(async ({ ctx }) => {
      return db.listGatewaysByOwner(ctx.user.id);
    }),

    /**
     * Get a specific gateway
     */
    get: protectedProcedure
      .input(z.object({ id: z.string() }))
      .query(async ({ input }) => {
        const gateway = await db.getGateway(input.id);
        if (!gateway) {
          throw new TRPCError({ code: "NOT_FOUND" });
        }
        return gateway;
      }),

    /**
     * Create a new gateway
     */
    create: protectedProcedure
      .input(
        z.object({
          name: z.string().min(1),
          endpoint: z.string().min(1),
          ipAddress: z.string().optional(),
          serialNumber: z.string().optional(),
        })
      )
      .mutation(async ({ input, ctx }) => {
        const gatewayId = `gw-${input.endpoint}-${Date.now()}`;
        const gateway = await db.createGateway({
          id: gatewayId,
          name: input.name,
          endpoint: input.endpoint,
          ipAddress: input.ipAddress,
          ownerId: ctx.user.id,
          serialNumber: input.serialNumber,
        });

        if (!gateway) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Failed to create gateway",
          });
        }

        return gateway;
      }),

    /**
     * Update gateway status
     */
    updateStatus: protectedProcedure
      .input(
        z.object({
          id: z.string(),
          status: z.enum(["online", "offline", "error"]),
          ipAddress: z.string().optional(),
        })
      )
      .mutation(async ({ input }) => {
        await db.updateGatewayStatus(input.id, input.status, input.ipAddress);
        return { success: true };
      }),
  }),

  // ============================================================================
  // LWM2M Objects Management
  // ============================================================================
  objects: router({
    /**
     * List objects for a gateway
     */
    listByGateway: protectedProcedure
      .input(z.object({ gatewayId: z.string() }))
      .query(async ({ input }) => {
        return db.listLWM2MObjects(input.gatewayId);
      }),

    /**
     * Create or update an LWM2M object
     */
    createOrUpdate: protectedProcedure
      .input(
        z.object({
          id: z.string(),
          gatewayId: z.string(),
          objectId: z.number(),
          objectName: z.string(),
          description: z.string().optional(),
        })
      )
      .mutation(async ({ input }) => {
        const object = await db.createLWM2MObject({
          id: input.id,
          gatewayId: input.gatewayId,
          objectId: input.objectId,
          objectName: input.objectName,
          description: input.description
        });
        if (!object) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
          message: "Failed to create/update object",
        });
        }
        return object;
      }),
  }),

  // ============================================================================
  // LWM2M Resources Management
  // ============================================================================
  resources: router({
    /**
     * List resources for an object
     */
    listByObject: protectedProcedure
      .input(z.object({ objectId: z.string() }))
      .query(async ({ input }) => {
        return db.listLWM2MResources(input.objectId);
      }),

    /**
     * Create or update an LWM2M resource
     */
    createOrUpdate: protectedProcedure
      .input(
        z.object({
          id: z.string(),
          objectId: z.string(),
          resourceId: z.number(),
          resourceName: z.string(),
          resourceType: z.enum(["variable", "setting"]),
          dataType: z.string().optional(),
          description: z.string().optional(),
          constraints: z.any().optional(),
        })
      )
      .mutation(async ({ input }) => {
        const resource = await db.createLWM2MResource({
          id: input.id,
          objectId: input.objectId,
          resourceId: input.resourceId,
          resourceName: input.resourceName,
          resourceType: input.resourceType,
          dataType: input.dataType,
          description: input.description
        });
        if (!resource) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Failed to create/update resource",
          });
        }
        return resource;
      }),

    /**
     * Get the latest value for a resource
     */
    getValue: protectedProcedure
      .input(z.object({ resourceId: z.string(), gatewayId: z.string() }))
      .query(async ({ input }) => {
        return db.getLatestResourceValue(input.resourceId);
      }),

    /**
     * Set a resource value
     */
    setValue: protectedProcedure
      .input(z.object({ resourceId: z.string(), gatewayId: z.string(), value: z.string() }))
      .mutation(async ({ input }) => {
        const result = await db.recordResourceValue({ id: `${input.resourceId}-${Date.now()}`, resourceId: input.resourceId, gatewayId: input.gatewayId, value: input.value });
        if (!result) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Failed to set resource value",
          });
        }
        return result;
      }),
  }),

  // ============================================================================
  // LWM2M Commands Management
  // ============================================================================
  commands: router({
    /**
     * Create a new command
     */
    create: protectedProcedure
      .input(
        z.object({
          gatewayId: z.string(),
          resourceId: z.string(),
          commandType: z.enum(["read", "write", "execute"]),
          value: z.string().optional(),
        })
      )
      .mutation(async ({ input }) => {
        const commandId = `cmd-${input.gatewayId}-${input.resourceId}-${Date.now()}`;
        const command = await db.createCommand({
          id: commandId,
          ...input,
        });

        if (!command) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Failed to create command",
          });
        }

        return command;
      }),

    /**
     * Get a command
     */
    get: protectedProcedure
      .input(z.object({ id: z.string() }))
      .query(async ({ input }) => {
        const command = await db.getCommand(input.id);
        if (!command) {
          throw new TRPCError({ code: "NOT_FOUND" });
        }
        return command;
      }),

    /**
     * List pending commands for a gateway
     */
    listPending: protectedProcedure
      .input(z.object({ gatewayId: z.string() }))
      .query(async ({ input }) => {
        return db.listPendingCommands(input.gatewayId);
      }),

    /**
     * Update command status
     */
    updateStatus: protectedProcedure
      .input(
        z.object({
          id: z.string(),
          status: z.enum(["pending", "sent", "success", "failed"]),
          error: z.string().optional(),
        })
      )
      .mutation(async ({ input }) => {
        await db.updateCommandStatus(input.id, input.status, input.error);
        return { success: true };
      }),
  }),

  // ============================================================================
  // Device Groups Management
  // ============================================================================
  deviceGroups: router({
    list: protectedProcedure.query(async ({ ctx }) => {
      return db.listDeviceGroups(ctx.user.id);
    }),

    create: protectedProcedure
      .input(
        z.object({
          name: z.string().min(1),
          description: z.string().optional(),
        })
      )
      .mutation(async ({ input, ctx }) => {
        const groupId = `grp-${Date.now()}`;
        const group = await db.createDeviceGroup({
          id: groupId,
          name: input.name,
          description: input.description,
          ownerId: ctx.user.id,
        });
        return group;
      }),
  }),

  // ============================================================================
  // Configuration Management
  // ============================================================================
  configurations: router({
    listTemplates: protectedProcedure.query(async ({ ctx }) => {
      return db.listConfigTemplates(ctx.user.id);
    }),

    createTemplate: protectedProcedure
      .input(
        z.object({
          name: z.string().min(1),
          description: z.string().optional(),
          config: z.record(z.string(), z.any()),
        })
      )
      .mutation(async ({ input, ctx }) => {
        const templateId = `tpl-${Date.now()}`;
        const template = await db.createConfigTemplate({
          id: templateId,
          name: input.name,
          description: input.description,
          ownerId: ctx.user.id,
          config: input.config,
        });
        return template;
      }),

    deployToGateway: protectedProcedure
      .input(
        z.object({
          templateId: z.string(),
          gatewayId: z.string(),
        })
      )
      .mutation(async ({ input }) => {
        const deploymentId = `dep-${Date.now()}`;
        // TODO: Implement actual deployment logic
        return { id: deploymentId, status: "pending" };
      }),
  }),

  // ============================================================================
  // Alerts & Monitoring
  // ============================================================================
  alerts: router({
    list: protectedProcedure
      .input(
        z.object({
          gatewayId: z.string().optional(),
          unresolved: z.boolean().optional(),
        })
      )
      .query(async ({ input }) => {
        return db.listAlerts(input.gatewayId, input.unresolved);
      }),

    resolve: protectedProcedure
      .input(z.object({ id: z.string() }))
      .mutation(async ({ input }) => {
        await db.resolveAlert(input.id);
        return { success: true };
      }),
  }),

  // ============================================================================
  // Connectivity Metrics
  // ============================================================================
  metrics: router({
    getLatest: protectedProcedure
      .input(z.object({ gatewayId: z.string() }))
      .query(async ({ input }) => {
        return db.getLatestMetrics(input.gatewayId);
      }),

    record: protectedProcedure
      .input(
        z.object({
          gatewayId: z.string(),
          signalStrength: z.number().optional(),
          signalQuality: z.number().optional(),
          cellularTechnology: z.string().optional(),
          activeSim: z.number().optional(),
          ipv4Address: z.string().optional(),
          ipv6Address: z.string().optional(),
          uptime: z.number().optional(),
          errorRate: z.string().optional(),
        })
      )
      .mutation(async ({ input }) => {
        const metricId = `met-${Date.now()}`;
        const metric = await db.recordConnectivityMetrics({
          id: metricId,
          ...input,
        });
        return metric;
      }),
  }),

  // ============================================================================
  // Jobs & Automation
  // ============================================================================
  jobs: router({
    list: protectedProcedure.query(async ({ ctx }) => {
      return db.listJobs(ctx.user.id);
    }),

    create: protectedProcedure
      .input(
        z.object({
          name: z.string().min(1),
          description: z.string().optional(),
          jobType: z.enum(["command", "configuration", "firmware_update", "reboot", "custom"]),
          targetType: z.enum(["single", "group", "all"]),
          targetId: z.string().optional(),
          schedule: z.string().optional(),
          payload: z.record(z.string(), z.any()).optional(),
        })
      )
      .mutation(async ({ input, ctx }) => {
        const jobId = `job-${Date.now()}`;
        const job = await db.createJob({
          id: jobId,
          name: input.name,
          description: input.description,
          ownerId: ctx.user.id,
          jobType: input.jobType,
          targetType: input.targetType,
          targetId: input.targetId,
          schedule: input.schedule,
          payload: input.payload,
        });
        return job;
      }),
  }),

  // ============================================================================
  // Automation Rules
  // ============================================================================
  automation: router({
    listRules: protectedProcedure.query(async ({ ctx }) => {
      return db.listAutomationRules(ctx.user.id);
    }),

    createRule: protectedProcedure
      .input(
        z.object({
          name: z.string().min(1),
          description: z.string().optional(),
          conditions: z.record(z.string(), z.any()),
          actions: z.record(z.string(), z.any()),
        })
      )
      .mutation(async ({ input, ctx }) => {
        const ruleId = `rule-${Date.now()}`;
        const rule = await db.createAutomationRule({
          id: ruleId,
          name: input.name,
          description: input.description,
          ownerId: ctx.user.id,
          conditions: input.conditions,
          actions: input.actions,
        });
        return rule;
      }),
  }),

  // ============================================================================
  // Audit Logs
  // ============================================================================
  audit: router({
    listLogs: protectedProcedure
      .input(
        z.object({
          limit: z.number().optional(),
        })
      )
      .query(async ({ input, ctx }) => {
        return db.listAuditLogs(ctx.user.id, input.limit);
      }),
  }),
});

export type AppRouter = typeof appRouter;

