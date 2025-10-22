import { useState } from "react";
import { trpc } from "@/lib/trpc";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Plus, Copy, Trash2, Send } from "lucide-react";

export default function Configuration() {
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    config: "{}",
  });

  const { data: templates, refetch: refetchTemplates } = trpc.configurations.listTemplates.useQuery();
  const { data: gateways } = trpc.gateways.list.useQuery();

  const createTemplate = trpc.configurations.createTemplate.useMutation({
    onSuccess: () => {
      setFormData({ name: "", description: "", config: "{}" });
      setIsCreateOpen(false);
      refetchTemplates();
    },
  });

  const deployToGateway = trpc.configurations.deployToGateway.useMutation({
    onSuccess: () => {
      refetchTemplates();
    },
  });

  const handleCreateTemplate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const config = JSON.parse(formData.config);
      createTemplate.mutate({
        name: formData.name,
        description: formData.description,
        config,
      });
    } catch (error) {
      alert("Invalid JSON configuration");
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Configuration Management</h1>
            <p className="text-muted-foreground mt-2">
              Create and deploy configuration templates to gateways
            </p>
          </div>
          <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus size={16} className="mr-2" />
                New Template
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>Create Configuration Template</DialogTitle>
                <DialogDescription>
                  Define a configuration template that can be deployed to multiple gateways
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleCreateTemplate} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Template Name</label>
                  <Input
                    placeholder="e.g., Production Settings"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Description</label>
                  <Input
                    placeholder="Brief description of this configuration"
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Configuration (JSON)</label>
                  <textarea
                    className="w-full h-48 p-3 border rounded-md font-mono text-sm"
                    placeholder={`{\n  "network": {\n    "ipv4": "dhcp",\n    "dns": "8.8.8.8"\n  },\n  "cellular": {\n    "apn": "internet",\n    "band": "auto"\n  }\n}`}
                    value={formData.config}
                    onChange={(e) => setFormData({ ...formData, config: e.target.value })}
                    required
                  />
                </div>
                <Button type="submit" disabled={createTemplate.isPending}>
                  {createTemplate.isPending ? "Creating..." : "Create Template"}
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        {/* Templates List */}
        {templates && templates.length > 0 ? (
          <div className="grid gap-4 md:grid-cols-2">
            {templates.map((template) => (
              <Card key={template.id} className="hover:shadow-lg transition-shadow">
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle className="text-lg">{template.name}</CardTitle>
                      <CardDescription className="text-xs mt-1">
                        {template.description || "No description"}
                      </CardDescription>
                    </div>
                    <Badge variant="outline">v{template.version}</Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="bg-muted p-3 rounded-lg">
                    <p className="text-xs font-medium text-muted-foreground mb-2">Configuration Preview</p>
                    <pre className="text-xs overflow-auto max-h-32">
                      {JSON.stringify(template.config, null, 2)}
                    </pre>
                  </div>

                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" className="flex-1">
                      <Copy size={16} className="mr-1" />
                      Duplicate
                    </Button>
                    <Button variant="outline" size="sm" className="flex-1">
                      <Trash2 size={16} className="mr-1" />
                      Delete
                    </Button>
                  </div>

                  {/* Deploy to Gateway */}
                  <Dialog>
                    <DialogTrigger asChild>
                      <Button className="w-full">
                        <Send size={16} className="mr-2" />
                        Deploy to Gateway
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Deploy Configuration</DialogTitle>
                        <DialogDescription>
                          Select gateway(s) to deploy this configuration
                        </DialogDescription>
                      </DialogHeader>
                      <div className="space-y-3">
                        {gateways?.map((gateway) => (
                          <Button
                            key={gateway.id}
                            variant="outline"
                            className="w-full justify-start"
                            onClick={() => {
                              deployToGateway.mutate({
                                templateId: template.id,
                                gatewayId: gateway.id,
                              });
                            }}
                          >
                            <div className="text-left">
                              <div className="font-medium">{gateway.name}</div>
                              <div className="text-xs text-muted-foreground">{gateway.endpoint}</div>
                            </div>
                          </Button>
                        ))}
                      </div>
                    </DialogContent>
                  </Dialog>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center justify-center py-12">
              <h3 className="text-lg font-semibold mb-2">No Templates Yet</h3>
              <p className="text-muted-foreground text-center mb-4">
                Create your first configuration template to get started
              </p>
              <Button onClick={() => setIsCreateOpen(true)}>
                <Plus size={16} className="mr-2" />
                Create Template
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Configuration Best Practices */}
        <Card>
          <CardHeader>
            <CardTitle>Configuration Best Practices</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground text-sm font-semibold">
                1
              </div>
              <div>
                <p className="font-medium">Use Version Control</p>
                <p className="text-sm text-muted-foreground">Keep track of configuration versions for easy rollback</p>
              </div>
            </div>
            <div className="flex gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground text-sm font-semibold">
                2
              </div>
              <div>
                <p className="font-medium">Test Before Deployment</p>
                <p className="text-sm text-muted-foreground">Deploy to a test gateway first to verify configuration</p>
              </div>
            </div>
            <div className="flex gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground text-sm font-semibold">
                3
              </div>
              <div>
                <p className="font-medium">Document Changes</p>
                <p className="text-sm text-muted-foreground">Add descriptions to track what each template is for</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}

