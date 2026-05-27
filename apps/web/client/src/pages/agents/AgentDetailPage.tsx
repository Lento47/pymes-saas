import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import {
  Loader2, SendHorizonal, Mic, Bot,
  Zap, ScrollText, ShieldCheck, RefreshCw,
  Upload, Play, Square,
} from "lucide-react";
import { queryClient } from "@/lib/queryClient";
import { api } from "@/lib/api";
import { useRequireAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AgentStatusBadge } from "@/components/agents/AgentStatusBadge";
import { cn } from "@/lib/utils";

interface Props {
  id: string;
}

const TAB_TRIGGER_CLS =
  "rounded-none border-b-2 border-transparent pb-3 pt-1 px-1 text-sm font-medium text-muted-foreground " +
  "data-[state=active]:border-primary data-[state=active]:text-foreground " +
  "data-[state=active]:shadow-none bg-transparent hover:text-foreground transition-colors";

function ComingSoonTab({
  icon: Icon,
  title,
  description,
}: {
  icon: React.ElementType;
  title: string;
  description: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-24 text-center gap-4">
      <div className="w-14 h-14 rounded-2xl bg-muted/40 flex items-center justify-center">
        <Icon className="w-7 h-7 text-muted-foreground/40" />
      </div>
      <p className="text-sm font-medium text-foreground/70">{title}</p>
      <p className="text-xs text-muted-foreground/50 max-w-xs leading-relaxed">{description}</p>
      <span className="rounded-full border border-border/50 bg-muted/20 px-3 py-1 text-xs text-muted-foreground/60">
        Próximamente
      </span>
    </div>
  );
}

