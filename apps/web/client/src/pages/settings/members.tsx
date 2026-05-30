import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useToast } from "@/hooks/use-toast";
import { UserPlus, MoreHorizontal, Trash2 } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { SettingsLayout } from "@/components/settings/settings-layout";
import { useAuth } from "@/hooks/use-auth";

type Role = "OWNER" | "ADMIN" | "MANAGER" | "AGENT" | "BILLING" | "VIEWER";

const ROLE_META: Record<Role, { label: string; description: string; color: string }> = {
  OWNER: {
    label: "Propietario",
    description: "Control total del workspace. Solo uno por workspace.",
    color: "bg-amber-50 text-amber-700 border-amber-200",
  },
  ADMIN: {
    label: "Administrador",
    description: "Configura el workspace, gestiona miembros e integraciones.",
    color: "bg-violet-50 text-violet-700 border-violet-200",
  },
  MANAGER: {
    label: "Gerente",
    description: "Supervisa equipos, asigna conversaciones y tareas. No configura el workspace.",
    color: "bg-blue-50 text-blue-700 border-blue-200",
  },
  AGENT: {
    label: "Agente",
    description: "Atiende conversaciones, crea tareas y clientes.",
    color: "bg-green-50 text-green-700 border-green-200",
  },
  BILLING: {
    label: "Facturación",
    description: "Acceso al módulo de facturas y clientes. Sin acceso a configuración.",
    color: "bg-orange-50 text-orange-700 border-orange-200",
  },
  VIEWER: {
    label: "Visualizador",
    description: "Solo lectura. No puede crear ni modificar datos.",
    color: "bg-gray-100 text-gray-500 border-gray-200",
  },
};

const INVITABLE_ROLES: Role[] = ["ADMIN", "MANAGER", "AGENT", "BILLING", "VIEWER"];

// Roles que un MANAGER puede asignar
const MANAGER_ROLES: Role[] = ["AGENT", "BILLING", "VIEWER"];

