import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { PageHeader } from "@/components/shared/page-header";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useToast } from "@/hooks/use-toast";
import {
  Building2, Users, PlugZap, UserPlus, Plus, Plug,
  Mail, MessageCircle, Radio, Eye, EyeOff, ExternalLink,
  PowerOff, Trash2, Layers, UserMinus,
} from "lucide-react";

// ─── Paletas ──────────────────────────────────────────────────────────────────

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

const CHANNEL_ICONS: Record<string, any> = {
  EMAIL: Mail,
  WHATSAPP: MessageCircle,
  FORM: PlugZap,
  API: Plug,
  MANUAL: Radio,
};

// ─── Campo password con toggle ────────────────────────────────────────────────
function SecretInput({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder?: string }) {
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      <Input
        type={show ? "text" : "password"}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        className="bg-[hsl(var(--elevated))] border-border pr-10 font-mono text-xs"
      />
      <button
        type="button"
        onClick={() => setShow(s => !s)}
        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
      >
        {show ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
      </button>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// WORKSPACE TAB
// ═══════════════════════════════════════════════════════════════════════════════

function WorkspaceTab() {
  const { data, isLoading } = useQuery({
    queryKey: ["/api/workspaces/current"],
    queryFn: () => api.getWorkspace(),
  });

  if (isLoading) return <div className="text-muted-foreground text-sm">Cargando...</div>;
  const ws = data;

  return (
    <div className="space-y-4 max-w-lg">
      {[
        { label: "Nombre", value: ws?.name },
        { label: "Slug", value: ws?.slug },
        { label: "Zona horaria", value: ws?.timezone },
        { label: "Idioma", value: ws?.locale },
      ].map(({ label, value }) => (
        <div key={label}>
          <Label className="text-xs text-muted-foreground uppercase tracking-wider">{label}</Label>
          <p className="text-sm mt-1 font-medium">{value ?? "—"}</p>
        </div>
      ))}
      <div>
        <Label className="text-xs text-muted-foreground uppercase tracking-wider">Plan</Label>
        <div className="mt-1">
          <Badge variant="outline" className="text-blue-400 border-blue-500/30 bg-blue-500/10">
            {ws?.plan}
          </Badge>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// MEMBERS TAB
// ═══════════════════════════════════════════════════════════════════════════════

function MembersTab() {
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
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const members = Array.isArray(data) ? data : [];

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <p className="text-sm text-muted-foreground">{members.length} miembro(s)</p>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm" className="bg-blue-600 hover:bg-blue-700">
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
              <Button onClick={() => invite.mutate()} disabled={!email || invite.isPending} className="w-full bg-blue-600 hover:bg-blue-700">
                {invite.isPending ? "Enviando..." : "Enviar invitación"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? <div className="text-muted-foreground text-sm">Cargando...</div> : (
        <div className="space-y-2">
          {members.map((m: any) => (
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

// ═══════════════════════════════════════════════════════════════════════════════
// CHANNELS TAB
// ═══════════════════════════════════════════════════════════════════════════════

// channel.config viene del backend (sanitised — sin keys encrypted)
function EmailConfigModal({ channel, onClose }: { channel: any; onClose: () => void }) {
  const { toast } = useToast();
  const qc = useQueryClient();
  // Pre-populate with existing values; api_key is secret so can't be pre-filled
  const [apiKey, setApiKey] = useState("");
  const [fromEmail, setFromEmail] = useState(channel?.config?.from_email ?? "");
  const [fromName, setFromName] = useState(channel?.config?.from_name ?? "");

  const save = useMutation({
    mutationFn: () => api.configureEmail(channel.id, {
      api_key: apiKey, from_email: fromEmail, from_name: fromName,
    }),
    onSuccess: () => {
      toast({ title: "Canal EMAIL guardado y activado" });
      qc.invalidateQueries({ queryKey: ["/api/channels"] });
      onClose();
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const isEdit = channel?.status === "ACTIVE";

  return (
    <div className="space-y-4 pt-2">
      <div className="p-3 rounded-lg bg-blue-500/10 border border-blue-500/20 text-xs text-blue-300">
        Obtené tu API key en{" "}
        <a href="https://resend.com/api-keys" target="_blank" rel="noreferrer" className="underline inline-flex items-center gap-1">
          resend.com/api-keys <ExternalLink className="h-3 w-3" />
        </a>
      </div>

      <div>
        <Label>API Key de Resend {isEdit && <span className="text-muted-foreground font-normal">(dejá vacío para mantener la actual)</span>}</Label>
        <div className="mt-1">
          <SecretInput value={apiKey} onChange={setApiKey} placeholder={isEdit ? "••••••••••••••••••••" : "re_xxxxxxxxxxxxxxxxxxxx"} />
        </div>
      </div>

      <div>
        <Label>Email remitente</Label>
        <Input type="email" value={fromEmail} onChange={e => setFromEmail(e.target.value)}
          placeholder="onboarding@resend.dev" className="mt-1 bg-[hsl(var(--elevated))] border-border" />
        <p className="text-xs text-muted-foreground mt-1">
          Sin dominio propio usá <span className="font-mono">onboarding@resend.dev</span>
        </p>
      </div>

      <div>
        <Label>Nombre remitente</Label>
        <Input value={fromName} onChange={e => setFromName(e.target.value)}
          placeholder="PYMES CRM" className="mt-1 bg-[hsl(var(--elevated))] border-border" />
      </div>

      <Button
        onClick={() => save.mutate()}
        // On edit, api_key can be blank (keep existing) — only require it on first setup
        disabled={(!isEdit && !apiKey) || !fromEmail || !fromName || save.isPending}
        className="w-full bg-blue-600 hover:bg-blue-700"
      >
        {save.isPending ? "Guardando..." : isEdit ? "Guardar cambios" : "Guardar y activar canal"}
      </Button>
    </div>
  );
}

function WhatsAppConfigModal({ channel, onClose }: { channel: any; onClose: () => void }) {
  const { toast } = useToast();
  const qc = useQueryClient();
  // Pre-populate non-secret fields
  const [accessToken, setAccessToken] = useState("");
  const [phoneNumberId, setPhoneNumberId] = useState(channel?.config?.phone_number_id ?? "");
  const [wabaId, setWabaId] = useState(channel?.config?.waba_id ?? "");

  const save = useMutation({
    mutationFn: () => api.configureWhatsApp(channel.id, {
      access_token: accessToken, phone_number_id: phoneNumberId, waba_id: wabaId,
    }),
    onSuccess: () => {
      toast({ title: "Canal WhatsApp guardado y activado" });
      qc.invalidateQueries({ queryKey: ["/api/channels"] });
      onClose();
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const isEdit = channel?.status === "ACTIVE";

  return (
    <div className="space-y-4 pt-2">
      <div className="p-3 rounded-lg bg-green-500/10 border border-green-500/20 text-xs text-green-300">
        Obtené los datos en{" "}
        <a href="https://developers.facebook.com/apps" target="_blank" rel="noreferrer" className="underline inline-flex items-center gap-1">
          Meta Developers <ExternalLink className="h-3 w-3" />
        </a>
        {" "}→ Tu App → WhatsApp → Configuración de API
      </div>

      <div>
        <Label>Access Token {isEdit && <span className="text-muted-foreground font-normal">(dejá vacío para mantener el actual)</span>}</Label>
        <div className="mt-1">
          <SecretInput value={accessToken} onChange={setAccessToken} placeholder={isEdit ? "••••••••••••••••••••" : "EAAxxxxxxxxxx..."} />
        </div>
      </div>

      <div>
        <Label>Phone Number ID</Label>
        <Input value={phoneNumberId} onChange={e => setPhoneNumberId(e.target.value)}
          placeholder="123456789012345" className="mt-1 bg-[hsl(var(--elevated))] border-border font-mono text-xs" />
      </div>

      <div>
        <Label>WhatsApp Business Account ID</Label>
        <Input value={wabaId} onChange={e => setWabaId(e.target.value)}
          placeholder="987654321098765" className="mt-1 bg-[hsl(var(--elevated))] border-border font-mono text-xs" />
      </div>

      <div className="p-3 rounded-lg bg-[hsl(var(--elevated))] border border-border text-xs text-muted-foreground space-y-1">
        <p className="font-medium text-foreground">Webhook para Meta Developers:</p>
        <p className="font-mono break-all">https://tu-dominio.com/api/inbound/whatsapp/webhook</p>
        <p>Token de verificación: el valor de <span className="font-mono">WHATSAPP_WEBHOOK_VERIFY_TOKEN</span> en tu .env</p>
      </div>

      <Button
        onClick={() => save.mutate()}
        disabled={(!isEdit && !accessToken) || !phoneNumberId || !wabaId || save.isPending}
        className="w-full bg-green-600 hover:bg-green-700"
      >
        {save.isPending ? "Guardando..." : isEdit ? "Guardar cambios" : "Guardar y activar canal"}
      </Button>
    </div>
  );
}

// ─── Confirm delete ───────────────────────────────────────────────────────────
function DeleteChannelDialog({ channel, onClose }: { channel: any; onClose: () => void }) {
  const { toast } = useToast();
  const qc = useQueryClient();

  const del = useMutation({
    mutationFn: () => api.deleteChannel(channel.id),
    onSuccess: () => {
      toast({ title: "Canal eliminado" });
      qc.invalidateQueries({ queryKey: ["/api/channels"] });
      onClose();
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  return (
    <AlertDialog open onOpenChange={open => { if (!open) onClose(); }}>
      <AlertDialogContent className="bg-card border-border">
        <AlertDialogHeader>
          <AlertDialogTitle className="text-sm">¿Eliminar canal "{channel?.name}"?</AlertDialogTitle>
          <AlertDialogDescription className="text-xs text-muted-foreground">
            Esta acción es irreversible. Se perderán la configuración y el historial de conversaciones asociadas.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel className="h-8 text-xs">Cancelar</AlertDialogCancel>
          <AlertDialogAction
            onClick={() => del.mutate()}
            disabled={del.isPending}
            className="h-8 text-xs bg-destructive hover:bg-destructive/90"
          >
            {del.isPending ? "Eliminando..." : "Eliminar"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

function ChannelsTab() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);
  const [configChannel, setConfigChannel] = useState<any>(null);
  const [deleteChannel, setDeleteChannel] = useState<any>(null);
  const [name, setName] = useState("");
  const [type, setType] = useState("EMAIL");

  const { data, isLoading } = useQuery({
    queryKey: ["/api/channels"],
    queryFn: () => api.getChannels(),
  });

  const create = useMutation({
    mutationFn: () => api.createChannel({ name, type }),
    onSuccess: () => {
      toast({ title: "Canal creado" });
      qc.invalidateQueries({ queryKey: ["/api/channels"] });
      setCreateOpen(false);
      setName("");
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const disconnect = useMutation({
    mutationFn: (id: string) => api.disconnectChannel(id),
    onSuccess: () => {
      toast({ title: "Canal desactivado" });
      qc.invalidateQueries({ queryKey: ["/api/channels"] });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const channels = Array.isArray(data) ? data : [];
  const isEmail = configChannel?.type === "EMAIL";
  const isWA = configChannel?.type === "WHATSAPP";

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <p className="text-sm text-muted-foreground">{channels.length} canal(es)</p>

        {/* Modal crear canal */}
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger asChild>
            <Button size="sm" className="bg-blue-600 hover:bg-blue-700">
              <Plus className="h-4 w-4 mr-2" />Nuevo canal
            </Button>
          </DialogTrigger>
          <DialogContent className="bg-card border-border">
            <DialogHeader><DialogTitle>Crear canal</DialogTitle></DialogHeader>
            <div className="space-y-3 pt-2">
              <div>
                <Label>Nombre</Label>
                <Input value={name} onChange={e => setName(e.target.value)} placeholder="ej. Correo Principal" className="mt-1 bg-[hsl(var(--elevated))] border-border" />
              </div>
              <div>
                <Label>Tipo</Label>
                <Select value={type} onValueChange={setType}>
                  <SelectTrigger className="mt-1 bg-[hsl(var(--elevated))] border-border"><SelectValue /></SelectTrigger>
                  <SelectContent className="bg-card border-border">
                    {["EMAIL", "WHATSAPP", "FORM", "API", "MANUAL"].map(t => (
                      <SelectItem key={t} value={t}>{t}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button onClick={() => create.mutate()} disabled={!name || create.isPending} className="w-full bg-blue-600 hover:bg-blue-700">
                {create.isPending ? "Creando..." : "Crear canal"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Modal configuración EMAIL / WhatsApp */}
      <Dialog open={!!configChannel} onOpenChange={open => { if (!open) setConfigChannel(null); }}>
        <DialogContent className="bg-card border-border max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {isEmail ? <Mail className="h-4 w-4 text-blue-400" /> : <MessageCircle className="h-4 w-4 text-green-400" />}
              {configChannel?.status === "ACTIVE" ? "Editar" : "Configurar"} {configChannel?.type}
              <span className="text-muted-foreground font-normal text-sm ml-1">— {configChannel?.name}</span>
            </DialogTitle>
          </DialogHeader>
          {isEmail && <EmailConfigModal channel={configChannel} onClose={() => setConfigChannel(null)} />}
          {isWA && <WhatsAppConfigModal channel={configChannel} onClose={() => setConfigChannel(null)} />}
        </DialogContent>
      </Dialog>

      {/* Confirm delete */}
      {deleteChannel && (
        <DeleteChannelDialog channel={deleteChannel} onClose={() => setDeleteChannel(null)} />
      )}

      {/* Lista */}
      {isLoading ? (
        <div className="text-muted-foreground text-sm">Cargando...</div>
      ) : (
        <div className="space-y-2">
          {channels.map((ch: any) => {
            const Icon = CHANNEL_ICONS[ch.type] ?? Radio;
            const needsConfig = ch.status !== "ACTIVE" && (ch.type === "EMAIL" || ch.type === "WHATSAPP");
            const canConnect = ch.status !== "ACTIVE" && !needsConfig;
            const isActive = ch.status === "ACTIVE";
            const canEdit = isActive && (ch.type === "EMAIL" || ch.type === "WHATSAPP");

            return (
              <div key={ch.id} className="flex items-center justify-between p-3 rounded-lg bg-card border border-border">
                <div className="flex items-center gap-3">
                  <Icon className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-sm font-medium">{ch.name}</p>
                    <Badge variant="outline" className={`text-xs mt-0.5 ${CHANNEL_TYPE_COLORS[ch.type] ?? ""}`}>
                      {ch.type}
                    </Badge>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className={
                    isActive
                      ? "text-green-400 border-green-500/30"
                      : ch.status === "INACTIVE"
                        ? "text-red-400 border-red-500/30"
                        : "text-gray-400 border-gray-500/30"
                  }>
                    {isActive ? "Activo" : ch.status === "INACTIVE" ? "Inactivo" : ch.status}
                  </Badge>

                  {/* Configurar (first time) */}
                  {needsConfig && (
                    <Button size="sm" variant="outline"
                      className={`h-7 text-xs ${ch.type === "EMAIL" ? "border-blue-500/30 text-blue-400" : "border-green-500/30 text-green-400"}`}
                      onClick={() => setConfigChannel(ch)}
                    >
                      <PlugZap className="h-3 w-3 mr-1" />Configurar
                    </Button>
                  )}

                  {/* Editar configuración */}
                  {canEdit && (
                    <Button size="sm" variant="outline"
                      className="h-7 text-xs border-border text-muted-foreground hover:text-foreground"
                      onClick={() => setConfigChannel(ch)}
                    >
                      Editar
                    </Button>
                  )}

                  {/* Conectar (FORM, API, MANUAL) */}
                  {canConnect && (
                    <Button size="sm" variant="outline" className="h-7 text-xs border-border"
                      onClick={() => api.connectChannel(ch.id).then(() => qc.invalidateQueries({ queryKey: ["/api/channels"] }))}
                    >
                      <Plug className="h-3 w-3 mr-1" />Conectar
                    </Button>
                  )}

                  {/* Desactivar */}
                  {isActive && (
                    <Button
                      size="sm" variant="outline"
                      className="h-7 text-xs border-orange-500/30 text-orange-400 hover:bg-orange-500/10"
                      disabled={disconnect.isPending}
                      onClick={() => disconnect.mutate(ch.id)}
                      title="Desactivar canal"
                    >
                      <PowerOff className="h-3 w-3" />
                    </Button>
                  )}

                  {/* Eliminar */}
                  <Button
                    size="sm" variant="outline"
                    className="h-7 text-xs border-red-500/30 text-red-400 hover:bg-red-500/10"
                    onClick={() => setDeleteChannel(ch)}
                    title="Eliminar canal"
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            );
          })}
          {channels.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-8">
              Sin canales — creá uno con el botón de arriba
            </p>
          )}
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// DEPARTMENTS TAB
// ═══════════════════════════════════════════════════════════════════════════════

function DepartmentsTab() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);
  const [editDept, setEditDept] = useState<any>(null);
  const [deleteDept, setDeleteDept] = useState<any>(null);
  const [addMemberDept, setAddMemberDept] = useState<any>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [color, setColor] = useState("#4f8ef7");
  const [memberUserId, setMemberUserId] = useState("");

  const { data: depts, isLoading } = useQuery({
    queryKey: ["departments"],
    queryFn: () => api.getDepartments(),
  });

  const { data: membersData } = useQuery({
    queryKey: ["workspace-members"],
    queryFn: () => api.getMembers(),
  });

  const departments: any[] = Array.isArray(depts) ? depts : [];
  const allMembers: any[] = Array.isArray(membersData) ? membersData : [];

  const createMut = useMutation({
    mutationFn: (d: any) => api.createDepartment(d),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["departments"] });
      setCreateOpen(false);
      setName(""); setDescription(""); setColor("#4f8ef7");
      toast({ title: "Departamento creado" });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const updateMut = useMutation({
    mutationFn: ({ id, ...d }: any) => api.updateDepartment(id, d),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["departments"] });
      setEditDept(null);
      toast({ title: "Departamento actualizado" });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => api.deleteDepartment(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["departments"] });
      setDeleteDept(null);
      toast({ title: "Departamento eliminado" });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const addMemberMut = useMutation({
    mutationFn: ({ deptId, userId }: any) => api.addDepartmentMember(deptId, { user_id: userId }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["departments"] });
      setAddMemberDept(null);
      setMemberUserId("");
      toast({ title: "Miembro agregado" });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const removeMemberMut = useMutation({
    mutationFn: ({ deptId, userId }: any) => api.removeDepartmentMember(deptId, userId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["departments"] }),
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const openEdit = (dept: any) => {
    setEditDept(dept);
    setName(dept.name);
    setDescription(dept.description ?? "");
    setColor(dept.color ?? "#4f8ef7");
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">Organiza usuarios y conversaciones por departamento.</p>
        <Button size="sm" onClick={() => setCreateOpen(true)}>
          <Plus className="h-4 w-4 mr-1" />Nuevo departamento
        </Button>
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Cargando...</p>
      ) : departments.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-8">No hay departamentos aún.</p>
      ) : (
        <div className="space-y-3">
          {departments.map((dept: any) => (
            <div key={dept.id} className="border border-border rounded-lg p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span
                    className="w-3 h-3 rounded-full"
                    style={{ backgroundColor: dept.color ?? "#4f8ef7" }}
                  />
                  <span className="font-medium text-sm">{dept.name}</span>
                  {!dept.is_active && (
                    <Badge variant="outline" className="text-xs text-muted-foreground">Inactivo</Badge>
                  )}
                  <Badge variant="outline" className="text-xs">
                    {dept._count?.conversations ?? 0} convs
                  </Badge>
                </div>
                <div className="flex gap-1">
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(dept)}>
                    <Eye className="h-3.5 w-3.5" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setAddMemberDept(dept)}>
                    <UserPlus className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    variant="ghost" size="icon"
                    className="h-7 w-7 text-destructive hover:text-destructive"
                    onClick={() => setDeleteDept(dept)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
              {dept.description && (
                <p className="text-xs text-muted-foreground">{dept.description}</p>
              )}
              {dept.members?.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {dept.members.map((m: any) => (
                    <div key={m.id} className="flex items-center gap-1 bg-elevated rounded px-2 py-0.5 text-xs">
                      <span>{m.user?.name ?? m.user?.email}</span>
                      {m.is_lead && <Badge variant="outline" className="text-xs h-4 px-1">Lead</Badge>}
                      <button
                        className="ml-1 text-muted-foreground hover:text-destructive"
                        onClick={() => removeMemberMut.mutate({ deptId: dept.id, userId: m.user_id })}
                      >
                        <UserMinus className="h-3 w-3" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Create dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Nuevo departamento</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label className="text-xs">Nombre</Label>
              <Input value={name} onChange={e => setName(e.target.value)} placeholder="Soporte, Ventas..." />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Descripción (opcional)</Label>
              <Input value={description} onChange={e => setDescription(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Color</Label>
              <div className="flex items-center gap-2">
                <input type="color" value={color} onChange={e => setColor(e.target.value)} className="h-8 w-8 rounded cursor-pointer" />
                <span className="text-xs text-muted-foreground">{color}</span>
              </div>
            </div>
            <Button
              className="w-full"
              disabled={!name.trim() || createMut.isPending}
              onClick={() => createMut.mutate({ name, description: description || undefined, color })}
            >
              Crear
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit dialog */}
      <Dialog open={!!editDept} onOpenChange={v => { if (!v) setEditDept(null); }}>
        <DialogContent>
          <DialogHeader><DialogTitle>Editar departamento</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label className="text-xs">Nombre</Label>
              <Input value={name} onChange={e => setName(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Descripción</Label>
              <Input value={description} onChange={e => setDescription(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Color</Label>
              <div className="flex items-center gap-2">
                <input type="color" value={color} onChange={e => setColor(e.target.value)} className="h-8 w-8 rounded cursor-pointer" />
                <span className="text-xs text-muted-foreground">{color}</span>
              </div>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => updateMut.mutate({ id: editDept?.id, is_active: !editDept?.is_active })}
              >
                {editDept?.is_active ? <PowerOff className="h-4 w-4 mr-1" /> : <Plug className="h-4 w-4 mr-1" />}
                {editDept?.is_active ? "Desactivar" : "Activar"}
              </Button>
              <Button
                className="flex-1"
                disabled={!name.trim() || updateMut.isPending}
                onClick={() => updateMut.mutate({ id: editDept?.id, name, description: description || undefined, color })}
              >
                Guardar
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Add member dialog */}
      <Dialog open={!!addMemberDept} onOpenChange={v => { if (!v) { setAddMemberDept(null); setMemberUserId(""); } }}>
        <DialogContent>
          <DialogHeader><DialogTitle>Agregar miembro — {addMemberDept?.name}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label className="text-xs">Usuario</Label>
              <Select value={memberUserId} onValueChange={setMemberUserId}>
                <SelectTrigger><SelectValue placeholder="Seleccionar usuario" /></SelectTrigger>
                <SelectContent>
                  {allMembers.map((m: any) => (
                    <SelectItem key={m.user?.id ?? m.id} value={m.user?.id ?? m.id}>
                      {m.user?.name ?? m.name} ({m.user?.email ?? m.email})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button
              className="w-full"
              disabled={!memberUserId || addMemberMut.isPending}
              onClick={() => addMemberMut.mutate({ deptId: addMemberDept?.id, userId: memberUserId })}
            >
              Agregar
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete confirm */}
      <AlertDialog open={!!deleteDept} onOpenChange={v => { if (!v) setDeleteDept(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar departamento?</AlertDialogTitle>
            <AlertDialogDescription>
              Se eliminará <strong>{deleteDept?.name}</strong>. Las conversaciones y canales asociados perderán su departamento.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => deleteMut.mutate(deleteDept?.id)}
            >
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN
// ═══════════════════════════════════════════════════════════════════════════════

export default function Settings() {
  return (
    <div className="p-6 space-y-6">
      <PageHeader title="Configuración" />
      <Tabs defaultValue="workspace">
        <TabsList className="bg-card border border-border">
          <TabsTrigger value="workspace" className="data-[state=active]:bg-elevated">
            <Building2 className="h-4 w-4 mr-2" />Workspace
          </TabsTrigger>
          <TabsTrigger value="members" className="data-[state=active]:bg-elevated">
            <Users className="h-4 w-4 mr-2" />Miembros
          </TabsTrigger>
          <TabsTrigger value="channels" className="data-[state=active]:bg-elevated">
            <PlugZap className="h-4 w-4 mr-2" />Canales
          </TabsTrigger>
          <TabsTrigger value="departments" className="data-[state=active]:bg-elevated">
            <Layers className="h-4 w-4 mr-2" />Departamentos
          </TabsTrigger>
        </TabsList>
        <Card className="mt-4 bg-card border-border">
          <CardContent className="pt-6">
            <TabsContent value="workspace"><WorkspaceTab /></TabsContent>
            <TabsContent value="members"><MembersTab /></TabsContent>
            <TabsContent value="channels"><ChannelsTab /></TabsContent>
            <TabsContent value="departments"><DepartmentsTab /></TabsContent>
          </CardContent>
        </Card>
      </Tabs>
    </div>
  );
}
