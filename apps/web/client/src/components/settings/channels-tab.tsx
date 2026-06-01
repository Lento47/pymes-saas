import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Plug, PlugZap, PowerOff, Trash2, Mail, MessageCircle, ExternalLink, Radio, Send, RefreshCw, Pencil, Copy, Loader2, CheckCircle2, AlertCircle, Bot, Webhook, Play, Zap, Mic, FileText, Image, ShieldCheck, Users, Info } from "lucide-react";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";

type Channel = { id: string; name: string; type: string; status: string; config?: Record<string, string>; workspace_id?: string };
type TelegramWebhookStatus = { url?: string; pending_update_count?: number; last_error_message?: string; last_error_date?: number };

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

  const isEdit = channel?.status !== "PENDING_SETUP";

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
  const [appSecret, setAppSecret] = useState("");
  const [phoneNumberId, setPhoneNumberId] = useState(channel?.config?.phone_number_id ?? "");
  const [wabaId, setWabaId] = useState(channel?.config?.waba_id ?? "");

  const save = useMutation({
    mutationFn: () => api.configureWhatsApp(channel.id, {
      access_token: accessToken || undefined,
      app_secret: appSecret || undefined,
      phone_number_id: phoneNumberId,
      waba_id: wabaId,
    }),
    onSuccess: () => {
      toast({ title: "Canal WhatsApp guardado y activado" });
      qc.invalidateQueries({ queryKey: ["/api/channels"] });
      onClose();
    },
    onError: (e) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const isEdit = channel?.status !== "PENDING_SETUP";

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

      <div>
        <Label>App Secret {isEdit && <span className="text-muted-foreground font-normal">(dejá vacío para mantener el actual)</span>}</Label>
        <p className="text-[10px] text-muted-foreground/60 mb-1">Meta Developers → Tu App → Settings → Basic → App Secret (opcional, para verificar webhooks)</p>
        <div className="mt-1">
          <SecretInput value={appSecret} onChange={setAppSecret} placeholder={isEdit ? "••••••••••••••••••••" : "abcdef123456..."} />
        </div>
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
  const [webhookStatus, setWebhookStatus] = useState<TelegramWebhookStatus | null>(null);
  const [checkingStatus, setCheckingStatus] = useState(false);
  const [activeTab, setActiveTab] = useState<"config" | "webhook" | "bot" | "test" | "potencial">("config");
  const [botInfo, setBotInfo] = useState<Record<string, any> | null>(null);
  const [checkingBot, setCheckingBot] = useState(false);
  const [testChatId, setTestChatId] = useState("");
  const [testMessage, setTestMessage] = useState("✓ Webhook de Telegram funciona correctamente");
  const [sendingTest, setSendingTest] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; message?: string } | null>(null);
  const [registering, setRegistering] = useState(false);

  const isEdit = channel?.status !== "PENDING_SETUP";

  const save = useMutation({
    mutationFn: () => api.configureTelegram(channel.id, { bot_token: botToken || undefined }),
    onSuccess: () => {
      toast({ title: "Canal Telegram guardado y activado" });
      qc.invalidateQueries({ queryKey: ["/api/channels"] });
      onClose();
    },
    onError: (e) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

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

  const registerWebhook = async () => {
    setRegistering(true);
    try {
      const res = await api.registerTelegramWebhook(channel.id);
      toast({ title: "Webhook registrado", description: res?.message || "Listo" });
      await checkWebhookStatus();
      setActiveTab("webhook");
    } catch (e: any) {
      toast({ title: "Error al registrar", description: e.message, variant: "destructive" });
    } finally {
      setRegistering(false);
    }
  };

  const loadBotInfo = async () => {
    setCheckingBot(true);
    try {
      const res = await api.getTelegramBotInfo(channel.id);
      setBotInfo(res?.data ?? res);
    } catch {
      setBotInfo(null);
      toast({ title: "Error al obtener info del bot", variant: "destructive" });
    } finally {
      setCheckingBot(false);
    }
  };

  const sendTest = async () => {
    if (!testChatId.trim()) {
      toast({ title: "Chat ID requerido", description: "Usá @userinfobot en Telegram para obtener el ID del chat de prueba", variant: "destructive" });
      return;
    }
    setSendingTest(true);
    setTestResult(null);
    try {
      const res = await api.sendTelegramTestMessage(channel.id, testChatId.trim(), testMessage.trim() || undefined);
      setTestResult({ ok: true, message: res?.message });
      toast({ title: "Mensaje de prueba enviado", description: "Revisá el chat en Telegram" });
    } catch (e: any) {
      setTestResult({ ok: false, message: e.message });
      toast({ title: "Error enviando prueba", description: e.message, variant: "destructive" });
    } finally {
      setSendingTest(false);
    }
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text).then(() => {
      toast({ title: `${label} copiado` });
    });
  };

  return (
    <div className="space-y-4 pt-1">
      {/* Hero banner */}
      <div className="flex items-center gap-3 rounded-xl border border-sky-500/20 bg-gradient-to-r from-sky-500/10 to-transparent p-4">
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-sky-500/20">
          <Send className="h-5 w-5 text-sky-400" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="font-semibold text-foreground">Telegram — Potencial ilimitado para tu negocio</p>
            <Badge variant="outline" className="text-[10px] border-sky-500/30 text-sky-400">Sin costo por mensaje</Badge>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            Webhooks seguros • Keyboards interactivos • Voz nativa • Media rico • Edición de mensajes
          </p>
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="text-sky-400 hover:text-sky-300"
          onClick={() => openExternal("https://t.me/BotFather")}
        >
          <ExternalLink className="h-3.5 w-3.5 mr-1" /> BotFather
        </Button>
      </div>

      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)} className="w-full">
        <TabsList className="grid w-full grid-cols-5 bg-[hsl(var(--elevated))] border border-border p-1 rounded-lg">
          <TabsTrigger value="config" className="text-xs data-[state=active]:bg-background data-[state=active]:shadow-sm">
            <Bot className="h-3.5 w-3.5 mr-1" /> Config
          </TabsTrigger>
          <TabsTrigger value="webhook" className="text-xs data-[state=active]:bg-background data-[state=active]:shadow-sm">
            <Webhook className="h-3.5 w-3.5 mr-1" /> Webhook
          </TabsTrigger>
          <TabsTrigger value="bot" className="text-xs data-[state=active]:bg-background data-[state=active]:shadow-sm">
            <Info className="h-3.5 w-3.5 mr-1" /> Bot Info
          </TabsTrigger>
          <TabsTrigger value="test" className="text-xs data-[state=active]:bg-background data-[state=active]:shadow-sm">
            <Play className="h-3.5 w-3.5 mr-1" /> Probar
          </TabsTrigger>
          <TabsTrigger value="potencial" className="text-xs data-[state=active]:bg-background data-[state=active]:shadow-sm">
            <Zap className="h-3.5 w-3.5 mr-1" /> Potencial
          </TabsTrigger>
        </TabsList>

        {/* CONFIG TAB */}
        <TabsContent value="config" className="space-y-4 mt-4">
          <Card className="border-border bg-[hsl(var(--elevated))]">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <Bot className="h-4 w-4 text-sky-400" /> Token del Bot
              </CardTitle>
              <CardDescription className="text-xs">
                {isEdit ? "Actualizá el token solo si rotaste el bot en @BotFather" : "Pegá el token que te dio @BotFather"}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <Label className="text-xs text-muted-foreground">API Token</Label>
                <div className="mt-1.5">
                  <SecretInput
                    value={botToken}
                    onChange={setBotToken}
                    placeholder={isEdit ? "••••••••••••••••••••" : "1234567890:ABC-DEF1234ghIkl-zyx57W2v1u123ew11"}
                  />
                </div>
                <p className="text-[10px] text-muted-foreground mt-1.5 flex items-center gap-1">
                  <ShieldCheck className="h-3 w-3" /> Se encripta con ENCRYPTION_KEY del servidor. Nunca lo compartas.
                </p>
              </div>

              <Button
                onClick={() => save.mutate()}
                disabled={(!isEdit && !botToken) || save.isPending}
                className="w-full bg-primary hover:bg-primary/90 text-primary-foreground h-9"
              >
                {save.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                {save.isPending ? "Guardando..." : isEdit ? "Guardar cambios y reconectar" : "Guardar y activar canal"}
              </Button>
            </CardContent>
          </Card>

          <Alert className="border-sky-500/30 bg-sky-500/5">
            <AlertDescription className="text-xs text-sky-300">
              Después de guardar, andá a la pestaña <span className="font-medium">Webhook</span> para registrar el endpoint y verificar el estado.
            </AlertDescription>
          </Alert>
        </TabsContent>

        {/* WEBHOOK TAB */}
        <TabsContent value="webhook" className="space-y-4 mt-4">
          <Card className="border-border bg-[hsl(var(--elevated))]">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Webhook className="h-4 w-4 text-sky-400" /> Estado del Webhook
                </CardTitle>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 text-xs border-border"
                    onClick={registerWebhook}
                    disabled={registering || !isEdit}
                  >
                    {registering ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Webhook className="h-3 w-3 mr-1" />}
                    Registrar / Actualizar
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 text-xs border-border"
                    onClick={checkWebhookStatus}
                    disabled={checkingStatus}
                  >
                    <RefreshCw className={`h-3 w-3 mr-1 ${checkingStatus ? "animate-spin" : ""}`} />
                    Refrescar
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {!isEdit && (
                <Alert variant="default" className="border-amber-500/30 bg-amber-500/10">
                  <AlertDescription className="text-xs">Guardá y activá el canal primero para poder registrar el webhook.</AlertDescription>
                </Alert>
              )}

              {webhookStatus && (
                <div className="space-y-3 text-sm">
                  <div className="flex items-start justify-between gap-3 rounded-lg border border-border bg-background/40 p-3 font-mono text-[10px]">
                    <div className="break-all text-foreground/90 flex-1">{webhookStatus.url || "—"}</div>
                    {webhookStatus.url && (
                      <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0" onClick={() => copyToClipboard(webhookStatus.url!, "URL del webhook")}>
                        <Copy className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="rounded-lg border border-border p-3">
                      <div className="text-[10px] uppercase tracking-widest text-muted-foreground">Pendientes</div>
                      <div className={`mt-1 text-2xl font-semibold tabular-nums ${(webhookStatus.pending_update_count ?? 0) > 0 ? "text-amber-400" : "text-emerald-400"}`}>
                        {webhookStatus.pending_update_count ?? "0"}
                      </div>
                      <div className="text-[10px] text-muted-foreground">updates en cola de Telegram</div>
                    </div>
                    <div className="rounded-lg border border-border p-3">
                      <div className="text-[10px] uppercase tracking-widest text-muted-foreground">Último error</div>
                      <div className="mt-1 text-sm text-red-400 line-clamp-2 min-h-[2.5rem]">
                        {webhookStatus.last_error_message || "Ninguno"}
                      </div>
                      {webhookStatus.last_error_date && (
                        <div className="text-[10px] text-muted-foreground mt-0.5">
                          {new Date(webhookStatus.last_error_date * 1000).toLocaleString("es-CR")}
                        </div>
                      )}
                    </div>
                  </div>

                  {!webhookStatus.last_error_message && webhookStatus.url && (
                    <div className="flex items-center gap-2 rounded-md border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-emerald-400 text-xs">
                      <CheckCircle2 className="h-4 w-4" /> Webhook activo y verificado por Telegram
                    </div>
                  )}
                </div>
              )}

              {!webhookStatus && !checkingStatus && isEdit && (
                <div className="text-center py-6 text-muted-foreground text-xs">
                  Presioná <span className="font-medium text-foreground">Registrar</span> o <span className="font-medium text-foreground">Refrescar</span> para ver el estado.
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* BOT INFO TAB */}
        <TabsContent value="bot" className="space-y-4 mt-4">
          <Card className="border-border bg-[hsl(var(--elevated))]">
            <CardHeader className="pb-2 flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-sm flex items-center gap-2"><Bot className="h-4 w-4 text-sky-400" /> Información del Bot</CardTitle>
                <CardDescription className="text-xs">Datos devueltos por Telegram (getMe)</CardDescription>
              </div>
              <Button size="sm" variant="outline" onClick={loadBotInfo} disabled={checkingBot || !isEdit} className="border-border h-7 text-xs">
                {checkingBot ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <RefreshCw className="h-3 w-3 mr-1" />} Cargar / Actualizar
              </Button>
            </CardHeader>
            <CardContent>
              {botInfo ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                  <div className="space-y-1 rounded border border-border p-3 bg-background/30">
                    <div className="text-[10px] text-muted-foreground">Nombre</div>
                    <div className="font-medium text-foreground">{botInfo.first_name || "—"}</div>
                  </div>
                  <div className="space-y-1 rounded border border-border p-3 bg-background/30">
                    <div className="text-[10px] text-muted-foreground">Username</div>
                    <div className="font-mono text-sky-400 flex items-center gap-1">@{botInfo.username || "—"}</div>
                  </div>
                  <div className="space-y-1 rounded border border-border p-3 bg-background/30">
                    <div className="text-[10px] text-muted-foreground">ID del Bot</div>
                    <div className="font-mono">{botInfo.id || "—"}</div>
                  </div>
                  <div className="space-y-1 rounded border border-border p-3 bg-background/30">
                    <div className="text-[10px] text-muted-foreground">Capacidades</div>
                    <div className="flex flex-wrap gap-1 pt-0.5">
                      {botInfo.can_join_groups && <Badge variant="outline" className="text-[10px] border-border">Grupos</Badge>}
                      {botInfo.can_read_all_group_messages && <Badge variant="outline" className="text-[10px] border-border">Leer grupos</Badge>}
                      {botInfo.supports_inline_queries && <Badge variant="outline" className="text-[10px] border-border">Inline</Badge>}
                      {!botInfo.can_join_groups && !botInfo.can_read_all_group_messages && !botInfo.supports_inline_queries && <span className="text-xs text-muted-foreground">Básicas</span>}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-center py-8 text-xs text-muted-foreground">
                  {isEdit ? "Cargá la información del bot para ver nombre, username y capacidades." : "Activá el canal primero."}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* TEST TAB */}
        <TabsContent value="test" className="space-y-4 mt-4">
          <Card className="border-border bg-[hsl(var(--elevated))]">
            <CardHeader>
              <CardTitle className="text-sm flex items-center gap-2"><Play className="h-4 w-4 text-sky-400" /> Enviar mensaje de prueba</CardTitle>
              <CardDescription className="text-xs">Verificá que el webhook y el token estén funcionando correctamente.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <Label className="text-xs">Chat ID de destino (obtenelo con @userinfobot)</Label>
                <Input
                  value={testChatId}
                  onChange={(e) => setTestChatId(e.target.value)}
                  placeholder="123456789"
                  className="mt-1.5 font-mono bg-background border-border"
                />
              </div>
              <div>
                <Label className="text-xs">Mensaje</Label>
                <textarea
                  value={testMessage}
                  onChange={(e) => setTestMessage(e.target.value)}
                  className="mt-1.5 w-full min-h-[72px] rounded-md border border-border bg-background p-2 text-sm font-mono focus:outline-none focus:ring-1 focus:ring-sky-500/50"
                />
              </div>

              <Button
                onClick={sendTest}
                disabled={!isEdit || !testChatId.trim() || sendingTest}
                className="w-full bg-primary hover:bg-primary/90 h-9"
              >
                {sendingTest ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Send className="h-4 w-4 mr-2" />}
                Enviar prueba a Telegram
              </Button>

              {testResult && (
                <Alert className={testResult.ok ? "border-emerald-500/30 bg-emerald-500/10" : "border-red-500/30 bg-red-500/10"}>
                  <AlertDescription className="text-xs">
                    {testResult.ok ? "✓ " : "✕ "}{testResult.message || (testResult.ok ? "Enviado" : "Falló")}
                  </AlertDescription>
                </Alert>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* POTENCIAL TAB — fully unlocking Telegram */}
        <TabsContent value="potencial" className="space-y-3 mt-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {[
              { icon: Zap, title: "Respuestas instantáneas", desc: "Edición de mensajes y typing indicators nativos. La IA puede actualizar respuestas en vivo." },
              { icon: Mic, title: "Voz de alta calidad", desc: "Notas de voz TTS con ElevenLabs + recepción de audios/voice messages del cliente." },
              { icon: Image, title: "Media rico sin límites", desc: "Fotos, videos, documentos, PDFs de facturas, captions con formato HTML." },
              { icon: Users, title: "Keyboards interactivos", desc: "Botones inline y listas generados por el agente IA para acciones rápidas (pago, agendar, etc)." },
              { icon: ShieldCheck, title: "Seguridad enterprise", desc: "Secret token por canal + verificación timing-safe. Webhooks firmados y rotables." },
              { icon: FileText, title: "Cero costo marginal", desc: "A diferencia de WhatsApp Cloud API, Telegram no cobra por mensajes enviados/recibidos." },
            ].map((f, i) => (
              <Card key={i} className="border-border bg-[hsl(var(--elevated))] hover:border-sky-500/30 transition-colors">
                <CardContent className="pt-4 pb-4 flex gap-3">
                  <div className="mt-0.5"><f.icon className="h-5 w-5 text-sky-400 shrink-0" /></div>
                  <div>
                    <div className="font-medium text-sm text-foreground">{f.title}</div>
                    <div className="text-xs text-muted-foreground leading-snug mt-1">{f.desc}</div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          <div className="rounded-lg border border-sky-500/20 bg-sky-500/5 p-3 text-xs text-sky-300">
            Todo esto ya está activo en el inbox y con el Agente IA. Configurá el canal y empezá a usarlo con tus clientes en Telegram hoy.
          </div>
        </TabsContent>
      </Tabs>

      <div className="pt-2 text-[10px] text-muted-foreground text-center">
        Telegram • {channel?.name} • ID: <span className="font-mono">{channel?.id?.slice(0, 8)}…</span>
      </div>
    </div>
  );
}

function GenericChannelEditModal({ channel, onClose }: { channel: Record<string, any>; onClose: () => void }) {
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
    onError: (e) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  return (
    <div className="space-y-4 pt-2">
      <div>
        <Label>Nombre del canal</Label>
        <Input
          value={name}
          onChange={e => setName(e.target.value)}
          className="mt-1 bg-[hsl(var(--elevated))] border-border"
        />
      </div>
      <Button
        onClick={() => save.mutate()}
        disabled={!name.trim() || save.isPending}
        className="w-full bg-primary hover:bg-primary/90"
      >
        {save.isPending ? "Guardando..." : "Guardar cambios"}
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
  const [configChannel, setConfigChannel] = useState<Channel | null>(null);
  const [deleteChannel, setDeleteChannel] = useState<Channel | null>(null);
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
        <DialogContent className="bg-card border-border max-w-2xl">
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
          {channels.map((ch) => {
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
                {/* Icon */}
                <Icon className="h-4 w-4 text-muted-foreground shrink-0" />

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{ch.name}</p>
                  <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                    <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${CHANNEL_TYPE_COLORS[ch.type] ?? ""}`}>
                      {ch.type}
                    </Badge>
                    <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${statusClass}`}>
                      {statusLabel}
                    </Badge>
                    {ch.type === "WHATSAPP" && ch.config?.phone_number_id && (
                      <span className="text-[10px] text-muted-foreground font-mono">
                        #{String(ch.config.phone_number_id).slice(-6)}
                      </span>
                    )}
                    {ch.type === "WHATSAPP" && isActive && (
                      <span className="text-[10px] text-muted-foreground border border-border rounded px-1 py-0">
                        Facturación Meta
                      </span>
                    )}
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-1 shrink-0">
                  {/* Primary action: always one of configure / connect / edit */}
                  {needsConfig && (
                    <button
                      className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md bg-muted border border-border hover:bg-accent transition-colors text-xs font-medium text-foreground"
                      title="Configurar canal"
                      onClick={() => setConfigChannel(ch)}
                    >
                      <PlugZap className="h-3.5 w-3.5" />
                      Configurar
                    </button>
                  )}
                  {canConnect && (
                    <button
                      className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md bg-muted border border-border hover:bg-accent transition-colors text-xs font-medium text-foreground"
                      title="Conectar canal"
                      onClick={() => api.connectChannel(ch.id).then(() => qc.invalidateQueries({ queryKey: ["/api/channels"] }))}
                    >
                      <Plug className="h-3.5 w-3.5" />
                      Conectar
                    </button>
                  )}
                  {canEdit && (
                    <button
                      className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md bg-muted border border-border hover:bg-accent transition-colors text-xs font-medium text-foreground"
                      title="Editar canal"
                      onClick={() => setConfigChannel(ch)}
                    >
                      <Pencil className="h-3.5 w-3.5" />
                      Editar
                    </button>
                  )}

                  {/* Secondary: disconnect */}
                  {isActive && (
                    <button
                      className="p-1.5 rounded-md border border-border hover:bg-orange-500/10 hover:border-orange-500/30 transition-colors text-muted-foreground hover:text-orange-400"
                      title="Desactivar canal"
                      disabled={disconnect.isPending}
                      onClick={() => disconnect.mutate(ch.id)}
                    >
                      <PowerOff className="h-3.5 w-3.5" />
                    </button>
                  )}
                  {/* Destructive: delete */}
                  <button
                    className="p-1.5 rounded-md border border-border hover:bg-destructive/10 hover:border-destructive/30 transition-colors text-muted-foreground hover:text-destructive"
                    title="Eliminar canal"
                    onClick={() => setDeleteChannel(ch)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
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
