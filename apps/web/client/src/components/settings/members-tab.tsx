import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { UserPlus } from "lucide-react";
import { api } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

const ROLE_COLORS: Record<string, string> = {
  OWNER: "bg-yellow-500/10 text-yellow-400 border-yellow-500/30",
  ADMIN: "bg-blue-500/10 text-blue-400 border-blue-500/30",
  AGENT: "bg-green-500/10 text-green-400 border-green-500/30",
  VIEWER: "bg-gray-500/10 text-gray-400 border-gray-500/30",
};

export function MembersTab() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("AGENT");

  const { data, isLoading } = useQuery({
    queryKey: ["/api/workspaces/current/members"],
    queryFn: () => api.getMembers(),
  });

  const invite = useMutation({
    mutationFn: () => api.inviteUser({ email, role }),
    onSuccess: () => {
      toast({ title: "Invitación enviada" });
      qc.invalidateQueries({ queryKey: ["/api/workspaces/current/members"] });
      setOpen(false);
      setEmail("");
    },
    onError: (e) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const members = Array.isArray(data) ? data : [];

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <p className="text-sm text-muted-foreground">{members.length} miembro(s)</p>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm" className="bg-primary hover:bg-primary/90">
              <UserPlus className="h-4 w-4 mr-2" />Invitar
            </Button>
          </DialogTrigger>
          <DialogContent className="bg-card border-border">
            <DialogHeader><DialogTitle>Invitar usuario</DialogTitle></DialogHeader>
            <div className="space-y-3 pt-2">
              <div>
                <Label>Email</Label>
                <Input value={email} onChange={e => setEmail(e.target.value)} placeholder="usuario@empresa.com" className="mt-1 bg-[hsl(var(--elevated))] border-border" />
              </div>
              <div>
                <Label>Rol</Label>
                <Select value={role} onValueChange={setRole}>
                  <SelectTrigger className="mt-1 bg-[hsl(var(--elevated))] border-border"><SelectValue /></SelectTrigger>
                  <SelectContent className="bg-card border-border">
                    {["ADMIN", "AGENT", "VIEWER"].map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <Button onClick={() => invite.mutate()} disabled={!email || invite.isPending} className="w-full bg-primary hover:bg-primary/90">
                {invite.isPending ? "Enviando..." : "Enviar invitación"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? <div className="text-muted-foreground text-sm">Cargando...</div> : (
        <div className="space-y-2">
          {members.map((m) => (
            <div key={m.id} className="flex items-center justify-between p-3 rounded-lg bg-card border border-border">
              <div className="flex items-center gap-3">
                <Avatar className="h-8 w-8">
                  <AvatarFallback className="bg-elevated text-xs">{m.name?.[0]?.toUpperCase()}</AvatarFallback>
                </Avatar>
                <div>
                  <p className="text-sm font-medium">{m.name}</p>
                  <p className="text-xs text-muted-foreground">{m.email}</p>
                </div>
              </div>
              <Badge variant="outline" className={ROLE_COLORS[m.role] ?? ""}>{m.role}</Badge>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
