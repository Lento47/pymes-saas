import { useState, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, parsePlanError } from "@/lib/api";
import { getSessionTtlDays, setSessionTtlDays } from "@/hooks/use-auth";
import { PageHeader } from "@/components/shared/page-header";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSub, DropdownMenuSubTrigger, DropdownMenuPortal, DropdownMenuSubContent, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useToast } from "@/hooks/use-toast";
import { Progress } from "@/components/ui/progress";
import {
  Building2, Users, Radio, UserPlus, Plus, Plug, PlugZap, Loader2, Save,
  MoreHorizontal, Pencil, Trash, UserPen, ShieldAlert, BarChart3, Download,
  ScrollText, Search, Shield, RefreshCw, Clock, Globe, FileText, Database,
  Zap, MessageSquare, CheckSquare, Contact, KeyRound, CreditCard, Lock, ShieldCheck,
  AlertTriangle, LogOut,
} from "lucide-react";
import { formatDistanceToNow, format } from "date-fns";

// ─── Role color helpers ───────────────────────────────────────────────────────

const ROLE_COLORS: Record<string, string> = {
  OWNER: "bg-yellow-500/10 text-yellow-400 border-yellow-500/30",
  ADMIN: "bg-blue-500/10 text-blue-400 border-blue-500/30",
  AGENT: "bg-green-500/10 text-green-400 border-green-500/30",
  VIEWER: "bg-gray-500/10 text-gray-400 border-gray-500/30",
};

const CHANNEL_TYPE_COLORS: Record<string, string> = {
  EMAIL: "bg-blue-500/10 text-blue-400",
  WHATSAPP: "bg-green-500/10 text-green-400",
  FORM: "bg-purple-500/10 text-purple-400",
  API: "bg-orange-500/10 text-orange-400",
  MANUAL: "bg-gray-500/10 text-gray-400",
};

