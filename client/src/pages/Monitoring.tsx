import { useState } from "react";
import { trpc } from "@/lib/trpc";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertTriangle, Signal, Wifi, Activity, TrendingUp, TrendingDown } from "lucide-react";

export default function Monitoring() {
  const { data: gateways } = trpc.gateways.list.useQuery();
  const { data: alerts } = trpc.alerts.list.useQuery({});
  const [selectedGateway, setSelectedGateway] = useState<string | null>(null);

  const selectedGatewayData = gateways?.find(g => g.id === selectedGateway);
  const { data: metrics } = trpc.metrics.getLatest.useQuery(
    { gatewayId: selectedGateway || "" },
    { enabled: !!selectedGateway }
  );

  const criticalAlerts = alerts?.filter(a => a.severity === "critical") || [];
  const warningAlerts = alerts?.filter(a => a.severity === "warning") || [];

  const getSignalBars = (strength?: number) => {
    if (!strength) return "N/A";
    if (strength >= -50) return "⚫⚫⚫⚫⚫ Excellent";
    if (strength >= -70) return "⚫⚫⚫⚫ Good";
    if (strength >= -85) return "⚫⚫⚫ Fair";
    if (strength >= -100) return "⚫⚫ Weak";
    return "⚫ Poor";
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Monitoring & Analytics</h1>
          <p className="text-muted-foreground mt-2">
            Real-time connectivity and performance metrics
          </p>
        </div>

        {/* Alert Summary */}
        {(criticalAlerts.length > 0 || warningAlerts.length > 0) && (
          <div className="grid gap-4 md:grid-cols-2">
            {criticalAlerts.length > 0 && (
              <Alert className="border-red-200 bg-red-50">
                <AlertTriangle className="h-4 w-4 text-red-600" />
                <AlertDescription className="text-red-800">
                  <strong>{criticalAlerts.length} Critical Alert{criticalAlerts.length !== 1 ? 's' : ''}</strong>
                  <p className="text-sm mt-1">{criticalAlerts[0]?.message}</p>
                </AlertDescription>
              </Alert>
            )}
            {warningAlerts.length > 0 && (
              <Alert className="border-yellow-200 bg-yellow-50">
                <AlertTriangle className="h-4 w-4 text-yellow-600" />
                <AlertDescription className="text-yellow-800">
                  <strong>{warningAlerts.length} Warning{warningAlerts.length !== 1 ? 's' : ''}</strong>
                  <p className="text-sm mt-1">{warningAlerts[0]?.message}</p>
                </AlertDescription>
              </Alert>
            )}
          </div>
        )}

        {/* Gateway Selection */}
        <Card>
          <CardHeader>
            <CardTitle>Select Gateway</CardTitle>
            <CardDescription>Choose a gateway to view detailed metrics</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-2 md:grid-cols-2 lg:grid-cols-3">
              {gateways?.map((gateway) => (
                <Button
                  key={gateway.id}
                  variant={selectedGateway === gateway.id ? "default" : "outline"}
                  className="justify-start"
                  onClick={() => setSelectedGateway(gateway.id)}
                >
                  <Wifi size={16} className="mr-2" />
                  <div className="text-left">
                    <div className="font-medium">{gateway.name}</div>
                    <div className="text-xs opacity-70">
                      {gateway.status === "online" ? "🟢 Online" : "🔴 Offline"}
                    </div>
                  </div>
                </Button>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Detailed Metrics */}
        {selectedGatewayData && metrics && (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {/* Signal Strength */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Signal Strength</CardTitle>
                <Signal className="h-4 w-4 text-blue-600" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{metrics.signalStrength || "N/A"} dBm</div>
                <p className="text-xs text-muted-foreground mt-2">{getSignalBars(metrics.signalStrength)}</p>
              </CardContent>
            </Card>

            {/* Signal Quality */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Signal Quality</CardTitle>
                <Activity className="h-4 w-4 text-green-600" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{metrics.signalQuality || "N/A"}%</div>
                <p className="text-xs text-muted-foreground mt-2">
                  {metrics.signalQuality && metrics.signalQuality >= 75 ? "Excellent" : "Good"}
                </p>
              </CardContent>
            </Card>

            {/* Cellular Technology */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Technology</CardTitle>
                <Wifi className="h-4 w-4 text-purple-600" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{metrics.cellularTechnology || "N/A"}</div>
                <p className="text-xs text-muted-foreground mt-2">Active Connection</p>
              </CardContent>
            </Card>

            {/* Uptime */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Uptime</CardTitle>
                <TrendingUp className="h-4 w-4 text-green-600" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {metrics.uptime ? `${Math.floor(metrics.uptime / 86400)}d` : "N/A"}
                </div>
                <p className="text-xs text-muted-foreground mt-2">
                  {metrics.uptime ? `${Math.floor((metrics.uptime % 86400) / 3600)}h` : "Unknown"}
                </p>
              </CardContent>
            </Card>

            {/* Error Rate */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Error Rate</CardTitle>
                <TrendingDown className="h-4 w-4 text-red-600" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{metrics.errorRate || "0"}%</div>
                <p className="text-xs text-muted-foreground mt-2">
                  {metrics.errorRate && parseFloat(metrics.errorRate) > 5 ? "⚠️ High" : "✓ Normal"}
                </p>
              </CardContent>
            </Card>

            {/* Active SIM */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Active SIM</CardTitle>
                <Badge>SIM {metrics.activeSim || "N/A"}</Badge>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">SIM {metrics.activeSim || "—"}</div>
                <p className="text-xs text-muted-foreground mt-2">Primary Connection</p>
              </CardContent>
            </Card>
          </div>
        )}

        {/* IP Addresses */}
        {selectedGatewayData && metrics && (
          <Card>
            <CardHeader>
              <CardTitle>Network Configuration</CardTitle>
              <CardDescription>Current IP addresses and connectivity</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-2">
              <div>
                <p className="text-sm font-medium text-muted-foreground">IPv4 Address</p>
                <p className="font-mono text-lg">{metrics.ipv4Address || "Not assigned"}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">IPv6 Address</p>
                <p className="font-mono text-lg break-all">{metrics.ipv6Address || "Not assigned"}</p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Recent Alerts */}
        {alerts && alerts.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Recent Alerts</CardTitle>
              <CardDescription>Latest system alerts and notifications</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {alerts.slice(0, 5).map((alert) => (
                  <div key={alert.id} className="flex items-start justify-between p-3 border rounded-lg">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <Badge
                          variant={
                            alert.severity === "critical"
                              ? "destructive"
                              : alert.severity === "warning"
                              ? "secondary"
                              : "outline"
                          }
                        >
                          {alert.severity}
                        </Badge>
                        <span className="font-medium">{alert.alertType}</span>
                      </div>
                      <p className="text-sm text-muted-foreground mt-1">{alert.message}</p>
                    </div>
                    {!alert.isResolved && (
                      <Button size="sm" variant="ghost">
                        Resolve
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
}