export default function AgentDetailPage({ id }: Props) {
  useRequireAuth();
  const { toast } = useToast();

  const { data: agent, isLoading } = useQuery({
    queryKey: ["/api/agents", id],
    queryFn: () => api.getAgent(id),
    enabled: !!id,
  });

  const [testMsg, setTestMsg] = useState("");
  const [sessionId, setSessionId] = useState<string | undefined>();
  const [conversation, setConversation] = useState<
    { role: string; text: string; audio_url?: string }[]
  >([]);

  const updateMut = useMutation({
    mutationFn: (data: Record<string, any>) => api.updateAgent(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/agents", id] });
      toast({ title: "Agente actualizado" });
    },
    onError: (e: any) =>
      toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const activateMut = useMutation({
    mutationFn: () => api.activateAgent(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/agents", id] });
      toast({ title: "Agente activado" });
    },
    onError: (e: any) =>
      toast({ title: "Error al activar", description: e.message, variant: "destructive" }),
  });

  const deactivateMut = useMutation({
    mutationFn: () => api.deactivateAgent(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/agents", id] });
      toast({ title: "Agente pausado" });
    },
    onError: (e: any) =>
      toast({ title: "Error al pausar", description: e.message, variant: "destructive" }),
  });

  const testMut = useMutation({
    mutationFn: (question: string) =>
      api.testAgent(id, {
        question,
        channel: "WEB",
        flowise_session_id: sessionId,
      }),
    onSuccess: (res, question) => {
      setSessionId(res.flowise_session_id);
      setConversation((prev) => [
        ...prev,
        { role: "user", text: question },
        { role: "assistant", text: res.text, audio_url: res.audio_url },
      ]);
      setTestMsg("");
    },
    onError: (e: any) =>
      toast({
        title: "Error al probar",
        description: e.message,
        variant: "destructive",
      }),
  });

  if (isLoading) {
    return (
      <div className="flex justify-center py-24">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!agent) {
    return (
      <p className="p-6 text-muted-foreground text-sm">Agente no encontrado</p>
    );
  }

  const chatflowProvisioned = !!agent.chatflow_id;
  const isActive = agent.status === "ACTIVE";

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Page header */}
      <div className="px-6 pt-6 pb-4 border-b border-border/50 flex items-center justify-between gap-4 shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
            <Bot className="w-5 h-5 text-primary" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h1 className="text-base font-semibold text-foreground truncate">{agent.name}</h1>
              <AgentStatusBadge status={agent.status} />
            </div>
            {agent.description && (
              <p className="text-xs text-muted-foreground truncate mt-0.5">{agent.description}</p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {!chatflowProvisioned && (
            <span className="text-[10px] text-amber-400 border border-amber-500/30 rounded px-1.5 py-0.5">
              Sin chatflow
            </span>
          )}
          {isActive ? (
            <Button
              size="sm"
              variant="outline"
              onClick={() => deactivateMut.mutate()}
              disabled={deactivateMut.isPending}
              className="text-xs h-8"
            >
              {deactivateMut.isPending ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Square className="h-3.5 w-3.5" />
              )}
              Pausar
            </Button>
          ) : (
            <Button
              size="sm"
              onClick={() => activateMut.mutate()}
              disabled={activateMut.isPending}
              className="text-xs h-8"
            >
              {activateMut.isPending ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Play className="h-3.5 w-3.5" />
              )}
              Activar
            </Button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="overview" className="flex-1 flex flex-col min-h-0">
        <TabsList className="px-6 border-b border-border/40 rounded-none bg-transparent h-auto gap-4 justify-start shrink-0 overflow-x-auto">
          <TabsTrigger value="overview" className={TAB_TRIGGER_CLS}>Resumen</TabsTrigger>
          <TabsTrigger value="behavior" className={TAB_TRIGGER_CLS}>Comportamiento</TabsTrigger>
          <TabsTrigger value="knowledge" className={TAB_TRIGGER_CLS}>Conocimiento</TabsTrigger>
          <TabsTrigger value="channels" className={TAB_TRIGGER_CLS}>Canales</TabsTrigger>
          <TabsTrigger value="actions" className={TAB_TRIGGER_CLS}>Acciones</TabsTrigger>
          <TabsTrigger value="evaluation" className={TAB_TRIGGER_CLS}>Evaluación</TabsTrigger>
          <TabsTrigger value="logs" className={TAB_TRIGGER_CLS}>Logs</TabsTrigger>
          <TabsTrigger value="safety" className={TAB_TRIGGER_CLS}>Seguridad</TabsTrigger>
        </TabsList>

        <div className="flex-1 overflow-y-auto min-h-0">

          {/* ── RESUMEN ── */}
          <TabsContent value="overview" className="px-6 py-6 mt-0 max-w-2xl space-y-6">
            <div className="space-y-4">
              <div>
                <Label className="text-xs text-muted-foreground mb-1.5 block">Nombre del agente</Label>
                <Input
                  defaultValue={agent.name}
                  onBlur={(e) => updateMut.mutate({ name: e.target.value })}
                  className="text-sm font-medium"
                />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground mb-1.5 block">Descripción</Label>
                <Input
                  defaultValue={agent.description ?? ""}
                  onBlur={(e) => updateMut.mutate({ description: e.target.value })}
                  className="text-sm"
                  placeholder="Breve descripción del propósito del agente"
                />
              </div>
            </div>

            {/* Voice card */}
            <div className="rounded-xl border border-border bg-card p-5 space-y-4">
              <div className="flex items-center gap-2">
                <Mic className="h-4 w-4 text-muted-foreground" />
                <h3 className="text-sm font-semibold text-foreground">Voz del agente</h3>
              </div>
              <p className="text-xs text-muted-foreground -mt-2">
                Cuando está activado, el agente responde con notas de voz (ElevenLabs). Funciona en WhatsApp y en la consola de prueba.
              </p>
              <div className="flex items-center justify-between">
                <Label className="text-xs">Activar notas de voz</Label>
                <Switch
                  checked={!!agent.voice_enabled}
                  onCheckedChange={(checked) => updateMut.mutate({ voice_enabled: checked })}
                />
              </div>
              {agent.voice_enabled && (
                <div>
                  <Label className="text-xs mb-1 block">Voice ID de ElevenLabs</Label>
                  <p className="text-[11px] text-muted-foreground mb-1.5">
                    Deja vacío para usar la voz por defecto. Obtén IDs desde ElevenLabs → Voice Library.
                  </p>
                  <Input
                    defaultValue={agent.elevenlabs_voice_id ?? ""}
                    onBlur={(e) =>
                      updateMut.mutate({ elevenlabs_voice_id: e.target.value || null })
                    }
                    className="text-xs font-mono"
                    placeholder="Ej: JBFqnCBsd6RMkjVDRZzb (Rachel)"
                  />
                </div>
              )}
            </div>

            {/* Stats row */}
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-xl border border-border bg-card px-4 py-3">
                <p className="text-[11px] text-muted-foreground mb-1">Canal activo</p>
                <p className="text-sm font-semibold text-foreground">{agent.channel_scope ?? "TODOS"}</p>
              </div>
              <div className="rounded-xl border border-border bg-card px-4 py-3">
                <p className="text-[11px] text-muted-foreground mb-1">Chatflow</p>
                <p className={cn("text-sm font-semibold", chatflowProvisioned ? "text-emerald-500" : "text-amber-500")}>
                  {chatflowProvisioned ? "Conectado" : "Sin asignar"}
                </p>
              </div>
            </div>
          </TabsContent>

          {/* ── COMPORTAMIENTO ── */}
          <TabsContent value="behavior" className="px-6 py-6 mt-0 max-w-2xl space-y-4">
            <div>
              <h2 className="text-sm font-semibold text-foreground mb-1">Instrucciones del sistema</h2>
              <p className="text-xs text-muted-foreground mb-4">
                Define el comportamiento, tono y límites del agente. Se envía como contexto en cada conversación. Puedes modificarlo en cualquier momento.
              </p>
              <Textarea
                defaultValue={agent.system_instructions ?? ""}
                onBlur={(e) => updateMut.mutate({ system_instructions: e.target.value })}
                className="text-xs font-mono resize-y"
                rows={16}
                placeholder={`Eres el asistente virtual de [nombre del negocio].
Respondes en español, de forma clara y amigable.
Tu objetivo es ayudar al cliente con preguntas sobre productos, precios y pedidos.
No inventes precios ni hagas promesas que el negocio no haya confirmado.
Si el cliente está enojado, tiene un reclamo de pago o una consulta legal, deriva al equipo humano.`}
              />
            </div>
            <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 px-4 py-3">
              <p className="text-xs text-amber-600 dark:text-amber-400">
                <strong>Consejo:</strong> Sé específico sobre el tono, los límites y cuándo derivar a un humano. Cuanto más detalladas las instrucciones, mejor el comportamiento del agente.
              </p>
            </div>
          </TabsContent>

          {/* ── CONOCIMIENTO ── */}
          <TabsContent value="knowledge" className="px-6 py-6 mt-0">
            <ComingSoonTab
              icon={Upload}
              title="Base de conocimiento"
              description="Conecta documentos, URLs, FAQs y archivos PDF para que el agente responda con información precisa de tu negocio."
            />
          </TabsContent>

          {/* ── CANALES ── */}
          <TabsContent value="channels" className="px-6 py-6 mt-0 max-w-2xl space-y-5">
            <div>
              <h2 className="text-sm font-semibold text-foreground mb-1">Canales de atención</h2>
              <p className="text-xs text-muted-foreground mb-4">
                Configura en qué canales opera este agente y su integración con Flowise.
              </p>
            </div>
            <div className="rounded-xl border border-border bg-card p-5 space-y-4">
              <div>
                <Label className="text-xs mb-1 block">Alcance del canal</Label>
                <p className="text-[11px] text-muted-foreground mb-1.5">
                  Define en qué canal responde este agente (ALL, WHATSAPP, TELEGRAM, WEB).
                </p>
                <Input
                  defaultValue={agent.channel_scope ?? "ALL"}
                  onBlur={(e) => updateMut.mutate({ channel_scope: e.target.value })}
                  className="text-xs"
                />
              </div>
              <div>
                <Label className="text-xs mb-1 block">Chatflow ID</Label>
                <p className="text-[11px] text-muted-foreground mb-1.5">
                  Generado automáticamente al activar el agente. Solo modifica si querés apuntar a un chatflow personalizado en Flowise.
                </p>
                <Input
                  defaultValue={agent.chatflow_id ?? ""}
                  onBlur={(e) => updateMut.mutate({ chatflow_id: e.target.value })}
                  className="text-xs font-mono"
                  placeholder="Auto-generado por Flowise"
                />
              </div>
            </div>
          </TabsContent>

          {/* ── ACCIONES ── */}
          <TabsContent value="actions" className="px-6 py-6 mt-0">
            <ComingSoonTab
              icon={Zap}
              title="Herramientas y acciones"
              description="Conecta el agente con CRM, calendario, facturación y APIs externas para que pueda crear tareas, agendar citas y actualizar datos."
            />
          </TabsContent>

          {/* ── EVALUACIÓN ── */}
          <TabsContent value="evaluation" className="px-6 py-6 mt-0 mt-0 flex flex-col gap-4 max-w-2xl">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-foreground">Consola de prueba</h2>
              {sessionId && (
                <button
                  className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
                  onClick={() => {
                    setSessionId(undefined);
                    setConversation([]);
                  }}
                >
                  <RefreshCw className="h-3 w-3" />
                  Nueva sesión
                </button>
              )}
            </div>

            {!chatflowProvisioned ? (
              <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-5 text-center">
                <p className="text-sm text-amber-600 dark:text-amber-400 font-medium mb-1">Chatflow no asignado</p>
                <p className="text-xs text-amber-500/70">
                  Activá el agente primero para que PymesHub cree automáticamente el chatflow en Flowise.
                </p>
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                <div className="min-h-[200px] max-h-[400px] overflow-y-auto rounded-xl border border-border bg-card p-4 flex flex-col gap-3">
                  {conversation.length === 0 && (
                    <p className="text-muted-foreground/40 text-sm text-center py-8">
                      Escribí un mensaje para probar el agente
                    </p>
                  )}
                  {conversation.map((m, i) => (
                    <div
                      key={i}
                      className={cn(
                        "flex flex-col gap-1",
                        m.role === "user" ? "items-end" : "items-start",
                      )}
                    >
                      <span
                        className={cn(
                          "inline-block px-3.5 py-2 rounded-2xl max-w-[80%] text-sm leading-relaxed",
                          m.role === "user"
                            ? "bg-primary/15 text-foreground rounded-br-sm"
                            : "bg-muted/50 text-muted-foreground rounded-bl-sm",
                        )}
                      >
                        {m.text}
                      </span>
                      {m.audio_url && (
                        <audio controls src={m.audio_url} className="h-8 max-w-[80%]" />
                      )}
                    </div>
                  ))}
                  {testMut.isPending && (
                    <div className="flex items-start">
                      <span className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-2xl rounded-bl-sm bg-muted/50 text-xs text-muted-foreground">
                        <Loader2 className="h-3 w-3 animate-spin" />
                        Pensando...
                      </span>
                    </div>
                  )}
                </div>
                <div className="flex gap-2">
                  <Input
                    value={testMsg}
                    onChange={(e) => setTestMsg(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey && testMsg.trim()) {
                        testMut.mutate(testMsg);
                      }
                    }}
                    placeholder="Escribe un mensaje de prueba…"
                    className="text-sm"
                    disabled={testMut.isPending}
                  />
                  <Button
                    size="sm"
                    disabled={!testMsg.trim() || testMut.isPending}
                    onClick={() => testMut.mutate(testMsg)}
                    className="h-10 px-4"
                  >
                    {testMut.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <SendHorizonal className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </div>
            )}
          </TabsContent>

          {/* ── LOGS ── */}
          <TabsContent value="logs" className="px-6 py-6 mt-0">
            <ComingSoonTab
              icon={ScrollText}
              title="Historial de conversaciones"
              description="Revisá todas las conversaciones que manejó este agente, con filtros por fecha, canal y resultado."
            />
          </TabsContent>

          {/* ── SEGURIDAD ── */}
          <TabsContent value="safety" className="px-6 py-6 mt-0">
            <ComingSoonTab
              icon={ShieldCheck}
              title="Guardianes de seguridad"
              description="Configurá filtros de contenido, palabras bloqueadas, límites de conversación y reglas de derivación automática."
            />
          </TabsContent>

        </div>
      </Tabs>
    </div>
  );
}