function formatBytes(bytes: number) {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

// ─── 1. Workspace Tab ─────────────────────────────────────────────────────────

function WorkspaceTab() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const { data: ws, isLoading } = useQuery({ queryKey: ["/api/workspaces/current"], queryFn: () => api.getWorkspace() });
  const [form, setForm] = useState<{ name: string; timezone: string; locale: string; country_code: string }>({
    name: "", timezone: "", locale: "", country_code: "",
  });

  const updateMutation = useMutation({
    mutationFn: (updates: Record<string, string>) => api.updateWorkspace(updates),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/workspaces/current"] });
      toast({ title: "Workspace actualizado correctamente" });
    },
    onError: (e: any) => toast({ title: "Error al guardar", description: e.message, variant: "destructive" }),
  });

  if (isLoading && !ws) return <div className="text-muted-foreground text-sm flex items-center"><Loader2 className="w-4 h-4 animate-spin mr-2" /> Cargando...</div>;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-2xl">

        {/* Identity */}
        <div className="space-y-4 md:col-span-2">
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-widest border-b border-border pb-2">Identidad del Workspace</h3>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label className="text-xs text-muted-foreground uppercase tracking-wider">Nombre de la empresa</Label>
              <Input
                value={form.name || ws?.name || ""}
                onChange={e => setForm({ ...form, name: e.target.value })}
                className="mt-1 bg-[#151820] border-[#272d3f]"
                placeholder="Mi Empresa S.A."
              />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground uppercase tracking-wider">Slug URL</Label>
              <Input value={ws?.slug || ""} disabled className="mt-1 bg-[#151820] border-[#272d3f] opacity-40 cursor-not-allowed" />
              <p className="text-[10px] text-muted-foreground mt-1">El slug es el identificador único del workspace y no puede modificarse.</p>
            </div>
          </div>
        </div>

        {/* Localization */}
        <div className="space-y-4 md:col-span-2">
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-widest border-b border-border pb-2">Regionalización</h3>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <Label className="text-xs text-muted-foreground uppercase tracking-wider">Timezone</Label>
              <Select value={form.timezone || ws?.timezone || "UTC"} onValueChange={val => setForm({ ...form, timezone: val })}>
                <SelectTrigger className="mt-1 bg-[#151820] border-[#272d3f]"><SelectValue /></SelectTrigger>
                <SelectContent className="bg-[#1c2030] border-[#272d3f] max-h-72">
                  <SelectItem value="UTC">🌐 UTC</SelectItem>
                  <SelectItem value="America/New_York">🇺🇸 Nueva York (ET)</SelectItem>
                  <SelectItem value="America/Chicago">🇺🇸 Chicago (CT)</SelectItem>
                  <SelectItem value="America/Denver">🇺🇸 Denver (MT)</SelectItem>
                  <SelectItem value="America/Los_Angeles">🇺🇸 Los Ángeles (PT)</SelectItem>
                  <SelectItem value="America/Anchorage">🇺🇸 Anchorage</SelectItem>
                  <SelectItem value="America/Toronto">🇨🇦 Toronto</SelectItem>
                  <SelectItem value="America/Vancouver">🇨🇦 Vancouver</SelectItem>
                  <SelectItem value="America/Mexico_City">🇲🇽 Ciudad de México</SelectItem>
                  <SelectItem value="America/Monterrey">🇲🇽 Monterrey</SelectItem>
                  <SelectItem value="America/Tijuana">🇲🇽 Tijuana</SelectItem>
                  <SelectItem value="America/Hermosillo">🇲🇽 Hermosillo</SelectItem>
                  <SelectItem value="America/Merida">🇲🇽 Mérida</SelectItem>
                  <SelectItem value="America/Guatemala">🇬🇹 Guatemala</SelectItem>
                  <SelectItem value="America/El_Salvador">🇸🇻 El Salvador</SelectItem>
                  <SelectItem value="America/Tegucigalpa">🇭🇳 Honduras</SelectItem>
                  <SelectItem value="America/Managua">🇳🇮 Nicaragua</SelectItem>
                  <SelectItem value="America/Costa_Rica">🇨🇷 Costa Rica</SelectItem>
                  <SelectItem value="America/Panama">🇵🇦 Panamá</SelectItem>
                  <SelectItem value="America/Havana">🇨🇺 Cuba</SelectItem>
                  <SelectItem value="America/Santo_Domingo">🇩🇴 Rep. Dominicana</SelectItem>
                  <SelectItem value="America/Puerto_Rico">🇵🇷 Puerto Rico</SelectItem>
                  <SelectItem value="America/Port-au-Prince">🇭🇹 Haití</SelectItem>
                  <SelectItem value="America/Jamaica">🇯🇲 Jamaica</SelectItem>
                  <SelectItem value="America/Nassau">🇧🇸 Bahamas</SelectItem>
                  <SelectItem value="America/Barbados">🇧🇧 Barbados</SelectItem>
                  <SelectItem value="America/Trinidad">🇹🇹 Trinidad y Tobago</SelectItem>
                  <SelectItem value="America/Bogota">🇨🇴 Bogotá</SelectItem>
                  <SelectItem value="America/Caracas">🇻🇪 Caracas</SelectItem>
                  <SelectItem value="America/Lima">🇵🇪 Lima</SelectItem>
                  <SelectItem value="America/Guayaquil">🇪🇨 Quito / Guayaquil</SelectItem>
                  <SelectItem value="America/La_Paz">🇧🇴 La Paz</SelectItem>
                  <SelectItem value="America/Santiago">🇨🇱 Santiago</SelectItem>
                  <SelectItem value="America/Argentina/Buenos_Aires">🇦🇷 Buenos Aires</SelectItem>
                  <SelectItem value="America/Argentina/Cordoba">🇦🇷 Córdoba</SelectItem>
                  <SelectItem value="America/Argentina/Mendoza">🇦🇷 Mendoza</SelectItem>
                  <SelectItem value="America/Montevideo">🇺🇾 Montevideo</SelectItem>
                  <SelectItem value="America/Asuncion">🇵🇾 Asunción</SelectItem>
                  <SelectItem value="America/Sao_Paulo">🇧🇷 São Paulo / Brasília</SelectItem>
                  <SelectItem value="America/Manaus">🇧🇷 Manaus</SelectItem>
                  <SelectItem value="America/Belem">🇧🇷 Belém / Fortaleza</SelectItem>
                  <SelectItem value="America/Noronha">🇧🇷 Fernando de Noronha</SelectItem>
                  <SelectItem value="America/Cayenne">🇬🇫 Guayana Francesa</SelectItem>
                  <SelectItem value="America/Guyana">🇬🇾 Guyana</SelectItem>
                  <SelectItem value="America/Paramaribo">🇸🇷 Surinam</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs text-muted-foreground uppercase tracking-wider">Idioma</Label>
              <Select value={form.locale || ws?.locale || "es"} onValueChange={val => setForm({ ...form, locale: val })}>
                <SelectTrigger className="mt-1 bg-[#151820] border-[#272d3f]"><SelectValue /></SelectTrigger>
                <SelectContent className="bg-[#1c2030] border-[#272d3f]">
                  <SelectItem value="es">🇪🇸 Español</SelectItem>
                  <SelectItem value="en">🇺🇸 English</SelectItem>
                  <SelectItem value="pt">🇧🇷 Português</SelectItem>
                  <SelectItem value="fr">🇫🇷 Français</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs text-muted-foreground uppercase tracking-wider">País</Label>
              <Select value={form.country_code || ws?.country_code || ""} onValueChange={val => setForm({ ...form, country_code: val })}>
                <SelectTrigger className="mt-1 bg-[#151820] border-[#272d3f]"><SelectValue placeholder="Seleccionar..." /></SelectTrigger>
                <SelectContent className="bg-[#1c2030] border-[#272d3f] max-h-72">
                  <SelectItem value="US">🇺🇸 Estados Unidos</SelectItem>
                  <SelectItem value="CA">🇨🇦 Canadá</SelectItem>
                  <SelectItem value="MX">🇲🇽 México</SelectItem>
                  <SelectItem value="GT">🇬🇹 Guatemala</SelectItem>
                  <SelectItem value="BZ">🇧🇿 Belice</SelectItem>
                  <SelectItem value="HN">🇭🇳 Honduras</SelectItem>
                  <SelectItem value="SV">🇸🇻 El Salvador</SelectItem>
                  <SelectItem value="NI">🇳🇮 Nicaragua</SelectItem>
                  <SelectItem value="CR">🇨🇷 Costa Rica</SelectItem>
                  <SelectItem value="PA">🇵🇦 Panamá</SelectItem>
                  <SelectItem value="CU">🇨🇺 Cuba</SelectItem>
                  <SelectItem value="DO">🇩🇴 República Dominicana</SelectItem>
                  <SelectItem value="PR">🇵🇷 Puerto Rico</SelectItem>
                  <SelectItem value="HT">🇭🇹 Haití</SelectItem>
                  <SelectItem value="JM">🇯🇲 Jamaica</SelectItem>
                  <SelectItem value="TT">🇹🇹 Trinidad y Tobago</SelectItem>
                  <SelectItem value="BB">🇧🇧 Barbados</SelectItem>
                  <SelectItem value="BS">🇧🇸 Bahamas</SelectItem>
                  <SelectItem value="GD">🇬🇩 Granada</SelectItem>
                  <SelectItem value="VC">🇻🇨 San Vicente y Granadinas</SelectItem>
                  <SelectItem value="LC">🇱🇨 Santa Lucía</SelectItem>
                  <SelectItem value="AG">🇦🇬 Antigua y Barbuda</SelectItem>
                  <SelectItem value="KN">🇰🇳 San Cristóbal y Nieves</SelectItem>
                  <SelectItem value="CO">🇨🇴 Colombia</SelectItem>
                  <SelectItem value="VE">🇻🇪 Venezuela</SelectItem>
                  <SelectItem value="EC">🇪🇨 Ecuador</SelectItem>
                  <SelectItem value="PE">🇵🇪 Perú</SelectItem>
                  <SelectItem value="BO">🇧🇴 Bolivia</SelectItem>
                  <SelectItem value="CL">🇨🇱 Chile</SelectItem>
                  <SelectItem value="AR">🇦🇷 Argentina</SelectItem>
                  <SelectItem value="UY">🇺🇾 Uruguay</SelectItem>
                  <SelectItem value="PY">🇵🇾 Paraguay</SelectItem>
                  <SelectItem value="BR">🇧🇷 Brasil</SelectItem>
                  <SelectItem value="GY">🇬🇾 Guyana</SelectItem>
                  <SelectItem value="SR">🇸🇷 Surinam</SelectItem>
                  <SelectItem value="GF">🇬🇫 Guayana Francesa</SelectItem>
                  <SelectItem value="ES">🇪🇸 España</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        {/* Plan */}
        <div className="space-y-4 md:col-span-2">
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-widest border-b border-border pb-2">Plan & Estado</h3>
          <div className="flex items-center gap-4">
            <Badge variant="outline" className="text-blue-400 border-blue-500/30 bg-blue-500/10 px-4 py-1.5 text-sm font-bold">{ws?.plan || "FREE"}</Badge>
            <Badge variant="outline" className="text-green-400 border-green-500/30 bg-green-500/10">{ws?.status || "ACTIVE"}</Badge>
            <p className="text-xs text-muted-foreground">Creado {ws?.created_at ? formatDistanceToNow(new Date(ws.created_at), { addSuffix: true }) : ""}</p>
          </div>
        </div>
      </div>

      <Button
        className="bg-blue-600 hover:bg-blue-700"
        onClick={() => {
          // Only send fields that the backend DTO accepts (no slug)
          const payload: Record<string, string> = {};
          if (form.name)         payload.name         = form.name;
          if (form.timezone)     payload.timezone     = form.timezone;
          if (form.locale)       payload.locale       = form.locale;
          if (form.country_code) payload.country_code = form.country_code;
          updateMutation.mutate(payload as any);
        }}
        disabled={updateMutation.isPending}
      >
        {updateMutation.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
        Guardar cambios
      </Button>
    </div>
  );
}

