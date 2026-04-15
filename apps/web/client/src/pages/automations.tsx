import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { api, parsePlanError } from "@/lib/api";
import { queryClient } from "@/lib/queryClient";
import { useRequireAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { PageLoader } from "@/components/shared/loading-spinner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Zap, Plus, Loader2, MoreHorizontal, Pencil, Trash2 } from "lucide-react";

const TRIGGER_TYPES = [
  "MESSAGE_RECEIVED","CONVERSATION_CREATED","CONVERSATION_STATUS_CHANGED",
  "TASK_CREATED","TASK_OVERDUE","DOCUMENT_UPLOADED","DOCUMENT_PROCESSED",
  "SCHEDULED","MANUAL",
] as const;

function toPayload(form: { name: string; triggerType: string }) {
  return {
    name: form.name.trim(),
    trigger_type: form.triggerType,
    trigger_config_json: {},
    action_config_json: { type: "notify_in_app" },
  };
}

export default function AutomationsPage() {
  useRequireAuth();
  const { toast } = useToast();
  const [showCreate, setShowCreate] = useState(false);
  const [editTarget, setEditTarget] = useState<any>(null);
  const [deleteTarget, setDeleteTarget] = useState<any>(null);
  const [form, setForm] = useState({ name: "", triggerType: "CONVERSATION_CREATED" });
  const [editForm, setEditForm] = useState({ name: "", triggerType: "CONVERSATION_CREATED" });

  const { data, isLoading } = useQuery({
    queryKey: ["/api/automations"],
    queryFn: () => api.getAutomations(),
  });

  const createMutation = useMutation({
    mutationFn: (data: { name: string; triggerType: string }) => api.createAutomation(toPayload(data)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/automations"] });
      setShowCreate(false);
      setForm({ name: "", triggerType: "CONVERSATION_CREATED" });
      toast({ title: "Automation created" });
    },
    onError: (err: any) => {
      const { isPlanLimit, message } = parsePlanError(err);
      toast({
        title: isPlanLimit ? "🔒 Límite de plan alcanzado" : "Failed to create automation",
        description: message,
        variant: "destructive",
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => api.updateAutomation(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/automations"] });
      setEditTarget(null);
      toast({ title: "Automation updated" });
    },
    onError: (err: any) => toast({ title: "Failed to update automation", description: err.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.deleteAutomation(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/automations"] });
      setDeleteTarget(null);
      toast({ title: "Automation deleted" });
    },
    onError: (err: any) => toast({ title: "Failed to delete automation", description: err.message, variant: "destructive" }),
  });

  const toggleMutation = useMutation({
    mutationFn: (id: string) => api.toggleAutomation(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/automations"] }),
    onError: (err: any) => toast({ title: "Failed to toggle automation", description: err.message, variant: "destructive" }),
  });

  const autoList = Array.isArray(data) ? data : data?.data || [];

  function openEdit(auto: any) {
    setEditForm({ name: auto.name, triggerType: auto.trigger_type || auto.triggerType || "CONVERSATION_CREATED" });
    setEditTarget(auto);
  }

  return (
    <div>
      <PageHeader title="Automations" description="Configure automated workflows">
        <Button size="sm" className="h-8 text-xs" onClick={() => setShowCreate(true)}>
          <Plus className="w-3.5 h-3.5 mr-1.5" /> New Automation
        </Button>
      </PageHeader>

      {isLoading ? <PageLoader /> : autoList.length === 0 ? (
        <EmptyState icon={Zap} title="No automations" description="Create automations to streamline your workflows." />
      ) : (
        <div className="rounded-lg border border-border overflow-hidden bg-card">
          <Table>
            <TableHeader>
              <TableRow className="border-border hover:bg-transparent">
                <TableHead className="text-[11px] text-muted-foreground font-medium">Name</TableHead>
                <TableHead className="text-[11px] text-muted-foreground font-medium">Trigger</TableHead>
                <TableHead className="text-[11px] text-muted-foreground font-medium">Executions</TableHead>
                <TableHead className="text-[11px] text-muted-foreground font-medium">Enabled</TableHead>
                <TableHead className="text-[11px] text-muted-foreground font-medium w-10"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {autoList.map((auto: any) => (
                <TableRow key={auto.id} className="border-border hover:bg-white/[0.02]">
                  <TableCell className="text-sm text-foreground font-medium">{auto.name}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className="text-[10px] px-1.5 py-0 border bg-blue-500/10 text-blue-400 border-blue-500/20">
                      {(auto.triggerType || auto.trigger_type || "").replace(/_/g, " ")}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="text-[10px] px-1.5 py-0 border bg-zinc-500/10 text-zinc-400 border-zinc-500/20">
                      {auto.executionCount || auto.execution_count || 0}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Switch checked={auto.enabled ?? false} onCheckedChange={() => toggleMutation.mutate(auto.id)} />
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-7 w-7">
                          <MoreHorizontal className="w-3.5 h-3.5" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => openEdit(auto)} className="text-xs gap-2">
                          <Pencil className="w-3.5 h-3.5" /> Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => setDeleteTarget(auto)} className="text-xs gap-2 text-destructive focus:text-destructive">
                          <Trash2 className="w-3.5 h-3.5" /> Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Create Dialog */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="bg-card border-border sm:max-w-[420px]">
          <DialogHeader><DialogTitle className="text-sm">New Automation</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Name</Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="h-8 text-xs bg-background border-border" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Trigger Type</Label>
              <Select value={form.triggerType} onValueChange={(val) => setForm({ ...form, triggerType: val })}>
                <SelectTrigger className="h-8 text-xs bg-background border-border"><SelectValue /></SelectTrigger>
                <SelectContent>{TRIGGER_TYPES.map((t) => <SelectItem key={t} value={t}>{t.replace(/_/g, " ")}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setShowCreate(false)} className="h-8 text-xs">Cancel</Button>
            <Button size="sm" className="h-8 text-xs" onClick={() => createMutation.mutate(form)} disabled={createMutation.isPending || !form.name}>
              {createMutation.isPending && <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />} Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={!!editTarget} onOpenChange={(o) => !o && setEditTarget(null)}>
        <DialogContent className="bg-card border-border sm:max-w-[420px]">
          <DialogHeader><DialogTitle className="text-sm">Edit Automation</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Name</Label>
              <Input value={editForm.name} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} className="h-8 text-xs bg-background border-border" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Trigger Type</Label>
              <Select value={editForm.triggerType} onValueChange={(val) => setEditForm({ ...editForm, triggerType: val })}>
                <SelectTrigger className="h-8 text-xs bg-background border-border"><SelectValue /></SelectTrigger>
                <SelectContent>{TRIGGER_TYPES.map((t) => <SelectItem key={t} value={t}>{t.replace(/_/g, " ")}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setEditTarget(null)} className="h-8 text-xs">Cancel</Button>
            <Button size="sm" className="h-8 text-xs" onClick={() => updateMutation.mutate({ id: editTarget.id, data: { name: editForm.name, trigger_type: editForm.triggerType } })} disabled={updateMutation.isPending || !editForm.name}>
              {updateMutation.isPending && <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />} Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirm */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent className="bg-card border-border">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-sm">Delete automation?</AlertDialogTitle>
            <AlertDialogDescription className="text-xs text-muted-foreground">
              This will permanently delete <span className="text-foreground font-medium">{deleteTarget?.name}</span> and all its execution history.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="h-8 text-xs">Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => deleteMutation.mutate(deleteTarget.id)} className="h-8 text-xs bg-destructive hover:bg-destructive/90">
              {deleteMutation.isPending && <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />} Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
