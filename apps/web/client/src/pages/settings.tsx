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
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useToast } from "@/hooks/use-toast";
import {
  Building2, Users, PlugZap, UserPlus, Plus, Plug,
  Mail, MessageCircle, Radio, Eye, EyeOff, ExternalLink,
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
        className="bg-[#151820] border-[#272d3f] pr-10 font-mono text-xs"
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
          <DialogContent className="bg-[#1c2030] border-[#272d3f]">
            <DialogHeader><DialogTitle>Invitar usuario</DialogTitle></DialogHeader>
            <div className="space-y-3 pt-2">
              <div>
                <Label>Email</Label>
                <Input value={email} onChange={e => setEmail(e.target.value)} placeholder="usuario@empresa.com" className="mt-1 bg-[#151820] border-[#272d3f]" />
              </div>
              <div>
                <Label>Rol</Label>
                <Select value={role} onValueChange={setRole}>
                  <SelectTrigger className="mt-1 bg-[#151820] border-[#272d3f]"><SelectValue /></SelectTrigger>
                  <SelectContent className="bg-[#1c2030] border-[#272d3f]">
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
            <div key={m.id} className="flex items-center justify-between p-3 rounded-lg bg-[#1c2030] border border-[#272d3f]">
              <div className="flex items-center gap-3">
                <Avatar className="h-8 w-8">
                  <AvatarFallback className="bg-[#272d3f] text-xs">{m.name?.[0]?.toUpperCase()}</AvatarFallback>
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

function EmailConfigModal({ channel, onClose }: { channel: any; onClose: () => void }) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [apiKey, setApiKey] = useState("");
  const [fromEmail, setFromEmail] = useState("");
  const [fromName, setFromName] = useState("");

  const save = useMutation({
    mutationFn: () => (api as any).configureEmail(channel.id, {
      api_key: apiKey, from_email: fromEmail, from_name: fromName,
    }),
    onSuccess: () => {
      toast({ title: "Canal EMAIL activado" });
      qc.invalidateQueries({ queryKey: ["/api/channels"] });
      onClose();
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  return (
    <div className="space-y-4 pt-2">
      <div className="p-3 rounded-lg bg-blue-500/10 border border-blue-500/20 text-xs text-blue-300">
        Obtené tu API key en{" "}
        <a href="https://resend.com/api-keys" target="_blank" rel="noreferrer" className="underline inline-flex items-center gap-1">
          resend.com/api-keys <ExternalLink className="h-3 w-3" />
        </a>
      </div>

      <div>
        <Label>API Key de Resend</Label>
        <div className="mt-1">
          <SecretInput value={apiKey} onChange={setApiKey} placeholder="re_xxxxxxxxxxxxxxxxxxxx" />
        </div>
      </div>

      <div>
        <Label>Email remitente</Label>
        <Input type="email" value={fromEmail} onChange={e => setFromEmail(e.target.value)}
          placeholder="onboarding@resend.dev" className="mt-1 bg-[#151820] border-[#272d3f]" />
        <p className="text-xs text-muted-foreground mt-1">
          Sin dominio propio usá <span className="font-mono">onboarding@resend.dev</span>
        </p>
      </div>

      <div>
        <Label>Nombre remitente</Label>
        <Input value={fromName} onChange={e => setFromName(e.target.value)}
          placeholder="PYMES CRM" className="mt-1 bg-[#151820] border-[#272d3f]" />
      </div>

      <Button
        onClick={() => save.mutate()}
        disabled={!apiKey || !fromEmail || !fromName || save.isPending}
        className="w-full bg-blue-600 hover:bg-blue-700"
      >
        {save.isPending ? "Activando..." : "Guardar y activar canal"}
      </Button>
    </div>
  );
}

function WhatsAppConfigModal({ channel, onClose }: { channel: any; onClose: () => void }) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [accessToken, setAccessToken] = useState("");
  const [phoneNumberId, setPhoneNumberId] = useState("");
  const [wabaId, setWabaId] = useState("");

  const save = useMutation({
    mutationFn: () => (api as any).configureWhatsApp(channel.id, {
      access_token: accessToken, phone_number_id: phoneNumberId, waba_id: wabaId,
    }),
    onSuccess: () => {
      toast({ title: "Canal WhatsApp activado" });
      qc.invalidateQueries({ queryKey: ["/api/channels"] });
      onClose();
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

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
        <Label>Access Token</Label>
        <div className="mt-1">
          <SecretInput value={accessToken} onChange={setAccessToken} placeholder="EAAxxxxxxxxxx..." />
        </div>
      </div>

      <div>
        <Label>Phone Number ID</Label>
        <Input value={phoneNumberId} onChange={e => setPhoneNumberId(e.target.value)}
          placeholder="123456789012345" className="mt-1 bg-[#151820] border-[#272d3f] font-mono text-xs" />
      </div>

      <div>
        <Label>WhatsApp Business Account ID</Label>
        <Input value={wabaId} onChange={e => setWabaId(e.target.value)}
          placeholder="987654321098765" className="mt-1 bg-[#151820] border-[#272d3f] font-mono text-xs" />
      </div>

      <div className="p-3 rounded-lg bg-[#151820] border border-[#272d3f] text-xs text-muted-foreground space-y-1">
        <p className="font-medium text-foreground">Webhook para Meta Developers:</p>
        <p className="font-mono break-all">https://tu-dominio.com/api/inbound/whatsapp/webhook</p>
        <p>Token de verificación: el valor de <span className="font-mono">WHATSAPP_WEBHOOK_VERIFY_TOKEN</span> en tu .env</p>
      </div>

      <Button
        onClick={() => save.mutate()}
        disabled={!accessToken || !phoneNumberId || !wabaId || save.isPending}
        className="w-full bg-green-600 hover:bg-green-700"
      >
        {save.isPending ? "Activando..." : "Guardar y activar canal"}
      </Button>
    </div>
  );
}

function ChannelsTab() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);
  const [configChannel, setConfigChannel] = useState<any>(null);
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
          <DialogContent className="bg-[#1c2030] border-[#272d3f]">
            <DialogHeader><DialogTitle>Crear canal</DialogTitle></DialogHeader>
            <div className="space-y-3 pt-2">
              <div>
                <Label>Nombre</Label>
                <Input value={name} onChange={e => setName(e.target.value)} placeholder="ej. Correo Principal" className="mt-1 bg-[#151820] border-[#272d3f]" />
              </div>
              <div>
                <Label>Tipo</Label>
                <Select value={type} onValueChange={setType}>
                  <SelectTrigger className="mt-1 bg-[#151820] border-[#272d3f]"><SelectValue /></SelectTrigger>
                  <SelectContent className="bg-[#1c2030] border-[#272d3f]">
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
        <DialogContent className="bg-[#1c2030] border-[#272d3f] max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {isEmail ? <Mail className="h-4 w-4 text-blue-400" /> : <MessageCircle className="h-4 w-4 text-green-400" />}
              Configurar {configChannel?.type}
              <span className="text-muted-foreground font-normal text-sm ml-1">— {configChannel?.name}</span>
            </DialogTitle>
          </DialogHeader>
          {isEmail && <EmailConfigModal channel={configChannel} onClose={() => setConfigChannel(null)} />}
          {isWA && <WhatsAppConfigModal channel={configChannel} onClose={() => setConfigChannel(null)} />}
        </DialogContent>
      </Dialog>

      {/* Lista */}
      {isLoading ? (
        <div className="text-muted-foreground text-sm">Cargando...</div>
      ) : (
        <div className="space-y-2">
          {channels.map((ch: any) => {
            const Icon = CHANNEL_ICONS[ch.type] ?? Radio;
            const needsConfig = ch.status !== "ACTIVE" && (ch.type === "EMAIL" || ch.type === "WHATSAPP");
            const canConnect = ch.status !== "ACTIVE" && !needsConfig;

            return (
              <div key={ch.id} className="flex items-center justify-between p-3 rounded-lg bg-[#1c2030] border border-[#272d3f]">
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
                    ch.status === "ACTIVE"
                      ? "text-green-400 border-green-500/30"
                      : "text-gray-400 border-gray-500/30"
                  }>
                    {ch.status === "ACTIVE" ? "Activo" : ch.status}
                  </Badge>

                  {needsConfig && (
                    <Button size="sm" variant="outline"
                      className={`h-7 text-xs ${ch.type === "EMAIL" ? "border-blue-500/30 text-blue-400" : "border-green-500/30 text-green-400"}`}
                      onClick={() => setConfigChannel(ch)}
                    >
                      <PlugZap className="h-3 w-3 mr-1" />Configurar
                    </Button>
                  )}

                  {ch.status === "ACTIVE" && (ch.type === "EMAIL" || ch.type === "WHATSAPP") && (
                    <Button size="sm" variant="outline"
                      className="h-7 text-xs border-[#272d3f] text-muted-foreground"
                      onClick={() => setConfigChannel(ch)}
                    >
                      Editar
                    </Button>
                  )}

                  {canConnect && (
                    <Button size="sm" variant="outline" className="h-7 text-xs border-[#272d3f]"
                      onClick={() => api.connectChannel(ch.id).then(() => qc.invalidateQueries({ queryKey: ["/api/channels"] }))}
                    >
                      <Plug className="h-3 w-3 mr-1" />Conectar
                    </Button>
                  )}
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
// MAIN
// ═══════════════════════════════════════════════════════════════════════════════

export default function Settings() {
  return (
    <div className="p-6 space-y-6">
      <PageHeader title="Configuración" />
      <Tabs defaultValue="workspace">
        <TabsList className="bg-[#1c2030] border border-[#272d3f]">
          <TabsTrigger value="workspace" className="data-[state=active]:bg-[#272d3f]">
            <Building2 className="h-4 w-4 mr-2" />Workspace
          </TabsTrigger>
          <TabsTrigger value="members" className="data-[state=active]:bg-[#272d3f]">
            <Users className="h-4 w-4 mr-2" />Miembros
          </TabsTrigger>
          <TabsTrigger value="channels" className="data-[state=active]:bg-[#272d3f]">
            <PlugZap className="h-4 w-4 mr-2" />Canales
          </TabsTrigger>
        </TabsList>
        <Card className="mt-4 bg-[#1c2030] border-[#272d3f]">
          <CardContent className="pt-6">
            <TabsContent value="workspace"><WorkspaceTab /></TabsContent>
            <TabsContent value="members"><MembersTab /></TabsContent>
            <TabsContent value="channels"><ChannelsTab /></TabsContent>
          </CardContent>
        </Card>
      </Tabs>
    </div>
  );
}