// ─── 2. Members Tab ───────────────────────────────────────────────────────────

function MembersTab() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("AGENT");
  const [editUser, setEditUser] = useState<any>(null);
  const [editName, setEditName] = useState("");
  const [search, setSearch] = useState("");

  const { data, isLoading } = useQuery({ queryKey: ["/api/workspaces/current/members"], queryFn: () => api.getMembers() });

  const invite = useMutation({
    mutationFn: () => api.inviteUser({ email, role }),
    onSuccess: () => { toast({ title: "Invitación enviada" }); qc.invalidateQueries({ queryKey: ["/api/workspaces/current/members"] }); setOpen(false); setEmail(""); },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const changeRole = useMutation({
    mutationFn: ({ id, newRole }: { id: string; newRole: string }) => api.changeMemberRole(id, newRole),
    onSuccess: () => { toast({ title: "Rol actualizado" }); qc.invalidateQueries({ queryKey: ["/api/workspaces/current/members"] }); },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const removeMember = useMutation({
    mutationFn: (id: string) => api.removeMember(id),
    onSuccess: () => { toast({ title: "Miembro eliminado" }); qc.invalidateQueries({ queryKey: ["/api/workspaces/current/members"] }); },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const updateProfile = useMutation({
    mutationFn: () => api.updateUser(editUser.user?.id || editUser.id, { name: editName }),
    onSuccess: () => { toast({ title: "Perfil actualizado" }); qc.invalidateQueries({ queryKey: ["/api/workspaces/current/members"] }); setEditUser(null); },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const members = (Array.isArray(data) ? data : []).filter((m: any) =>
    !search || (m.user?.name || m.name || "").toLowerCase().includes(search.toLowerCase()) || (m.user?.email || m.email || "").toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div>
      <div className="flex items-center gap-3 mb-5">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar miembros..." className="pl-9 h-8 text-xs bg-[#151820] border-[#272d3f]" />
        </div>
        <p className="text-xs text-muted-foreground ml-auto">{members.length} miembro(s)</p>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm" className="bg-blue-600 hover:bg-blue-700 h-8 text-xs"><UserPlus className="h-3.5 w-3.5 mr-1.5" /> Invitar usuario</Button>
          </DialogTrigger>
          <DialogContent className="bg-[#1c2030] border-[#272d3f]">
            <DialogHeader><DialogTitle>Invitar nuevo miembro</DialogTitle></DialogHeader>
            <div className="space-y-4 pt-2">
              <div>
                <Label>Email corporativo</Label>
                <Input value={email} onChange={e => setEmail(e.target.value)} placeholder="agente@empresa.com" className="mt-1 bg-[#151820] border-[#272d3f]" />
              </div>
              <div>
                <Label>Rol asignado</Label>
                <Select value={role} onValueChange={setRole}>
                  <SelectTrigger className="mt-1 bg-[#151820] border-[#272d3f]"><SelectValue /></SelectTrigger>
                  <SelectContent className="bg-[#1c2030] border-[#272d3f]">
                    {["ADMIN", "AGENT", "VIEWER"].map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="text-xs text-muted-foreground bg-blue-500/5 border border-blue-500/20 rounded-md p-3">
                El usuario recibirá una invitación. Si no existe, se creará una cuenta automáticamente.
              </div>
              <Button onClick={() => invite.mutate()} disabled={!email || invite.isPending} className="w-full bg-blue-600 hover:bg-blue-700">
                {invite.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null} Enviar invitación
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Edit User Dialog */}
      <Dialog open={!!editUser} onOpenChange={o => !o && setEditUser(null)}>
        <DialogContent className="bg-[#1c2030] border-[#272d3f]">
          <DialogHeader><DialogTitle>Editar perfil de {editUser?.user?.name || editUser?.name}</DialogTitle></DialogHeader>
          <div className="space-y-4 pt-2">
            <div>
              <Label>Nombre completo</Label>
              <Input value={editName} onChange={e => setEditName(e.target.value)} className="mt-1 bg-[#151820] border-[#272d3f]" />
            </div>
            <div>
              <Label className="text-muted-foreground text-xs">Email (no editable)</Label>
              <Input value={editUser?.user?.email || editUser?.email || ""} disabled className="mt-1 bg-[#151820] border-[#272d3f] opacity-50" />
            </div>
            <Button onClick={() => updateProfile.mutate()} disabled={!editName || updateProfile.isPending} className="w-full bg-blue-600 hover:bg-blue-700">
              {updateProfile.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null} Guardar cambios
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {isLoading ? (
        <div className="flex items-center text-muted-foreground text-sm"><Loader2 className="w-4 h-4 animate-spin mr-2" /> Cargando...</div>
      ) : (
        <div className="space-y-2">
          {members.map((m: any) => {
            const name = m.user?.name || m.name;
            const email = m.user?.email || m.email;
            return (
              <div key={m.id} className="group flex items-center justify-between p-3.5 rounded-lg bg-[#1c2030] border border-[#272d3f] hover:border-[#38415c] transition-colors">
                <div className="flex items-center gap-3">
                  <Avatar className="h-9 w-9">
                    <AvatarFallback className="bg-gradient-to-br from-blue-600 to-indigo-700 text-white text-sm font-bold">{name?.[0]?.toUpperCase()}</AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="text-sm font-medium">{name} {m.is_owner && <span className="text-xs text-yellow-500 ml-1">(Propietario)</span>}</p>
                    <p className="text-xs text-muted-foreground">{email}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <p className="text-xs text-muted-foreground hidden sm:block">{m.joined_at ? format(new Date(m.joined_at), "dd MMM yyyy") : ""}</p>
                  <Badge variant="outline" className={ROLE_COLORS[m.role] ?? ""}>{m.role}</Badge>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" className="h-8 w-8 p-0 opacity-0 group-hover:opacity-100 transition-opacity">
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-52 bg-[#1c2030] border-[#272d3f]">
                      <DropdownMenuItem onClick={() => { setEditUser(m); setEditName(name || ""); }}>
                        <UserPen className="w-4 h-4 mr-2" /> Editar perfil
                      </DropdownMenuItem>
                      {!m.is_owner && (
                        <>
                          <DropdownMenuSub>
                            <DropdownMenuSubTrigger><ShieldAlert className="w-4 h-4 mr-2" /> Cambiar rol</DropdownMenuSubTrigger>
                            <DropdownMenuPortal>
                              <DropdownMenuSubContent className="bg-[#1c2030] border-[#272d3f]">
                                {["ADMIN", "AGENT", "VIEWER"].map(r => (
                                  <DropdownMenuItem key={r} onClick={() => changeRole.mutate({ id: m.user?.id || m.id, newRole: r })} className={m.role === r ? "bg-white/5" : ""}>
                                    <Badge variant="outline" className={`${ROLE_COLORS[r]} mr-2 text-xs`}>{r}</Badge>
                                  </DropdownMenuItem>
                                ))}
                              </DropdownMenuSubContent>
                            </DropdownMenuPortal>
                          </DropdownMenuSub>
                          <DropdownMenuSeparator className="bg-[#272d3f]" />
                          <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={() => removeMember.mutate(m.user?.id || m.id)}>
                            <Trash className="w-4 h-4 mr-2" /> Remover del workspace
                          </DropdownMenuItem>
                        </>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── 3. Channels Tab ──────────────────────────────────────────────────────────

function ChannelsTab() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [type, setType] = useState("EMAIL");
  const [editChannel, setEditChannel] = useState<any>(null);
  const [editName, setEditName] = useState("");

  const { data, isLoading } = useQuery({ queryKey: ["/api/channels"], queryFn: () => api.getChannels() });

  const create = useMutation({
    mutationFn: () => api.createChannel({ name, type }),
    onSuccess: () => { toast({ title: "Canal creado" }); qc.invalidateQueries({ queryKey: ["/api/channels"] }); setOpen(false); setName(""); },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const connect = useMutation({
    mutationFn: (id: string) => api.connectChannel(id),
    onSuccess: () => { toast({ title: "Canal conectado" }); qc.invalidateQueries({ queryKey: ["/api/channels"] }); },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const disconnectCh = useMutation({
    mutationFn: (id: string) => api.disconnectChannel(id),
    onSuccess: () => { toast({ title: "Canal desconectado" }); qc.invalidateQueries({ queryKey: ["/api/channels"] }); },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const deleteCh = useMutation({
    mutationFn: (id: string) => api.deleteChannel(id),
    onSuccess: () => { toast({ title: "Canal eliminado" }); qc.invalidateQueries({ queryKey: ["/api/channels"] }); },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const updateCh = useMutation({
    mutationFn: () => api.updateChannel(editChannel.id, { name: editName }),
    onSuccess: () => { toast({ title: "Canal actualizado" }); qc.invalidateQueries({ queryKey: ["/api/channels"] }); setEditChannel(null); },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const channels = Array.isArray(data) ? data : [];

  const CHANNEL_ICONS: Record<string, string> = {
    EMAIL: "✉️", WHATSAPP: "💬", FORM: "📋", API: "🔌", MANUAL: "👤",
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-5">
        <p className="text-sm text-muted-foreground">{channels.length} canal(es) configurado(s)</p>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm" className="bg-blue-600 hover:bg-blue-700 h-8 text-xs"><Plus className="h-3.5 w-3.5 mr-1.5" /> Nuevo canal</Button>
          </DialogTrigger>
          <DialogContent className="bg-[#1c2030] border-[#272d3f]">
            <DialogHeader><DialogTitle>Configurar canal de comunicación</DialogTitle></DialogHeader>
            <div className="space-y-4 pt-2">
              <div>
                <Label>Nombre del canal</Label>
                <Input value={name} onChange={e => setName(e.target.value)} placeholder="Ej: WhatsApp Ventas" className="mt-1 bg-[#151820] border-[#272d3f]" />
              </div>
              <div>
                <Label>Tipo de canal</Label>
                <Select value={type} onValueChange={setType}>
                  <SelectTrigger className="mt-1 bg-[#151820] border-[#272d3f]"><SelectValue /></SelectTrigger>
                  <SelectContent className="bg-[#1c2030] border-[#272d3f]">
                    {[["EMAIL", "✉️ Email"], ["WHATSAPP", "💬 WhatsApp"], ["FORM", "📋 Formulario Web"], ["API", "🔌 API"], ["MANUAL", "👤 Manual"]].map(([val, label]) => (
                      <SelectItem key={val} value={val}>{label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button onClick={() => create.mutate()} disabled={!name || create.isPending} className="w-full bg-blue-600 hover:bg-blue-700">
                {create.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null} Crear canal
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <Dialog open={!!editChannel} onOpenChange={o => !o && setEditChannel(null)}>
        <DialogContent className="bg-[#1c2030] border-[#272d3f]">
          <DialogHeader><DialogTitle>Editar canal {editChannel?.type}</DialogTitle></DialogHeader>
          <div className="space-y-4 pt-2">
            <div>
              <Label>Nombre del canal</Label>
              <Input value={editName} onChange={e => setEditName(e.target.value)} className="mt-1 bg-[#151820] border-[#272d3f]" />
            </div>
            <Button onClick={() => updateCh.mutate()} disabled={!editName || updateCh.isPending} className="w-full bg-blue-600 hover:bg-blue-700">
              {updateCh.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null} Guardar cambios
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {isLoading ? <div className="flex items-center text-sm text-muted-foreground"><Loader2 className="w-4 h-4 animate-spin mr-2" /> Cargando...</div> : (
        <div className="space-y-2">
          {channels.map((ch: any) => (
            <div key={ch.id} className="group flex items-center justify-between p-3.5 rounded-lg bg-[#1c2030] border border-[#272d3f] hover:border-[#38415c] transition-colors">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-[#151820] border border-[#272d3f] flex items-center justify-center text-lg">{CHANNEL_ICONS[ch.type] ?? "📡"}</div>
                <div>
                  <p className="text-sm font-medium">{ch.name}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <Badge variant="outline" className={`text-xs ${CHANNEL_TYPE_COLORS[ch.type] ?? ""}`}>{ch.type}</Badge>
                    {ch.provider && <span className="text-xs text-muted-foreground">{ch.provider}</span>}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="outline" className={ch.status === "ACTIVE" ? "text-green-400 border-green-500/30 bg-green-500/5" : "text-gray-400 border-gray-500/30"}>
                  {ch.status === "ACTIVE" ? "● Activo" : ch.status}
                </Badge>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" className="h-8 w-8 p-0 opacity-0 group-hover:opacity-100 transition-opacity"><MoreHorizontal className="h-4 w-4" /></Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-48 bg-[#1c2030] border-[#272d3f]">
                    <DropdownMenuItem onClick={() => { setEditChannel(ch); setEditName(ch.name || ""); }}><Pencil className="w-4 h-4 mr-2" /> Editar nombre</DropdownMenuItem>
                    {ch.status !== "ACTIVE"
                      ? <DropdownMenuItem onClick={() => connect.mutate(ch.id)}><Plug className="w-4 h-4 mr-2" /> Conectar</DropdownMenuItem>
                      : <DropdownMenuItem onClick={() => disconnectCh.mutate(ch.id)}><PlugZap className="w-4 h-4 mr-2" /> Desconectar</DropdownMenuItem>
                    }
                    <DropdownMenuSeparator className="bg-[#272d3f]" />
                    <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={() => deleteCh.mutate(ch.id)}><Trash className="w-4 h-4 mr-2" /> Eliminar canal</DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
          ))}
          {channels.length === 0 && (
            <div className="text-center py-12 text-muted-foreground">
              <Radio className="w-10 h-10 mx-auto mb-3 opacity-30" />
              <p className="text-sm">Sin canales configurados</p>
              <p className="text-xs mt-1">Agrega tu primer canal para comenzar a recibir mensajes</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── 4. Billing & Usage Tab ───────────────────────────────────────────────────

const PLAN_LIMITS: Record<string, { members: number; automations: number; storage: number }> = {
  FREE: { members: 3, automations: 5, storage: 100 * 1024 * 1024 },
  STARTER: { members: 10, automations: 25, storage: 1024 * 1024 * 1024 },
  GROWTH: { members: 50, automations: 100, storage: 10 * 1024 * 1024 * 1024 },
  ENTERPRISE: { members: 999, automations: 999, storage: 100 * 1024 * 1024 * 1024 },
};

const PLAN_PRICES: Record<string, string> = {
  FREE: "$0/mes", STARTER: "$49/mes", GROWTH: "$149/mes", ENTERPRISE: "Contactar ventas",
};

function BillingTab() {
  const { data: ws } = useQuery({ queryKey: ["/api/workspaces/current"], queryFn: () => api.getWorkspace() });
  const { data: stats, isLoading } = useQuery({ queryKey: ["/api/workspaces/stats"], queryFn: () => api.getWorkspaceStats() });

  const plan = ws?.plan || "FREE";
  const limits = PLAN_LIMITS[plan] || PLAN_LIMITS.FREE;

  const memberPct = Math.min(100, ((stats?.members || 0) / limits.members) * 100);
  const autoPct = Math.min(100, ((stats?.automations || 0) / limits.automations) * 100);
  const storagePct = Math.min(100, ((stats?.documentStorageBytes || 0) / limits.storage) * 100);

  const plans = ["FREE", "STARTER", "GROWTH", "ENTERPRISE"];

  return (
    <div className="space-y-8 max-w-2xl">
      {/* Current plan */}
      <div>
        <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-widest border-b border-border pb-2 mb-4">Plan actual</h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {plans.map(p => (
            <div key={p} className={`rounded-lg border p-4 text-center transition-all ${p === plan ? "border-blue-500/50 bg-blue-500/5" : "border-[#272d3f] bg-[#1c2030] opacity-60"}`}>
              <p className="text-xs text-muted-foreground mb-1">{p}</p>
              <p className="font-bold text-sm">{PLAN_PRICES[p]}</p>
              {p === plan && <Badge className="mt-2 bg-blue-600 text-xs">Activo</Badge>}
            </div>
          ))}
        </div>
        {plan !== "ENTERPRISE" && (
          <p className="text-xs text-muted-foreground mt-3">Para actualizar tu plan, contáctanos en <span className="text-blue-400">ventas@pymes.app</span></p>
        )}
      </div>

      {/* Usage metrics */}
      <div>
        <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-widest border-b border-border pb-2 mb-4">Uso del workspace</h3>
        {isLoading ? <div className="flex items-center text-sm text-muted-foreground"><Loader2 className="w-4 h-4 animate-spin mr-2" /> Cargando métricas...</div> : (
          <div className="space-y-5">
            {[
              { label: "Agentes / Miembros", icon: Users, value: stats?.members || 0, limit: limits.members, pct: memberPct, color: "bg-blue-500" },
              { label: "Reglas de automatización", icon: Zap, value: stats?.automations || 0, limit: limits.automations, pct: autoPct, color: "bg-purple-500" },
              { label: "Almacenamiento de documentos", icon: Database, value: formatBytes(stats?.documentStorageBytes || 0), limit: formatBytes(limits.storage), pct: storagePct, color: storagePct > 80 ? "bg-red-500" : "bg-green-500" },
            ].map(({ label, icon: Icon, value, limit, pct, color }) => (
              <div key={label}>
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-2">
                    <Icon className="w-3.5 h-3.5 text-muted-foreground" />
                    <span className="text-xs font-medium">{label}</span>
                  </div>
                  <span className="text-xs text-muted-foreground">{value} / {limit}</span>
                </div>
                <div className="h-1.5 bg-[#272d3f] rounded-full overflow-hidden">
                  <div className={`h-full ${color} rounded-full transition-all`} style={{ width: `${pct}%` }} />
                </div>
              </div>
            ))}

            {/* Quick stats grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4">
              {[
                { label: "Contactos", value: stats?.contacts || 0, icon: Contact },
                { label: "Conversaciones", value: stats?.conversations || 0, icon: MessageSquare },
                { label: "Tareas activas", value: stats?.pendingTasks || 0, icon: CheckSquare },
                { label: "Documentos", value: stats?.documents || 0, icon: FileText },
              ].map(({ label, value, icon: Icon }) => (
                <div key={label} className="bg-[#1c2030] border border-[#272d3f] rounded-lg p-3 text-center">
                  <Icon className="w-4 h-4 text-muted-foreground mx-auto mb-1" />
                  <p className="text-lg font-bold">{value}</p>
                  <p className="text-xs text-muted-foreground">{label}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── 5. Data Export Tab ───────────────────────────────────────────────────────

function DataTab() {
  const { toast } = useToast();
  const [loading, setLoading] = useState<string | null>(null);

  const doExport = useCallback(async (type: string) => {
    setLoading(type);
    try {
      const data = await api.exportData(type);
      const json = JSON.stringify(data, null, 2);
      const blob = new Blob([json], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${type}-export-${format(new Date(), "yyyy-MM-dd")}.json`;
      a.click();
      URL.revokeObjectURL(url);
      toast({ title: `Exportación de ${type} completada` });
    } catch (e: any) {
      toast({ title: "Error al exportar", description: e.message, variant: "destructive" });
    } finally {
      setLoading(null);
    }
  }, [toast]);

  const exportOptions = [
    { type: "contacts", label: "Contactos", description: "Nombre, email, teléfono, empresa y tipo de todos tus contactos.", icon: Contact, color: "blue" },
    { type: "tasks", label: "Tareas", description: "Título, estado, prioridad y fechas de vencimiento.", icon: CheckSquare, color: "green" },
    { type: "conversations", label: "Conversaciones", description: "Asunto, estado, prioridad y categoría de todas las conversaciones.", icon: MessageSquare, color: "purple" },
  ];

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-widest border-b border-border pb-2 mb-4">Exportar datos</h3>
        <p className="text-sm text-muted-foreground mb-5">Descarga tus datos en formato JSON para migración, auditoría externa o respaldo.</p>
        <div className="space-y-3">
          {exportOptions.map(({ type, label, description, icon: Icon, color }) => (
            <div key={type} className="flex items-center justify-between p-4 rounded-lg bg-[#1c2030] border border-[#272d3f]">
              <div className="flex items-center gap-3">
                <div className={`w-9 h-9 rounded-lg bg-${color}-500/10 border border-${color}-500/20 flex items-center justify-center`}>
                  <Icon className={`w-4 h-4 text-${color}-400`} />
                </div>
                <div>
                  <p className="text-sm font-medium">{label}</p>
                  <p className="text-xs text-muted-foreground">{description}</p>
                </div>
              </div>
              <Button size="sm" variant="outline" className="border-[#272d3f] h-8 text-xs shrink-0" onClick={() => doExport(type)} disabled={loading === type}>
                {loading === type ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5 mr-1.5" />}
                Exportar
              </Button>
            </div>
          ))}
        </div>
      </div>

      <div>
        <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-widest border-b border-border pb-2 mb-4">Política de retención</h3>
        <div className="bg-[#1c2030] border border-[#272d3f] rounded-lg p-4 space-y-3">
          <p className="text-sm text-muted-foreground">Las políticas de retención automática están disponibles en el plan Enterprise. Permiten archivar o eliminar automáticamente conversaciones resueltas, contactos inactivos y documentos antiguos.</p>
          <Badge variant="outline" className="text-blue-400 border-blue-500/30 bg-blue-500/5 text-xs">Disponible en Enterprise</Badge>
        </div>
      </div>
    </div>
  );
}

// ─── 6. Audit Log Tab ─────────────────────────────────────────────────────────

const ACTION_COLORS: Record<string, string> = {
  created: "text-green-400",
  updated: "text-blue-400",
  deleted: "text-red-400",
  resolved: "text-purple-400",
  assigned: "text-yellow-400",
};

function AuditTab() {
  const [search, setSearch] = useState("");
  const [entityType, setEntityType] = useState("");
  const [page, setPage] = useState(1);

  const params: Record<string, string> = { page: String(page), limit: "25" };
  if (search) params.action = search;
  if (entityType && entityType !== "all") params.entity_type = entityType;

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["/api/audit", params],
    queryFn: () => api.getAuditLogs(params),
  });

  const logs = data?.data || [];
  const meta = data?.meta;

  const getActionColor = (action: string) => {
    const key = Object.keys(ACTION_COLORS).find(k => action.toLowerCase().includes(k));
    return key ? ACTION_COLORS[key] : "text-muted-foreground";
  };

  return (
    <div>
      <div className="flex items-center gap-3 mb-5">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} placeholder="Buscar por acción..." className="pl-9 h-8 text-xs bg-[#151820] border-[#272d3f]" />
        </div>
        <Select value={entityType} onValueChange={v => { setEntityType(v); setPage(1); }}>
          <SelectTrigger className="h-8 text-xs bg-[#151820] border-[#272d3f] w-40"><SelectValue placeholder="Entidad..." /></SelectTrigger>
          <SelectContent className="bg-[#1c2030] border-[#272d3f]">
            <SelectItem value="all">Todas</SelectItem>
            {["contact", "conversation", "task", "document", "automation", "workspace", "member"].map(e => (
              <SelectItem key={e} value={e}>{e}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => refetch()}><RefreshCw className="w-3.5 h-3.5" /></Button>
        {meta && <p className="text-xs text-muted-foreground ml-auto">{meta.total} registros</p>}
      </div>

      {isLoading ? (
        <div className="flex items-center text-sm text-muted-foreground"><Loader2 className="w-4 h-4 animate-spin mr-2" /> Cargando logs...</div>
      ) : logs.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <ScrollText className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p className="text-sm">Sin registros de auditoría</p>
        </div>
      ) : (
        <>
          <div className="rounded-lg border border-[#272d3f] overflow-hidden">
            <div className="grid grid-cols-[1fr_1fr_1fr_auto] gap-4 px-4 py-2 bg-[#151820] border-b border-[#272d3f]">
              {["Acción", "Entidad", "ID de entidad", "Fecha"].map(h => (
                <p key={h} className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{h}</p>
              ))}
            </div>
            <div className="divide-y divide-[#272d3f]">
              {logs.map((log: any) => (
                <div key={log.id} className="grid grid-cols-[1fr_1fr_1fr_auto] gap-4 px-4 py-3 hover:bg-white/[0.02] transition-colors">
                  <p className={`text-xs font-mono font-medium ${getActionColor(log.action)}`}>{log.action}</p>
                  <p className="text-xs text-muted-foreground capitalize">{log.entity_type}</p>
                  <p className="text-xs text-muted-foreground font-mono truncate">{log.entity_id?.slice(0, 12)}...</p>
                  <p className="text-xs text-muted-foreground whitespace-nowrap">
                    {log.created_at ? formatDistanceToNow(new Date(log.created_at), { addSuffix: true }) : ""}
                  </p>
                </div>
              ))}
            </div>
          </div>

          {meta && meta.pages > 1 && (
            <div className="flex items-center justify-center gap-3 mt-4">
              <Button size="sm" variant="outline" className="h-7 text-xs border-[#272d3f]" disabled={page === 1} onClick={() => setPage(p => p - 1)}>Anterior</Button>
              <p className="text-xs text-muted-foreground">Página {meta.page} de {meta.pages}</p>
              <Button size="sm" variant="outline" className="h-7 text-xs border-[#272d3f]" disabled={page >= meta.pages} onClick={() => setPage(p => p + 1)}>Siguiente</Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ─── 7. Security Tab ─────────────────────────────────────────────────────────

const SESSION_OPTIONS = [
  { days: 1,  label: "1 día",     description: "Alta seguridad — requiere login diario" },
  { days: 7,  label: "7 días",    description: "Recomendado — balance entre seguridad y comodidad" },
  { days: 30, label: "30 días",   description: "Conveniente — acceso mensual sin relogin" },
  { days: 90, label: "90 días",   description: "Persistente — ideal para dispositivos de confianza" },
];

function SecurityTab() {
  const { toast } = useToast();
  const [currentTtl, setCurrentTtl] = useState<number>(getSessionTtlDays);
  const [saved, setSaved] = useState(false);

  const handleSave = () => {
    setSessionTtlDays(currentTtl);
    setSaved(true);
    toast({ title: "Configuración de sesión guardada", description: `Las sesiones durarán ${currentTtl} día(s) desde el próximo login.` });
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="space-y-8 max-w-xl">

      {/* Session Duration */}
      <div>
        <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-widest border-b border-border pb-2 mb-4">
          <Lock className="w-3.5 h-3.5 inline mr-1.5 -mt-0.5" />
          Duración de Sesión
        </h3>
        <p className="text-sm text-muted-foreground mb-4">
          Controla cuánto tiempo permanecen autenticados los usuarios antes de que el sistema requiera un nuevo inicio de sesión. Este ajuste aplica a todos los miembros del workspace.
        </p>

        <div className="space-y-2">
          {SESSION_OPTIONS.map(({ days, label, description }) => (
            <button
              key={days}
              onClick={() => setCurrentTtl(days)}
              className={`w-full flex items-center justify-between p-4 rounded-lg border text-left transition-all ${
                currentTtl === days
                  ? "border-blue-500/50 bg-blue-500/5"
                  : "border-[#272d3f] bg-[#1c2030] hover:border-[#38415c]"
              }`}
            >
              <div className="flex items-center gap-3">
                <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${
                  currentTtl === days ? "border-blue-500 bg-blue-500" : "border-[#38415c]"
                }`}>
                  {currentTtl === days && <div className="w-2 h-2 rounded-full bg-white" />}
                </div>
                <div>
                  <p className="text-sm font-medium">{label}</p>
                  <p className="text-xs text-muted-foreground">{description}</p>
                </div>
              </div>
              {days === 7 && (
                <Badge className="bg-green-500/10 text-green-400 border-green-500/20 text-xs">Recomendado</Badge>
              )}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2 mt-4">
          <Button className="bg-blue-600 hover:bg-blue-700" onClick={handleSave}>
            {saved ? <ShieldCheck className="w-4 h-4 mr-2" /> : <Save className="w-4 h-4 mr-2" />}
            {saved ? "Guardado" : "Guardar política de sesión"}
          </Button>
        </div>
      </div>

      {/* Security Notice */}
      <div>
        <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-widest border-b border-border pb-2 mb-4">
          <ShieldAlert className="w-3.5 h-3.5 inline mr-1.5 -mt-0.5" />
          Notas de Seguridad
        </h3>
        <div className="space-y-3">
          {[
            {
              icon: AlertTriangle,
              color: "yellow",
              title: "Sesiones existentes",
              body: "Cambiar este valor afectará únicamente nuevos inicios de sesión. Las sesiones activas actuales no se verán afectadas hasta su próxima expiración natural del token JWT."
            },
            {
              icon: LogOut,
              color: "blue",
              title: "Cierre de sesión forzado",
              body: "Para revocar el acceso de un usuario inmediatamente, utiliza la opción Remover Miembro en la pestaña de Miembros y vuelve a añadirlo con los permisos correctos."
            },
            {
              icon: KeyRound,
              color: "purple",
              title: "Seguridad del token JWT",
              body: `El servidor expira todos los tokens luego de ${process.env.JWT_EXPIRES_IN ?? "7 días"} independientemente de esta configuración. Esta política controla la persistencia del lado del cliente.`
            },
          ].map(({ icon: Icon, color, title, body }) => (
            <div key={title} className={`p-4 rounded-lg border border-${color}-500/20 bg-${color}-500/5`}>
              <div className="flex items-start gap-3">
                <Icon className={`w-4 h-4 text-${color}-400 mt-0.5 flex-shrink-0`} />
                <div>
                  <p className={`text-xs font-semibold text-${color}-400 mb-1`}>{title}</p>
                  <p className="text-xs text-muted-foreground leading-relaxed">{body}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

    </div>
  );
}

// ─── Main Settings Page ───────────────────────────────────────────────────────

const TABS = [
  { value: "workspace", label: "Workspace", icon: Building2 },
  { value: "members", label: "Miembros", icon: Users },
  { value: "channels", label: "Canales", icon: PlugZap },
  { value: "billing", label: "Plan & Uso", icon: CreditCard },
  { value: "data", label: "Datos", icon: Database },
  { value: "audit", label: "Auditoría", icon: ScrollText },
  { value: "security", label: "Seguridad", icon: Shield },
];

export default function Settings() {
  return (
    <div className="p-6 space-y-6">
      <PageHeader title="Configuración" />
      <Tabs defaultValue="workspace">
        <TabsList className="bg-[#1c2030] border border-[#272d3f] flex-wrap h-auto gap-1 p-1">
          {TABS.map(({ value, label, icon: Icon }) => (
            <TabsTrigger key={value} value={value} className="data-[state=active]:bg-[#272d3f] text-xs">
              <Icon className="h-3.5 w-3.5 mr-1.5" />{label}
            </TabsTrigger>
          ))}
        </TabsList>

        <Card className="mt-4 bg-[#1c2030] border-[#272d3f]">
          <CardContent className="pt-6">
            <TabsContent value="workspace"><WorkspaceTab /></TabsContent>
            <TabsContent value="members"><MembersTab /></TabsContent>
            <TabsContent value="channels"><ChannelsTab /></TabsContent>
            <TabsContent value="billing"><BillingTab /></TabsContent>
            <TabsContent value="data"><DataTab /></TabsContent>
            <TabsContent value="audit"><AuditTab /></TabsContent>
            <TabsContent value="security"><SecurityTab /></TabsContent>
          </CardContent>
        </Card>
      </Tabs>
    </div>
  );
}
