import { useState } from "react";
import { trpc } from "@/lib/trpc";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Plus, Play, Pause, Trash2, Clock } from "lucide-react";

export default function Automation() {
  const [isCreateJobOpen, setIsCreateJobOpen] = useState(false);
  const [isCreateRuleOpen, setIsCreateRuleOpen] = useState(false);
  const [jobForm, setJobForm] = useState({
    name: "",
    description: "",
    jobType: "command",
    targetType: "single",
  });
  const [ruleForm, setRuleForm] = useState({
    name: "",
    description: "",
    conditions: "{}",
    actions: "{}",
  });

  const { data: jobs, refetch: refetchJobs } = trpc.jobs.list.useQuery();
  const { data: rules, refetch: refetchRules } = trpc.automation.listRules.useQuery();

  const createJob = trpc.jobs.create.useMutation({
    onSuccess: () => {
      setJobForm({ name: "", description: "", jobType: "command", targetType: "single" });
      setIsCreateJobOpen(false);
      refetchJobs();
    },
  });

  const createRule = trpc.automation.createRule.useMutation({
    onSuccess: () => {
      setRuleForm({ name: "", description: "", conditions: "{}", actions: "{}" });
      setIsCreateRuleOpen(false);
      refetchRules();
    },
  });

  const handleCreateJob = async (e: React.FormEvent) => {
    e.preventDefault();
    createJob.mutate({
      name: jobForm.name,
      description: jobForm.description,
      jobType: jobForm.jobType as any,
      targetType: jobForm.targetType as any,
    });
  };

  const handleCreateRule = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const conditions = JSON.parse(ruleForm.conditions);
      const actions = JSON.parse(ruleForm.actions);
      createRule.mutate({
        name: ruleForm.name,
        description: ruleForm.description,
        conditions,
        actions,
      });
    } catch (error) {
      alert("Invalid JSON in conditions or actions");
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Automation & Jobs</h1>
          <p className="text-muted-foreground mt-2">
            Schedule jobs and create automation rules for your gateways
          </p>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 border-b">
          <Button variant="ghost" className="rounded-none border-b-2 border-primary">
            Jobs
          </Button>
          <Button variant="ghost" className="rounded-none">
            Automation Rules
          </Button>
        </div>

        {/* Jobs Section */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold">Scheduled Jobs</h2>
            <Dialog open={isCreateJobOpen} onOpenChange={setIsCreateJobOpen}>
              <DialogTrigger asChild>
                <Button>
                  <Plus size={16} className="mr-2" />
                  New Job
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Create Scheduled Job</DialogTitle>
                  <DialogDescription>
                    Set up a job to run on one or more gateways
                  </DialogDescription>
                </DialogHeader>
                <form onSubmit={handleCreateJob} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium mb-1">Job Name</label>
                    <Input
                      placeholder="e.g., Daily Reboot"
                      value={jobForm.name}
                      onChange={(e) => setJobForm({ ...jobForm, name: e.target.value })}
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Description</label>
                    <Input
                      placeholder="What does this job do?"
                      value={jobForm.description}
                      onChange={(e) => setJobForm({ ...jobForm, description: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Job Type</label>
                    <select
                      className="w-full px-3 py-2 border rounded-md"
                      value={jobForm.jobType}
                      onChange={(e) => setJobForm({ ...jobForm, jobType: e.target.value })}
                    >
                      <option value="command">Send Command</option>
                      <option value="configuration">Deploy Configuration</option>
                      <option value="firmware_update">Firmware Update</option>
                      <option value="reboot">Reboot Device</option>
                      <option value="custom">Custom</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Target Type</label>
                    <select
                      className="w-full px-3 py-2 border rounded-md"
                      value={jobForm.targetType}
                      onChange={(e) => setJobForm({ ...jobForm, targetType: e.target.value })}
                    >
                      <option value="single">Single Gateway</option>
                      <option value="group">Device Group</option>
                      <option value="all">All Gateways</option>
                    </select>
                  </div>
                  <Button type="submit" disabled={createJob.isPending}>
                    {createJob.isPending ? "Creating..." : "Create Job"}
                  </Button>
                </form>
              </DialogContent>
            </Dialog>
          </div>

          {jobs && jobs.length > 0 ? (
            <div className="grid gap-4">
              {jobs.map((job) => (
                <Card key={job.id}>
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div>
                        <CardTitle className="text-lg">{job.name}</CardTitle>
                        <CardDescription>{job.description}</CardDescription>
                      </div>
                      <div className="flex gap-2">
                        <Badge variant="outline">{job.jobType}</Badge>
                        <Badge>{job.isActive ? "Active" : "Inactive"}</Badge>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Clock size={16} />
                      {job.schedule || "No schedule"}
                    </div>
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm">
                        {job.isActive ? <Pause size={16} /> : <Play size={16} />}
                      </Button>
                      <Button variant="outline" size="sm">
                        <Trash2 size={16} />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <Card className="border-dashed">
              <CardContent className="flex flex-col items-center justify-center py-12">
                <h3 className="text-lg font-semibold mb-2">No Jobs Yet</h3>
                <p className="text-muted-foreground text-center mb-4">
                  Create your first scheduled job to automate gateway management
                </p>
                <Button onClick={() => setIsCreateJobOpen(true)}>
                  <Plus size={16} className="mr-2" />
                  Create Job
                </Button>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Automation Rules Section */}
        <div className="space-y-4 mt-8">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold">Automation Rules</h2>
            <Dialog open={isCreateRuleOpen} onOpenChange={setIsCreateRuleOpen}>
              <DialogTrigger asChild>
                <Button>
                  <Plus size={16} className="mr-2" />
                  New Rule
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl">
                <DialogHeader>
                  <DialogTitle>Create Automation Rule</DialogTitle>
                  <DialogDescription>
                    Define conditions that trigger automatic actions
                  </DialogDescription>
                </DialogHeader>
                <form onSubmit={handleCreateRule} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium mb-1">Rule Name</label>
                    <Input
                      placeholder="e.g., Reboot on High Error Rate"
                      value={ruleForm.name}
                      onChange={(e) => setRuleForm({ ...ruleForm, name: e.target.value })}
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Description</label>
                    <Input
                      placeholder="What triggers this rule?"
                      value={ruleForm.description}
                      onChange={(e) => setRuleForm({ ...ruleForm, description: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Conditions (JSON)</label>
                    <textarea
                      className="w-full h-32 p-3 border rounded-md font-mono text-sm"
                      placeholder={`{\n  "errorRate": { "gt": 5 },\n  "status": "online"\n}`}
                      value={ruleForm.conditions}
                      onChange={(e) => setRuleForm({ ...ruleForm, conditions: e.target.value })}
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Actions (JSON)</label>
                    <textarea
                      className="w-full h-32 p-3 border rounded-md font-mono text-sm"
                      placeholder={`{\n  "action": "reboot",\n  "notifyUser": true\n}`}
                      value={ruleForm.actions}
                      onChange={(e) => setRuleForm({ ...ruleForm, actions: e.target.value })}
                      required
                    />
                  </div>
                  <Button type="submit" disabled={createRule.isPending}>
                    {createRule.isPending ? "Creating..." : "Create Rule"}
                  </Button>
                </form>
              </DialogContent>
            </Dialog>
          </div>

          {rules && rules.length > 0 ? (
            <div className="grid gap-4">
              {rules.map((rule) => (
                <Card key={rule.id}>
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div>
                        <CardTitle className="text-lg">{rule.name}</CardTitle>
                        <CardDescription>{rule.description}</CardDescription>
                      </div>
                      <Badge>{rule.isActive ? "Active" : "Inactive"}</Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="flex items-center justify-between">
                    <div className="text-sm text-muted-foreground">
                      Triggers automatic actions based on defined conditions
                    </div>
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm">
                        {rule.isActive ? <Pause size={16} /> : <Play size={16} />}
                      </Button>
                      <Button variant="outline" size="sm">
                        <Trash2 size={16} />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <Card className="border-dashed">
              <CardContent className="flex flex-col items-center justify-center py-12">
                <h3 className="text-lg font-semibold mb-2">No Rules Yet</h3>
                <p className="text-muted-foreground text-center mb-4">
                  Create your first automation rule to respond to events automatically
                </p>
                <Button onClick={() => setIsCreateRuleOpen(true)}>
                  <Plus size={16} className="mr-2" />
                  Create Rule
                </Button>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}

