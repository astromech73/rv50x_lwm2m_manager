/**
 * LWM2M Server Implementation
 * Handles CoAP communication with RV50X gateways
 */

import coap from "coap";
import { EventEmitter } from "events";
import { getDb, createGateway, getGateway, getGatewayByEndpoint, updateGatewayStatus, createLWM2MObject, createLWM2MResource, recordResourceValue, listPendingCommands, updateCommandStatus } from "./db";

export interface LWM2MMessage {
  type: "register" | "update" | "deregister" | "notify";
  endpoint: string;
  lifetime?: number;
  version?: string;
  binding?: string;
  objects?: Record<string, any>;
}

export interface LWM2MResource {
  id: number;
  name: string;
  type: "variable" | "setting";
  value?: any;
}

export class LWM2MServer extends EventEmitter {
  private coapServer: coap.Server | null = null;
  private port: number;
  private registeredClients: Map<string, { endpoint: string; lastSeen: number }> = new Map();

  constructor(port: number = 5683) {
    super();
    this.port = port;
  }

  /**
   * Start the LWM2M server
   */
  async start(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        this.coapServer = coap.createServer((req, res) => {
          this.handleCoapRequest(req, res);
        });

        this.coapServer.on("error", (error) => {
          console.error("[LWM2M] Server error:", error);
          this.emit("error", error);
        });

        this.coapServer.listen(this.port, () => {
          console.log(`[LWM2M] Server listening on port ${this.port}`);
          resolve();
        });
      } catch (error) {
        console.error("[LWM2M] Failed to start server:", error);
        reject(error);
      }
    });
  }

  /**
   * Stop the LWM2M server
   */
  async stop(): Promise<void> {
    return new Promise((resolve) => {
      if (this.coapServer) {
        this.coapServer.close(() => {
          console.log("[LWM2M] Server stopped");
          resolve();
        });
      } else {
        resolve();
      }
    });
  }

  /**
   * Handle incoming CoAP requests
   */
  private async handleCoapRequest(req: any, res: any): Promise<void> {
    try {
      const path = req.url || "/";
      const method = req.method || "GET";

      console.log(`[LWM2M] ${method} ${path} from ${req.rsinfo?.address}:${req.rsinfo?.port}`);

      // Parse the request path: /rd?ep=<endpoint>&lt=<lifetime>&lwm2m=<version>&b=<binding>
      if (path.startsWith("/rd")) {
        if (method === "POST") {
          await this.handleRegistration(req, res);
        } else if (method === "PUT") {
          await this.handleUpdate(req, res);
        } else if (method === "DELETE") {
          await this.handleDeregistration(req, res);
        } else {
          res.code = "4.04"; // Not Found
          res.end();
        }
      } else {
        // Handle resource requests
        await this.handleResourceRequest(req, res);
      }
    } catch (error) {
      console.error("[LWM2M] Error handling request:", error);
      res.code = "5.00"; // Internal Server Error
      res.end();
    }
  }

  /**
   * Handle client registration
   */
  private async handleRegistration(req: any, res: any): Promise<void> {
    const url = new URL(`coap://localhost${req.url}`);
    const endpoint = url.searchParams.get("ep");
    const lifetime = url.searchParams.get("lt") || "86400";
    const version = url.searchParams.get("lwm2m") || "1.0.0";
    const binding = url.searchParams.get("b") || "U";

    if (!endpoint) {
      res.code = "4.00"; // Bad Request
      res.end();
      return;
    }

    try {
      const remoteAddress = req.rsinfo?.address || "unknown";
      const remotePort = req.rsinfo?.port || 0;

      // Check if gateway already exists
      let gateway = await getGatewayByEndpoint(endpoint);

      if (!gateway) {
        // Create new gateway
        const gatewayId = `gw-${endpoint}-${Date.now()}`;
        gateway = await createGateway({
          id: gatewayId,
          name: endpoint,
          endpoint,
          ipAddress: remoteAddress,
          ownerId: "system", // Will be updated later
          serialNumber: endpoint,
        });
      }

      if (gateway) {
        // Update gateway status
        await updateGatewayStatus(gateway.id, "online", remoteAddress);

        // Store client info
        this.registeredClients.set(endpoint, {
          endpoint,
          lastSeen: Date.now(),
        });

        console.log(`[LWM2M] Client registered: ${endpoint} (v${version}, binding=${binding})`);

        // Send successful response
        res.code = "2.01"; // Created
        res.setOption("Location-Path", `/rd/${gateway.id}`);
        res.end();

        this.emit("client-registered", {
          endpoint,
          gatewayId: gateway.id,
          version,
          binding,
        });
      } else {
        res.code = "5.00"; // Internal Server Error
        res.end();
      }
    } catch (error) {
      console.error("[LWM2M] Registration error:", error);
      res.code = "5.00";
      res.end();
    }
  }

  /**
   * Handle client update (keep-alive)
   */
  private async handleUpdate(req: any, res: any): Promise<void> {
    const path = req.url || "/";
    const pathParts = path.split("/").filter((p: string) => p);

    if (pathParts.length < 2 || pathParts[0] !== "rd") {
      res.code = "4.04";
      res.end();
      return;
    }

    try {
      // Extract endpoint from path or query
      const url = new URL(`coap://localhost${req.url}`);
      const endpoint = url.searchParams.get("ep");

      if (endpoint) {
        const gateway = await getGatewayByEndpoint(endpoint);
        if (gateway) {
          await updateGatewayStatus(gateway.id, "online");
          this.registeredClients.set(endpoint, {
            endpoint,
            lastSeen: Date.now(),
          });

          res.code = "2.04"; // Changed
          res.end();

          this.emit("client-updated", { endpoint });
        } else {
          res.code = "4.04";
          res.end();
        }
      } else {
        res.code = "4.00";
        res.end();
      }
    } catch (error) {
      console.error("[LWM2M] Update error:", error);
      res.code = "5.00";
      res.end();
    }
  }

  /**
   * Handle client deregistration
   */
  private async handleDeregistration(req: any, res: any): Promise<void> {
    try {
      const url = new URL(`coap://localhost${req.url}`);
      const endpoint = url.searchParams.get("ep");

      if (endpoint) {
        const gateway = await getGatewayByEndpoint(endpoint);
        if (gateway) {
          await updateGatewayStatus(gateway.id, "offline");
          this.registeredClients.delete(endpoint);

          res.code = "2.02"; // Deleted
          res.end();

          this.emit("client-deregistered", { endpoint });
        } else {
          res.code = "4.04";
          res.end();
        }
      } else {
        res.code = "4.00";
        res.end();
      }
    } catch (error) {
      console.error("[LWM2M] Deregistration error:", error);
      res.code = "5.00";
      res.end();
    }
  }

  /**
   * Handle resource requests (read/write/observe)
   */
  private async handleResourceRequest(req: any, res: any): Promise<void> {
    const method = req.method || "GET";
    const path = req.url || "/";

    // Parse path: /0/259 (object/resource)
    const pathParts = path.split("/").filter((p: string) => p);

    if (pathParts.length < 2) {
      res.code = "4.04";
      res.end();
      return;
    }

    const objectId = parseInt(pathParts[0]);
    const resourceId = parseInt(pathParts[1]);

    try {
      if (method === "GET") {
        // Read resource
        res.code = "2.05"; // Content
        res.setOption("Content-Format", "text/plain");
        res.end(JSON.stringify({ objectId, resourceId, value: "sample" }));
      } else if (method === "PUT") {
        // Write resource
        const payload = req.payload?.toString() || "";
        console.log(`[LWM2M] Write resource ${objectId}/${resourceId}: ${payload}`);

        res.code = "2.04"; // Changed
        res.end();
      } else {
        res.code = "4.05"; // Method Not Allowed
        res.end();
      }
    } catch (error) {
      console.error("[LWM2M] Resource request error:", error);
      res.code = "5.00";
      res.end();
    }
  }

  /**
   * Get registered clients
   */
  getRegisteredClients(): string[] {
    return Array.from(this.registeredClients.keys());
  }

  /**
   * Check if a client is registered
   */
  isClientRegistered(endpoint: string): boolean {
    return this.registeredClients.has(endpoint);
  }
}

// Global LWM2M server instance
let lwm2mServerInstance: LWM2MServer | null = null;

/**
 * Get or create the LWM2M server instance
 */
export async function getLWM2MServer(): Promise<LWM2MServer> {
  if (!lwm2mServerInstance) {
    lwm2mServerInstance = new LWM2MServer(parseInt(process.env.LWM2M_PORT || "5683", 10));
    await lwm2mServerInstance.start();
  }
  return lwm2mServerInstance;
}

/**
 * Shutdown the LWM2M server
 */
export async function shutdownLWM2MServer(): Promise<void> {
  if (lwm2mServerInstance) {
    await lwm2mServerInstance.stop();
    lwm2mServerInstance = null;
  }
}

