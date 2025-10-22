import { useState } from "react";
import { trpc } from "@/lib/trpc";
import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { AlertCircle, Plus, RefreshCw, Wifi, WifiOff } from "lucide-react";

export default function Gateways() {
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    endpoint: "",
    ipAddress: "",
    serialNumber: "",
  });

  const { data: gateways, isLoading, refetch } = trpc.gateways.list.useQuery();
  const createGateway = trpc.gateways.create.useMutation({
    onSuccess: () => {
      setFormData({ name: "", endpoint: "", ipAddress: "", serialNumber: "" });
      setIsCreateOpen(false);
      refetch();
    },
  });

  const handleCreateGateway = async (e: React.FormEvent) => {
    e.preventDefault();
    createGateway.mutate(formData);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "online":
        return "bg-green-100 text-green-800";
      case "offline":
        return "bg-gray-100 text-gray-800";
      case "error":
        return "bg-red-100 text-red-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  const getStatusIcon = (status: string) => {
    return status === "online" ? <Wifi size={16} /> : <WifiOff size={16} />;
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Gateways</h1>
            <p className="text-muted-foreground mt-2">
              Manage your Sierra Wireless RV50X gateways
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => refetch()}>
              <RefreshCw size={16} className="mr-2" />
              Refresh
            </Button>
            <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
              <DialogTrigger asChild>
                <Button size="sm">
                  <Plus size={16} className="mr-2" />
                  Add Gateway
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Add New Gateway</DialogTitle>
                  <DialogDescription>
                    Register a new LWM2M gateway endpoint
                  </DialogDescription>
                </DialogHeader>
                <form onSubmit={handleCreateGateway} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium mb-1">
                      Gateway Name
                    </label>
                    <Input
                      placeholder="e.g., RV50X-01"
                      value={formData.name}
                      onChange={(e) =>
                        setFormData({ ...formData, name: e.target.value })
                      }
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">
                      Endpoint
                    </label>
                    <Input
                      placeholder="e.g., rv50x-device-001"
                      value={formData.endpoint}
                      onChange={(e) =>
                        setFormData({ ...formData, endpoint: e.target.value })
                      }
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">
                      IP Address (Optional)
                    </label>
                    <Input
                      placeholder="e.g., 192.168.1.100"
                      value={formData.ipAddress}
                      onChange={(e) =>
                        setFormData({ ...formData, ipAddress: e.target.value })
                      }
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">
                      Serial Number (Optional)
                    </label>
                    <Input
                      placeholder="e.g., SN123456"
                      value={formData.serialNumber}
                      onChange={(e) =>
                        setFormData({ ...formData, serialNumber: e.target.value })
                      }
                    />
                  </div>
                  <Button type="submit" disabled={createGateway.isPending}>
                    {createGateway.isPending ? "Creating..." : "Create Gateway"}
                  </Button>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {/* Gateways Grid */}
        {isLoading ? (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3].map((i) => (
              <Card key={i} className="animate-pulse">
                <CardHeader>
                  <div className="h-6 bg-muted rounded w-3/4"></div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <div className="h-4 bg-muted rounded w-full"></div>
                    <div className="h-4 bg-muted rounded w-5/6"></div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : gateways && gateways.length > 0 ? (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {gateways.map((gateway) => (
              <Card key={gateway.id} className="hover:shadow-lg transition-shadow">
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle className="text-lg">{gateway.name}</CardTitle>
                      <CardDescription className="text-xs mt-1">
                        {gateway.endpoint}
                      </CardDescription>
                    </div>
                    <Badge className={`${getStatusColor(gateway.status)} flex gap-1`}>
                      {getStatusIcon(gateway.status)}
                      {gateway.status}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="text-sm">
                    <p className="text-muted-foreground">IP Address</p>
                    <p className="font-mono text-xs">{gateway.ipAddress || "N/A"}</p>
                  </div>
                  {gateway.serialNumber && (
                    <div className="text-sm">
                      <p className="text-muted-foreground">Serial Number</p>
                      <p className="font-mono text-xs">{gateway.serialNumber}</p>
                    </div>
                  )}
                  {gateway.lastSeen && (
                    <div className="text-sm">
                      <p className="text-muted-foreground">Last Seen</p>
                      <p className="text-xs">
                        {new Date(gateway.lastSeen).toLocaleString()}
                      </p>
                    </div>
                  )}
                  <Button variant="outline" size="sm" className="w-full">
                    View Details
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center justify-center py-12">
              <AlertCircle className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">No Gateways</h3>
              <p className="text-muted-foreground text-center mb-4">
                You haven't added any gateways yet. Create one to get started.
              </p>
              <Button onClick={() => setIsCreateOpen(true)}>
                <Plus size={16} className="mr-2" />
                Add Your First Gateway
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
}