export default function MembersSettingsPage() {
  const { user: currentUser } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<Role>("AGENT");

  const currentRole = (currentUser?.role ?? "VIEWER") as Role;
  const isManager = currentRole === "MANAGER";
  const isAdminOrOwner = ["ADMIN", "OWNER"].includes(currentRole);
  const canManageMembers = isAdminOrOwner || isManager;

  const availableRoles = isManager ? MANAGER_ROLES : INVITABLE_ROLES;

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
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const changeRole = useMutation({
    mutationFn: ({ userId, newRole }: { userId: string; newRole: Role }) =>
      api.changeMemberRole(userId, newRole),
    onSuccess: () => {
      toast({ title: "Rol actualizado" });
      qc.invalidateQueries({ queryKey: ["/api/workspaces/current/members"] });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const removeMember = useMutation({
    mutationFn: (userId: string) => api.removeMember(userId),
    onSuccess: () => {
      toast({ title: "Miembro eliminado" });
      qc.invalidateQueries({ queryKey: ["/api/workspaces/current/members"] });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const members = Array.isArray(data) ? data : [];

  const canEditMember = (memberRole: Role, isOwner: boolean) => {
    if (isOwner) return false;
    if (isAdminOrOwner) return memberRole !== "OWNER";
    if (isManager) return MANAGER_ROLES.includes(memberRole);
    return false;
  };

  return (
    <SettingsLayout>
      <div className="space-y-4 max-w-2xl">
        <div className="flex justify-between items-center">
          <p className="text-sm text-muted-foreground">{members.length} miembro(s)</p>
          {canManageMembers && (
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild>
                <Button size="sm" className="bg-primary hover:bg-primary/90">
                  <UserPlus className="h-4 w-4 mr-2" />Invitar
                </Button>
              </DialogTrigger>
              <DialogContent className="bg-card border-border">
                <DialogHeader><DialogTitle>Invitar usuario</DialogTitle></DialogHeader>
                <div className="space-y-4 pt-2">
                  <div>
                    <Label>Email</Label>
                    <Input
                      value={email}
                      onChange={e => setEmail(e.target.value)}
                      placeholder="usuario@empresa.com"
                      className="mt-1 bg-[hsl(var(--elevated))] border-border"
                    />
                  </div>
                  <div>
                    <Label>Rol</Label>
                    <Select value={role} onValueChange={v => setRole(v as Role)}>
                      <SelectTrigger className="mt-1 bg-[hsl(var(--elevated))] border-border">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-card border-border">
                        {availableRoles.map(r => (
                          <SelectItem key={r} value={r}>
                            <div>
                              <span className="font-medium">{ROLE_META[r].label}</span>
                              <span className="text-muted-foreground text-xs ml-2">— {ROLE_META[r].description}</span>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {role && (
                      <p className="text-xs text-muted-foreground mt-1.5">{ROLE_META[role].description}</p>
                    )}
                  </div>
                  <Button
                    onClick={() => invite.mutate()}
                    disabled={!email || invite.isPending}
                    className="w-full bg-primary hover:bg-primary/90"
                  >
                    {invite.isPending ? "Enviando..." : "Enviar invitación"}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          )}
        </div>

        {isLoading ? (
          <div className="text-muted-foreground text-sm">Cargando...</div>
        ) : (
          <div className="space-y-2">
            {members.map((m: any) => {
              const memberRole = m.role as Role;
              const meta = ROLE_META[memberRole] ?? ROLE_META.VIEWER;
              const editable = canEditMember(memberRole, m.is_owner);

              return (
                <div key={m.id} className="flex items-center justify-between p-3 rounded-lg bg-card border border-border">
                  <div className="flex items-center gap-3 min-w-0">
                    <Avatar className="h-8 w-8 shrink-0">
                      <AvatarFallback className="bg-elevated text-xs">
                        {m.name?.[0]?.toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{m.name}</p>
                      <p className="text-xs text-muted-foreground truncate">{m.email}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0 ml-3">
                    {editable ? (
                      <Select
                        value={memberRole}
                        onValueChange={v => changeRole.mutate({ userId: m.user_id ?? m.id, newRole: v as Role })}
                        disabled={changeRole.isPending}
                      >
                        <SelectTrigger className="h-7 text-xs border-border bg-transparent w-36">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="bg-card border-border">
                          {availableRoles.map(r => (
                            <SelectItem key={r} value={r} className="text-xs">
                              {ROLE_META[r].label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : (
                      <Badge variant="outline" className={`text-xs ${meta.color}`}>
                        {meta.label}
                      </Badge>
                    )}

                    {editable && (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-7 w-7">
                            <MoreHorizontal className="h-3.5 w-3.5" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="bg-card border-border">
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            className="text-destructive focus:text-destructive cursor-pointer"
                            onClick={() => removeMember.mutate(m.user_id ?? m.id)}
                          >
                            <Trash2 className="h-3.5 w-3.5 mr-2" />
                            Eliminar miembro
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Tabla de referencia de roles */}
        <div className="border border-border rounded-lg overflow-hidden mt-6">
          <div className="px-4 py-2.5 bg-muted/30 border-b border-border">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Referencia de roles</p>
          </div>
          <div className="divide-y divide-border">
            {(Object.entries(ROLE_META) as [Role, typeof ROLE_META[Role]][])
              .filter(([r]) => r !== "OWNER")
              .map(([r, meta]) => (
                <div key={r} className="px-4 py-2.5 flex items-start gap-3">
                  <Badge variant="outline" className={`text-xs shrink-0 mt-0.5 ${meta.color}`}>
                    {meta.label}
                  </Badge>
                  <p className="text-xs text-muted-foreground">{meta.description}</p>
                </div>
              ))}
          </div>
        </div>
      </div>
    </SettingsLayout>
  );
}
