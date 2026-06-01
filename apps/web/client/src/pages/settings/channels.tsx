import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { openExternal } from "@/lib/platform";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { Mail, MessageCircle, Radio, ExternalLink, PowerOff, Trash2, PlugZap, Plug, Bot, Send, Pencil, RefreshCw, Info } from "lucide-react";
import { SecretInput } from "@/components/settings/secret-input";
import { SettingsLayout } from "@/components/settings/settings-layout";

const CHANNEL_TYPE_COLORS: Record<string, string> = {
  EMAIL: "bg-blue-500/10 text-blue-400",
  WHATSAPP: "bg-green-500/10 text-green-400",
  TELEGRAM: "bg-sky-500/10 text-sky-400",
  FORM: "bg-purple-500/10 text-purple-400",
  API: "bg-orange-500/10 text-orange-400",
  MANUAL: "bg-gray-500/10 text-gray-400",
};

const CHANNEL_ICONS: Record<string, any> = {
  EMAIL: Mail,
  WHATSAPP: MessageCircle,
  TELEGRAM: Send,
  FORM: PlugZap,
  API: Plug,
  MANUAL: Radio,
};

type TelegramWebhookStatus = { url?: string; pending_update_count?: number; last_error_message?: string; last_error_date?: number };

function EmailConfigModal({ channel, onClose }: { channel: any; onClose: () => void }) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [apiKey, setApiKey] = useState("");
  const [fromEmail, setFromEmail] = useState(channel?.config?.from_email ?? "");
  const [inboundEmail, setInboundEmail] = useState(channel?.config?.inbound_email ?? "");
  const [fromName, setFromName] = useState(channel?.config?.from_name ?? "");
  const webhookUrl = `${window.location.origin}/api/inbound/email/webhook`;
  const resolvedInboundEmail = inboundEmail.trim() || fromEmail.trim();
  const workspaceHeader = channel?.workspace_id ?? "WORKSPACE_ID";

  const save = useMutation({
    mutationFn: () => api.configureEmail(channel.id, {
      api_key: apiKey || undefined,
      from_email: fromEmail,
      inbound_email: inboundEmail.trim() ? inboundEmail : undefined,
      from_name: fromName,
    }),
    onSuccess: () => {
      toast({ title: "Canal EMAIL guardado y activado" });
      qc.invalidateQueries({ queryKey: ["/api/channels"] });
      onClose();
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const isEdit = channel?.status !== "PENDING_SETUP";

  return (
    <div className="space-y-4 pt-2">
      <div className="p-3 rounded-lg bg-blue-500/10 border border-blue-500/20 text-xs text-blue-300">
        Obtené tu API key en{" "}
        <a href="https://resend.com/api-keys" target="_blank" rel="noreferrer"
          className="underline inline-flex items-center gap-1"
          onClick={(e) => { e.preventDefault(); void openExternal("https://resend.com/api-keys"); }}>
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
          Este correo se usa para enviar. Sin dominio propio usá <span className="font-mono">onboarding@resend.dev</span>.
        </p>
      </div>

      <div>
        <Label>Email receptor inbound <span className="text-muted-foreground font-normal">(opcional)</span></Label>
        <Input type="email" value={inboundEmail} onChange={e => setInboundEmail(e.target.value)}
          placeholder="inbox@tu-dominio.com" className="mt-1 bg-[hsl(var(--elevated))] border-border" />
        <p className="text-xs text-muted-foreground mt-1">
          Si lo dejás vacío, PymeHub enruta por <span className="font-mono">{fromEmail || "from_email"}</span>.
        </p>
      </div>

      <div>
        <Label>Nombre remitente</Label>
        <Input value={fromName} onChange={e => setFromName(e.target.value)}
          placeholder="PYMES CRM" className="mt-1 bg-[hsl(var(--elevated))] border-border" />
      </div>

      <div className="space-y-3 rounded-lg border border-border bg-[hsl(var(--elevated))] p-3 text-xs">
        <p className="font-medium text-foreground">Webhook de recepción</p>
        <p className="break-all rounded border border-border bg-background/60 px-2 py-1 font-mono text-[11px]">{webhookUrl}</p>
        <div className="grid gap-3 md:grid-cols-2">
          <div>
            <p className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground mb-1">Header requerido</p>
            <p className="rounded border border-border bg-background/60 px-2 py-1 font-mono text-[11px]">X-Workspace-Id: {workspaceHeader}</p>
          </div>
          <div>
            <p className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground mb-1">Header recomendado</p>
            <p className="rounded border border-border bg-background/60 px-2 py-1 font-mono text-[11px]">X-Channel-Id: {channel.id}</p>
          </div>
        </div>
        <p className="text-muted-foreground">Dirección inbound: <span className="font-mono text-foreground">{resolvedInboundEmail || "sin definir"}</span></p>
      </div>

      <Button onClick={() => save.mutate()}
        disabled={(!isEdit && !apiKey) || !fromEmail || !fromName || save.isPending}
        className="w-full bg-primary hover:bg-primary/90">
        {save.isPending ? "Guardando..." : isEdit ? "Guardar cambios" : "Guardar y activar canal"}
      </Button>
    </div>
  );
}

function WhatsAppConfigModal({ channel, onClose }: { channel: any; onClose: () => void }) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [accessToken, setAccessToken] = useState("");
  const [phoneNumberId, setPhoneNumberId] = useState(channel?.config?.phone_number_id ?? "");
  const [wabaId, setWabaId] = useState(channel?.config?.waba_id ?? "");
  const [appSecret, setAppSecret] = useState("");

  const save = useMutation({
    mutationFn: () => api.configureWhatsApp(channel.id, {
      access_token: accessToken || undefined,
      phone_number_id: phoneNumberId,
      waba_id: wabaId,
      app_secret: appSecret || undefined,
    }),
    onSuccess: () => {
      toast({ title: "Canal WhatsApp guardado y activado" });
      qc.invalidateQueries({ queryKey: ["/api/channels"] });
      onClose();
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const isEdit = channel?.status !== "PENDING_SETUP";

  return (
    <div className="space-y-4 pt-2">
      <div className="p-3 rounded-lg bg-green-500/10 border border-green-500/20 text-xs text-green-300">
        Obtené los datos en{" "}
        <a href="https://developers.facebook.com/apps" target="_blank" rel="noreferrer"
          className="underline inline-flex items-center gap-1"
          onClick={(e) => { e.preventDefault(); void openExternal("https://developers.facebook.com/apps"); }}>
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

      <div>
        <Label>App Secret {isEdit && <span className="text-muted-foreground font-normal">(dejá vacío para mantener el actual)</span>}</Label>
        <div className="mt-1">
          <SecretInput value={appSecret} onChange={setAppSecret} placeholder={isEdit ? "••••••••••••••••••••" : "abcdef123456..."} />
        </div>
        <p className="text-[10px] text-muted-foreground/60 mt-1">Meta Developers → Tu App → Settings → Basic → App Secret</p>
      </div>

      <div className="p-3 rounded-lg bg-[hsl(var(--elevated))] border border-border text-xs text-muted-foreground space-y-1">
        <p className="font-medium text-foreground">Webhook:</p>
        <p className="font-mono break-all">{`${window.location.origin}/api/inbound/whatsapp/webhook`}</p>
        <p>Token de verificación: <span className="font-mono">WHATSAPP_WEBHOOK_VERIFY_TOKEN</span></p>
      </div>

      <Button onClick={() => save.mutate()}
        disabled={(!isEdit && !accessToken) || !phoneNumberId || !wabaId || save.isPending}
        className="w-full bg-green-600 hover:bg-green-700">
        {save.isPending ? "Guardando..." : isEdit ? "Guardar cambios" : "Guardar y activar canal"}
      </Button>
    </div>
  );
}

function TelegramConfigModal({ channel, onClose }: { channel: any; onClose: () => void }) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [botToken, setBotToken] = useState("");
  const [webhookStatus, setWebhookStatus] = useState<TelegramWebhookStatus | null>(null);
  const [checkingStatus, setCheckingStatus] = useState(false);

  const save = useMutation({
    mutationFn: () => api.configureTelegram(channel.id, { bot_token: botToken || undefined }),
    onSuccess: () => {
      toast({ title: "Canal Telegram guardado y activado" });
      qc.invalidateQueries({ queryKey: ["/api/channels"] });
      onClose();
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const isEdit = channel?.status !== "PENDING_SETUP";

  const checkWebhookStatus = async () => {
    setCheckingStatus(true);
    try {
      const res = await api.getTelegramWebhookStatus(channel.id);
      setWebhookStatus(res?.data ?? res);
    } catch {
      setWebhookStatus(null);
      toast({ title: "Error al verificar webhook", variant: "destructive" });
    } finally {
      setCheckingStatus(false);
    }
  };

  return (
    <div className="space-y-4 pt-2">
      <div className="p-3 rounded-lg bg-sky-500/10 border border-sky-500/20 text-xs text-sky-300">
        Creá un bot en{" "}
        <a href="https://t.me/BotFather" target="_blank" rel="noreferrer"
          className="underline inline-flex items-center gap-1"
          onClick={(e) => { e.preventDefault(); void openExternal("https://t.me/BotFather"); }}>
          @BotFather <ExternalLink className="h-3 w-3" />
        </a>
        {" "}con <span className="font-mono">/newbot</span>, copiá el token y pegalo acá.
      </div>

      <div>
        <Label>Token del Bot {isEdit && <span className="text-muted-foreground font-normal">(dejá vacío para mantener el actual)</span>}</Label>
        <div className="mt-1">
          <SecretInput value={botToken} onChange={setBotToken}
            placeholder={isEdit ? "••••••••••••••••••••" : "1234567890:ABC-DEF1234ghIkl-zyx57W2v1u123ew11"} />
        </div>
      </div>

      {isEdit && (
        <div className="space-y-3 rounded-lg border border-border bg-[hsl(var(--elevated))] p-3 text-xs">
          <div className="flex items-center justify-between">
            <p className="font-medium text-foreground">Estado del webhook</p>
            <Button size="sm" variant="outline" className="h-6 text-[11px] border-border"
              onClick={checkWebhookStatus} disabled={checkingStatus}>
              <RefreshCw className={`h-3 w-3 mr-1 ${checkingStatus ? "animate-spin" : ""}`} />
              Verificar
            </Button>
          </div>
          {webhookStatus && (
            <div className="space-y-1 text-muted-foreground">
              <p>URL: <span className="font-mono text-[10px] break-all text-foreground">{webhookStatus.url || "—"}</span></p>
              <p>Pendientes: <span className={(webhookStatus.pending_update_count ?? 0) > 0 ? "text-yellow-400" : "text-green-400"}>{webhookStatus.pending_update_count ?? "—"}</span></p>
              {webhookStatus.last_error_message && <p className="text-red-400">Error: {webhookStatus.last_error_message}</p>}
              {!webhookStatus.last_error_message && webhookStatus.url && <p className="text-green-400">Webhook funcionando correctamente</p>}
            </div>
          )}
        </div>
      )}

      <Button onClick={() => save.mutate()}
        disabled={(!isEdit && !botToken) || save.isPending}
        className="w-full bg-sky-600 hover:bg-sky-700">
        {save.isPending ? "Guardando..." : isEdit ? "Guardar cambios" : "Guardar y activar canal"}
      </Button>
    </div>
  );
}

function GenericChannelEditModal({ channel, onClose }: { channel: any; onClose: () => void }) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [name, setName] = useState(channel?.name ?? "");

  const save = useMutation({
    mutationFn: () => api.updateChannel(channel.id, { name }),
    onSuccess: () => {
      toast({ title: "Canal actualizado" });
      qc.invalidateQueries({ queryKey: ["/api/channels"] });
      onClose();
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  return (
    <div className="space-y-4 pt-2">
      <div>
        <Label>Nombre del canal</Label>
        <Input value={name} onChange={e => setName(e.target.value)} className="mt-1 bg-[hsl(var(--elevated))] border-border" />
      </div>
      <Button onClick={() => save.mutate()} disabled={!name.trim() || save.isPending} className="w-full bg-primary hover:bg-primary/90">
        {save.isPending ? "Guardando..." : "Guardar cambios"}
      </Button>
    </div>
  );
}

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
          <AlertDialogAction onClick={() => del.mutate()} disabled={del.isPending}
            className="h-8 text-xs bg-destructive hover:bg-destructive/90">
            {del.isPending ? "Eliminando..." : "Eliminar"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

const EMPRENDE_PLANS = ["EMPRENDE", "STARTER", "GROWTH", "BUSINESS", "ENTERPRISE", "BUSINESS_PLUS"];

function AiAutoReplyToggle() {
  const { toast } = useToast();
  const qc = useQueryClient();

  const { data: workspace } = useQuery({
    queryKey: ["/api/workspaces/current"],
    queryFn: () => api.getWorkspace(),
  });

  const plan: string = workspace?.plan ?? "FREE";
  const isEligible = EMPRENDE_PLANS.includes(plan);
  const enabled = !!(workspace?.settings_json as any)?.ai_auto_reply_enabled;

  const toggle = useMutation({
    mutationFn: (value: boolean) => api.updateWorkspace({ settings_json: { ai_auto_reply_enabled: value } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/workspaces/current"] });
      toast({ title: "Configuración guardada" });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  if (!isEligible) return null;

  return (
    <div className="mb-6 rounded-lg border border-border bg-card p-4">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-primary/10">
            <Bot className="h-4 w-4 text-primary" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-medium text-foreground">IA responde automáticamente</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Cloudflare AI responde con el contexto de tu negocio. Cuando un agente escribe, toma el control.
            </p>
          </div>
        </div>
        <Switch checked={enabled} disabled={toggle.isPending} onCheckedChange={(v) => toggle.mutate(v)} className="shrink-0" />
      </div>
    </div>
  );
}

export default function ChannelsSettingsPage() {
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
  const isTG = configChannel?.type === "TELEGRAM";

  return (
    <SettingsLayout>
      <div>
        <AiAutoReplyToggle />

        <div className="flex justify-between items-center mb-4">
          <p className="text-sm text-muted-foreground">{channels.length} canal(es)</p>
          <Dialog open={createOpen} onOpenChange={setCreateOpen}>
            <DialogTrigger asChild>
              <Button size="sm" className="bg-primary hover:bg-primary/90">
                <Plug className="h-4 w-4 mr-2" />Nuevo canal
              </Button>
            </DialogTrigger>
            <DialogContent className="bg-card border-border">
              <DialogHeader><DialogTitle>Crear canal</DialogTitle></DialogHeader>
              <div className="space-y-3 pt-2">
                <div>
                  <Label>Nombre</Label>
                  <Input value={name} onChange={e => setName(e.target.value)}
                    placeholder="ej. Bot Atención al Cliente" className="mt-1 bg-[hsl(var(--elevated))] border-border" />
                </div>
                <div>
                  <Label>Tipo</Label>
                  <Select value={type} onValueChange={setType}>
                    <SelectTrigger className="mt-1 bg-[hsl(var(--elevated))] border-border"><SelectValue /></SelectTrigger>
                    <SelectContent className="bg-card border-border">
                      {["EMAIL", "WHATSAPP", "TELEGRAM", "FORM", "API", "MANUAL"].map(t => (
                        <SelectItem key={t} value={t}>{t}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <Button onClick={() => create.mutate()} disabled={!name || create.isPending} className="w-full bg-primary hover:bg-primary/90">
                  {create.isPending ? "Creando..." : "Crear canal"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        <Dialog open={!!configChannel} onOpenChange={open => { if (!open) setConfigChannel(null); }}>
          <DialogContent className="bg-card border-border max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                {isEmail ? <Mail className="h-4 w-4 text-blue-400" /> : isWA ? <MessageCircle className="h-4 w-4 text-green-400" /> : isTG ? <Send className="h-4 w-4 text-sky-400" /> : null}
                {configChannel?.status !== "PENDING_SETUP" ? "Editar" : "Configurar"} {configChannel?.type}
                <span className="text-muted-foreground font-normal text-sm ml-1">— {configChannel?.name}</span>
              </DialogTitle>
            </DialogHeader>
            {isEmail && <EmailConfigModal channel={configChannel} onClose={() => setConfigChannel(null)} />}
            {isWA && <WhatsAppConfigModal channel={configChannel} onClose={() => setConfigChannel(null)} />}
            {isTG && <TelegramConfigModal channel={configChannel} onClose={() => setConfigChannel(null)} />}
            {!isEmail && !isWA && !isTG && <GenericChannelEditModal channel={configChannel} onClose={() => setConfigChannel(null)} />}
          </DialogContent>
        </Dialog>

        {deleteChannel && (
          <DeleteChannelDialog channel={deleteChannel} onClose={() => setDeleteChannel(null)} />
        )}

        {isLoading ? (
          <div className="text-muted-foreground text-sm">Cargando...</div>
        ) : (
          <div className="space-y-2">
            {channels.map((ch: any) => {
              const Icon = CHANNEL_ICONS[ch.type] ?? Radio;
              const configurable = ch.type === "EMAIL" || ch.type === "WHATSAPP" || ch.type === "TELEGRAM";
              const needsConfig = ch.status === "PENDING_SETUP" && configurable;
              const canConnect = ch.status === "PENDING_SETUP" && !configurable;
              const isActive = ch.status === "ACTIVE";
              const canEdit = ch.status !== "PENDING_SETUP";

              const statusLabel = isActive ? "Activo" : ch.status === "INACTIVE" ? "Inactivo" : ch.status === "ERROR" ? "Error" : "Sin configurar";
              const statusClass = isActive
                ? "text-green-600 border-green-500/30 bg-green-500/5"
                : ch.status === "ERROR"
                  ? "text-red-500 border-red-500/30 bg-red-500/5"
                  : ch.status === "INACTIVE"
                    ? "text-muted-foreground border-border"
                    : "text-amber-500 border-amber-500/30 bg-amber-500/5";

              return (
                <div key={ch.id} className="flex items-center gap-3 p-3 rounded-lg bg-card border border-border min-w-0">
                  <Icon className="h-4 w-4 text-muted-foreground shrink-0" />

                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{ch.name}</p>
                    <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                      <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${CHANNEL_TYPE_COLORS[ch.type] ?? ""}`}>
                        {ch.type}
                      </Badge>
                      <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${statusClass}`}>
                        {statusLabel}
                      </Badge>
                    </div>
                    {ch.type === "WHATSAPP" && (
                      <p className="flex items-center gap-1 text-[10px] text-muted-foreground/60 mt-1">
                        <Info className="h-3 w-3 shrink-0" />
                        Plantillas cobradas directamente por Meta
                      </p>
                    )}
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    {needsConfig && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="flex items-center gap-1.5 text-xs"
                        title="Configurar canal" onClick={() => setConfigChannel(ch)}
                      >
                        <PlugZap className="h-3.5 w-3.5" />Configurar
                      </Button>
                    )}
                    {canConnect && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="flex items-center gap-1.5 text-xs"
                        title="Conectar canal"
                        onClick={() => api.connectChannel(ch.id).then(() => qc.invalidateQueries({ queryKey: ["/api/channels"] }))}
                      >
                        <Plug className="h-3.5 w-3.5" />Conectar
                      </Button>
                    )}
                    {canEdit && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="flex items-center gap-1.5 text-xs"
                        title="Editar canal" onClick={() => setConfigChannel(ch)}
                      >
                        <Pencil className="h-3.5 w-3.5" />Editar
                      </Button>
                    )}
                    {isActive && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 p-0 hover:bg-orange-500/10 hover:border-orange-500/30 text-muted-foreground hover:text-orange-400"
                        title="Desactivar canal" disabled={disconnect.isPending}
                        onClick={() => disconnect.mutate(ch.id)}
                      >
                        <PowerOff className="h-3.5 w-3.5" />
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 w-8 p-0 hover:bg-destructive/10 hover:border-destructive/30 text-muted-foreground hover:text-destructive"
                      title="Eliminar canal" onClick={() => setDeleteChannel(ch)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
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
    </SettingsLayout>
  );
}
