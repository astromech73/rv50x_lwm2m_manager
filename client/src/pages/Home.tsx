import { trpc } from "@/lib/trpc";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AlertCircle, Wifi, WifiOff, Activity, Clock } from "lucide-react";
import { Link } from "wouter";

export default function Home() {
  const { data: gateways, isLoading: gatewaysLoading } = trpc.gateways.list.useQuery();

  const onlineCount = gateways?.filter((g) => g.status === "online").length || 0;
  const offlineCount = gateways?.filter((g) => g.status === "offline").length || 0;
  const errorCount = gateways?.filter((g) => g.status === "error").length || 0;

  const stats = [
    {
      label: "Total Gateways",
      value: gateways?.length || 0,
      icon: Activity,
      color: "text-blue-600",
    },
    {
      label: "Online",
      value: onlineCount,
      icon: Wifi,
      color: "text-green-600",
    },
    {
      label: "Offline",
      value: offlineCount,
      icon: WifiOff,
      color: "text-gray-600",
    },
    {
      label: "Errors",
      value: errorCount,
      icon: AlertCircle,
      color: "text-red-600",
    },
  ];

  return (
    <DashboardLayout>
      <div className="space-y-8">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground mt-2">
            Welcome to your LWM2M Gateway Management System
          </p>
        </div>

        {/* Stats Grid */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {stats.map((stat, index) => {
            const Icon = stat.icon;
            return (
              <Card key={index}>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">{stat.label}</CardTitle>
                  <Icon className={`h-4 w-4 ${stat.color}`} />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{stat.value}</div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Recent Gateways */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold">Recent Gateways</h2>
            <Link href="/gateways">
              <a className="text-sm text-primary hover:underline">View all</a>
            </Link>
          </div>

          {gatewaysLoading ? (
            <div className="space-y-2">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-20 bg-muted rounded animate-pulse"></div>
              ))}
            </div>
          ) : gateways && gateways.length > 0 ? (
            <div className="space-y-2">
              {gateways.slice(0, 5).map((gateway) => (
                <Card key={gateway.id} className="hover:shadow-md transition-shadow">
                  <CardContent className="flex items-center justify-between py-4">
                    <div className="flex items-center gap-4 flex-1">
                      <div className={`h-3 w-3 rounded-full ${gateway.status === "online" ? "bg-green-500" : gateway.status === "offline" ? "bg-gray-400" : "bg-red-500"}`}></div>
                      <div className="flex-1">
                        <p className="font-medium">{gateway.name}</p>
                        <p className="text-xs text-muted-foreground">{gateway.endpoint}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <Badge variant="outline">{gateway.status}</Badge>
                      {gateway.lastSeen && (
                        <div className="text-xs text-muted-foreground flex items-center gap-1">
                          <Clock size={12} />
                          {new Date(gateway.lastSeen).toLocaleTimeString()}
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <Card className="border-dashed">
              <CardContent className="flex flex-col items-center justify-center py-12">
                <AlertCircle className="h-12 w-12 text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold mb-2">No Gateways Yet</h3>
                <p className="text-muted-foreground text-center mb-4">
                  Get started by adding your first gateway
                </p>
                <Link href="/gateways">
                  <a>
                    <Button>Add Gateway</Button>
                  </a>
                </Link>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Quick Start Guide */}
        <Card>
          <CardHeader>
            <CardTitle>Quick Start Guide</CardTitle>
            <CardDescription>
              Get your LWM2M gateways up and running
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-3">
              <div className="flex gap-4">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground text-sm font-semibold">
                  1
                </div>
                <div>
                  <p className="font-medium">Register Your Gateway</p>
                  <p className="text-sm text-muted-foreground">
                    Go to the Gateways page and add your RV50X device endpoint
                  </p>
                </div>
              </div>
              <div className="flex gap-4">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground text-sm font-semibold">
                  2
                </div>
                <div>
                  <p className="font-medium">Configure LWM2M</p>
                  <p className="text-sm text-muted-foreground">
                    Set up your gateway to connect to this server using the LWM2M protocol
                  </p>
                </div>
              </div>
              <div className="flex gap-4">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground text-sm font-semibold">
                  3
                </div>
                <div>
                  <p className="font-medium">Monitor & Control</p>
                  <p className="text-sm text-muted-foreground">
                    View real-time data and send commands to your gateways
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}

