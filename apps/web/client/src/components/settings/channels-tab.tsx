import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Plug, PlugZap, PowerOff, Trash2, Mail, MessageCircle, ExternalLink, Radio, Send, RefreshCw } from "lucide-react";
import { api } from "@/lib/api";
import { openExternal } from "@/lib/platform";
import { useToast } from "@/hooks/use-toast";
import { SecretInput } from "@/components/settings/secret-input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";

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

function EmailConfigModal({ channel, onClose }: { channel: Record<string, any>; onClose: () => void }) {
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
    onError: (e) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const isEdit = channel?.status === "ACTIVE";

  return (
    <div className="space-y-4 pt-2">
      <div className="p-3 rounded-lg bg-blue-500/10 border border-blue-500/20 text-xs text-blue-300">
        Obtené tu API key en{" "}
        <a
          href="https://resend.com/api-keys"
          target="_blank"
          rel="noreferrer"
          className="underline inline-flex items-center gap-1"
          onClick={(event) => {
            event.preventDefault();
            void openExternal("https://resend.com/api-keys");
          }}
        >
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
        <Input
          type="email"
          value={inboundEmail}
          onChange={e => setInboundEmail(e.target.value)}
          placeholder="inbox@tu-dominio.com"
          className="mt-1 bg-[hsl(var(--elevated))] border-border"
        />
        <p className="text-xs text-muted-foreground mt-1">
          Si lo dejás vacío, PymeHub enruta por <span className="font-mono">{fromEmail || "from_email"}</span>. Si usás un buzón distinto para recibir, ponelo aquí.
        </p>
      </div>

      <div>
        <Label>Nombre remitente</Label>
        <Input value={fromName} onChange={e => setFromName(e.target.value)}
          placeholder="PYMES CRM" className="mt-1 bg-[hsl(var(--elevated))] border-border" />
      </div>

      <div className="space-y-3 rounded-lg border border-border bg-[hsl(var(--elevated))] p-3 text-xs">
        <div>
          <p className="font-medium text-foreground">Recepción de correos en PymeHub</p>
          <p className="mt-1 text-muted-foreground">
            Resend debe mandar los correos entrantes a este webhook para que aparezcan en el inbox del workspace.
          </p>
        </div>

        <div className="space-y-1">
          <p className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">Webhook URL</p>
          <p className="break-all rounded border border-border bg-background/60 px-2 py-1 font-mono text-[11px] text-foreground">
            {webhookUrl}
          </p>
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          <div className="space-y-1">
            <p className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">Header requerido</p>
            <p className="rounded border border-border bg-background/60 px-2 py-1 font-mono text-[11px] text-foreground">
              X-Workspace-Id: {workspaceHeader}
            </p>
          </div>
          <div className="space-y-1">
            <p className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">Header recomendado</p>
            <p className="rounded border border-border bg-background/60 px-2 py-1 font-mono text-[11px] text-foreground">
              X-Channel-Id: {channel.id}
            </p>
          </div>
        </div>

        <div className="rounded border border-blue-500/20 bg-blue-500/10 px-3 py-2 text-blue-200">
          <p>
            Dirección inbound activa: <span className="font-mono">{resolvedInboundEmail || "sin definir"}</span>
          </p>
          <p className="mt-1 text-blue-100/80">
            Recomendado si tienes varios buzones: configurar esta dirección en Resend y además enviar <span className="font-mono">X-Channel-Id</span>.
          </p>
        </div>
      </div>

      <Button
        onClick={() => save.mutate()}
        disabled={(!isEdit && !apiKey) || !fromEmail || !fromName || save.isPending}
        className="w-full bg-primary hover:bg-primary/90"
      >
        {save.isPending ? "Guardando..." : isEdit ? "Guardar cambios" : "Guardar y activar canal"}
      </Button>
    </div>
  );
}

function WhatsAppConfigModal({ channel, onClose }: { channel: Record<string, any>; onClose: () => void }) {
  const { toast } = useToast();
  const qc = useQueryClient();
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
    onError: (e) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const isEdit = channel?.status === "ACTIVE";

  return (
    <div className="space-y-4 pt-2">
      <div className="p-3 rounded-lg bg-green-500/10 border border-green-500/20 text-xs text-green-300">
        Obtené los datos en{" "}
        <a
          href="https://developers.facebook.com/apps"
          target="_blank"
          rel="noreferrer"
          className="underline inline-flex items-center gap-1"
          onClick={(event) => {
            event.preventDefault();
            void openExternal("https://developers.facebook.com/apps");
          }}
        >
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

function TelegramConfigModal({ channel, onClose }: { channel: Record<string, any>; onClose: () => void }) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [botToken, setBotToken] = useState("");
  const [webhookStatus, setWebhookStatus] = useState<any>(null);
  const [checkingStatus, setCheckingStatus] = useState(false);

  const save = useMutation({
    mutationFn: () => api.configureTelegram(channel.id, { bot_token: botToken || undefined }),
    onSuccess: () => {
      toast({ title: "Canal Telegram guardado y activado" });
      qc.invalidateQueries({ queryKey: ["/api/channels"] });
      onClose();
    },
    onError: (e) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const isEdit = channel?.status === "ACTIVE";

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
        <a
          href="https://t.me/BotFather"
          target="_blank"
          rel="noreferrer"
          className="underline inline-flex items-center gap-1"
          onClick={(event) => {
            event.preventDefault();
            void openExternal("https://t.me/BotFather");
          }}
        >
          @BotFather <ExternalLink className="h-3 w-3" />
        </a>
        {" "}con <span className="font-mono">/newbot</span>, copiá el token y pegalo acá.
      </div>

      <div>
        <Label>Token del Bot {isEdit && <span className="text-muted-foreground font-normal">(dejá vacío para mantener el actual)</span>}</Label>
        <div className="mt-1">
          <SecretInput
            value={botToken}
            onChange={setBotToken}
            placeholder={isEdit ? "••••••••••••••••••••" : "1234567890:ABC-DEF1234ghIkl-zyx57W2v1u123ew11"}
          />
        </div>
        <p className="text-xs text-muted-foreground mt-1">
          El token se encripta al guardarse. Nunca lo compartas.
        </p>
      </div>

      {isEdit && (
        <div className="space-y-3 rounded-lg border border-border bg-[hsl(var(--elevated))] p-3 text-xs">
          <div className="flex items-center justify-between">
            <p className="font-medium text-foreground">Estado del webhook</p>
            <Button
              size="sm"
              variant="outline"
              className="h-6 text-[11px] border-border"
              onClick={checkWebhookStatus}
              disabled={checkingStatus}
            >
              <RefreshCw className={`h-3 w-3 mr-1 ${checkingStatus ? "animate-spin" : ""}`} />
              Verificar
            </Button>
          </div>
          {webhookStatus && (
            <div className="space-y-1 text-muted-foreground">
              <p>
                URL:{" "}
                <span className="font-mono text-[10px] break-all text-foreground">
                  {webhookStatus.url || "—"}
                </span>
              </p>
              <p>
                Pendientes:{" "}
                <span className={webhookStatus.pending_update_count > 0 ? "text-yellow-400" : "text-green-400"}>
                  {webhookStatus.pending_update_count ?? "—"}
                </span>
              </p>
              {webhookStatus.last_error_message && (
                <p className="text-red-400">
                  Error: {webhookStatus.last_error_message}
                </p>
              )}
              {webhookStatus.last_error_date && (
                <p className="text-red-400">
                  Último error: {new Date(webhookStatus.last_error_date * 1000).toLocaleString("es-CR")}
                </p>
              )}
              {!webhookStatus.last_error_message && webhookStatus.url && (
                <p className="text-green-400">✅ Webhook funcionando correctamente</p>
              )}
            </div>
          )}
          {!webhookStatus && !checkingStatus && (
            <p className="text-muted-foreground">Presioná "Verificar" para chequear el estado del webhook.</p>
          )}
        </div>
      )}

      <div className="p-3 rounded-lg bg-[hsl(var(--elevated))] border border-border text-xs text-muted-foreground space-y-1">
        <p className="font-medium text-foreground">¿Cómo funciona?</p>
        <p>
          Cuando alguien le escribe al bot en Telegram, PymesHub recibe el mensaje vía webhook
          y crea una conversación automáticamente en tu bandeja de entrada.
        </p>
        <p className="mt-1">
          Tipos soportados: texto, fotos, documentos, videos, audios y mensajes de voz.
        </p>
      </div>

      <Button
        onClick={() => save.mutate()}
        disabled={(!isEdit && !botToken) || save.isPending}
        className="w-full bg-sky-600 hover:bg-sky-700"
      >
        {save.isPending ? "Guardando..." : isEdit ? "Guardar cambios" : "Guardar y activar canal"}
      </Button>
    </div>
  );
}

function DeleteChannelDialog({ channel, onClose }: { channel: Record<string, any>; onClose: () => void }) {
  const { toast } = useToast();
  const qc = useQueryClient();

  const del = useMutation({
    mutationFn: () => api.deleteChannel(channel.id),
    onSuccess: () => {
      toast({ title: "Canal eliminado" });
      qc.invalidateQueries({ queryKey: ["/api/channels"] });
      onClose();
    },
    onError: (e) => toast({ title: "Error", description: e.message, variant: "destructive" }),
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

export function ChannelsTab() {
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
    onError: (e) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const disconnect = useMutation({
    mutationFn: (id: string) => api.disconnectChannel(id),
    onSuccess: () => {
      toast({ title: "Canal desactivado" });
      qc.invalidateQueries({ queryKey: ["/api/channels"] });
    },
    onError: (e) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const channels = Array.isArray(data) ? data : [];
  const isEmail = configChannel?.type === "EMAIL";
  const isWA = configChannel?.type === "WHATSAPP";
  const isTG = configChannel?.type === "TELEGRAM";

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <p className="text-sm text-muted-foreground">{channels.length} canal(es)</p>

        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger asChild>
            <Button size="sm" className="bg-primary hover:bg-primary/90">
              <Plus className="h-4 w-4 mr-2" />Nuevo canal
            </Button>
          </DialogTrigger>
          <DialogContent className="bg-card border-border">
            <DialogHeader><DialogTitle>Crear canal</DialogTitle></DialogHeader>
            <div className="space-y-3 pt-2">
              <div>
                <Label>Nombre</Label>
                <Input value={name} onChange={e => setName(e.target.value)} placeholder="ej. Bot Atención al Cliente" className="mt-1 bg-[hsl(var(--elevated))] border-border" />
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
              {configChannel?.status === "ACTIVE" ? "Editar" : "Configurar"} {configChannel?.type}
              <span className="text-muted-foreground font-normal text-sm ml-1">— {configChannel?.name}</span>
            </DialogTitle>
          </DialogHeader>
          {isEmail && <EmailConfigModal channel={configChannel} onClose={() => setConfigChannel(null)} />}
          {isWA && <WhatsAppConfigModal channel={configChannel} onClose={() => setConfigChannel(null)} />}
          {isTG && <TelegramConfigModal channel={configChannel} onClose={() => setConfigChannel(null)} />}
        </DialogContent>
      </Dialog>

      {deleteChannel && (
        <DeleteChannelDialog channel={deleteChannel} onClose={() => setDeleteChannel(null)} />
      )}

      {isLoading ? (
        <div className="text-muted-foreground text-sm">Cargando...</div>
      ) : (
        <div className="space-y-2">
          {channels.map((ch) => {
            const Icon = CHANNEL_ICONS[ch.type] ?? Radio;
            const needsConfig = ch.status !== "ACTIVE" && (ch.type === "EMAIL" || ch.type === "WHATSAPP" || ch.type === "TELEGRAM");
            const canConnect = ch.status !== "ACTIVE" && !needsConfig;
            const isActive = ch.status === "ACTIVE";
            const canEdit = isActive && (ch.type === "EMAIL" || ch.type === "WHATSAPP" || ch.type === "TELEGRAM");

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

                  {needsConfig && (
                    <Button size="sm" variant="outline"
                      className={`h-7 text-xs ${ch.type === "EMAIL" ? "border-blue-500/30 text-blue-400" : ch.type === "WHATSAPP" ? "border-green-500/30 text-green-400" : "border-sky-500/30 text-sky-400"}`}
                      onClick={() => setConfigChannel(ch)}
                    >
                      <PlugZap className="h-3 w-3 mr-1" />Configurar
                    </Button>
                  )}

                  {canEdit && (
                    <Button size="sm" variant="outline"
                      className="h-7 text-xs border-border text-muted-foreground hover:text-foreground"
                      onClick={() => setConfigChannel(ch)}
                    >
                      Editar
                    </Button>
                  )}

                  {canConnect && (
                    <Button size="sm" variant="outline" className="h-7 text-xs border-border"
                      onClick={() => api.connectChannel(ch.id).then(() => qc.invalidateQueries({ queryKey: ["/api/channels"] }))}
                    >
                      <Plug className="h-3 w-3 mr-1" />Conectar
                    </Button>
                  )}

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
