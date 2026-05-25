import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Loader2, SendHorizonal, ChevronDown, Mic } from "lucide-react";
import { queryClient } from "@/lib/queryClient";
import { api } from "@/lib/api";
import { useRequireAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { AgentStatusBadge } from "@/components/agents/AgentStatusBadge";
import { cn } from "@/lib/utils";

interface Props {
  id: string;
}

export default function AgentDetailPage({ id }: Props) {
  useRequireAuth();
  const { toast } = useToast();
  const [showAdvanced, setShowAdvanced] = useState(false);

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

  return (
    <div className="flex flex-col gap-6 p-6 max-w-3xl">
      <div className="flex items-center gap-3">
        <h1 className="text-xl font-bold text-foreground">{agent.name}</h1>
        <AgentStatusBadge status={agent.status} />
        {!chatflowProvisioned && (
          <span className="text-[10px] text-amber-400 border border-amber-500/30 rounded px-1.5 py-0.5">
            Sin chatflow — activa Flowise
          </span>
        )}
      </div>

      {/* Main config */}
      <div className="rounded-xl border bg-card p-5 flex flex-col gap-4">
        <h2 className="text-sm font-semibold text-foreground">Configuración del agente</h2>
        <div className="grid gap-4">
          <div>
            <Label className="text-xs">Nombre</Label>
            <Input
              defaultValue={agent.name}
              onBlur={(e) => updateMut.mutate({ name: e.target.value })}
              className="mt-1 text-xs"
            />
          </div>

          <div>
            <Label className="text-xs">Descripción</Label>
            <Input
              defaultValue={agent.description ?? ""}
              onBlur={(e) => updateMut.mutate({ description: e.target.value })}
              className="mt-1 text-xs"
              placeholder="Breve descripción del propósito del agente"
            />
          </div>

          <div>
            <Label className="text-xs font-medium">
              Instrucciones del sistema (prompt del negocio)
            </Label>
            <p className="text-[10px] text-muted-foreground mt-0.5 mb-1.5">
              Define el comportamiento, tono y límites del agente. Se envía a
              Flowise como contexto en cada mensaje. Puedes modificarlo en
              cualquier momento sin tocar Flowise.
            </p>
            <Textarea
              defaultValue={agent.system_instructions ?? ""}
              onBlur={(e) =>
                updateMut.mutate({ system_instructions: e.target.value })
              }
              className="text-xs font-mono resize-y"
              rows={10}
              placeholder={`Eres el asistente virtual de [nombre del negocio].
Respondes en español, de forma clara y amigable.
Tu objetivo es ayudar al cliente con preguntas sobre productos, precios y pedidos.
No inventes precios ni hagas promesas que el negocio no haya confirmado.
Si el cliente está enojado, tiene un reclamo de pago o una consulta legal, deriva al equipo humano.`}
            />
          </div>
        </div>
      </div>

      {/* Voice config */}
      <div className="rounded-xl border bg-card p-5 flex flex-col gap-4">
        <div className="flex items-center gap-2">
          <Mic className="h-4 w-4 text-muted-foreground" />
          <h2 className="text-sm font-semibold text-foreground">Voz del agente</h2>
        </div>
        <p className="text-[11px] text-muted-foreground -mt-2">
          Cuando está activado, el agente responde con notas de voz (ElevenLabs).
          Funciona en WhatsApp y en la consola de prueba.
        </p>
        <div className="flex items-center justify-between">
          <Label className="text-xs">Activar notas de voz</Label>
          <Switch
            checked={!!agent.voice_enabled}
            onCheckedChange={(checked) =>
              updateMut.mutate({ voice_enabled: checked })
            }
          />
        </div>
        {agent.voice_enabled && (
          <div>
            <Label className="text-xs">Voice ID de ElevenLabs</Label>
            <p className="text-[10px] text-muted-foreground mb-1">
              Deja vacío para usar la voz por defecto del sistema. Obtén IDs
              desde tu cuenta de ElevenLabs → Voice Library.
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

      {/* Advanced: chatflow ID (read-only by default, editable for power users) */}
      <div className="rounded-xl border bg-card/50">
        <button
          className="w-full flex items-center justify-between p-4 text-sm text-muted-foreground hover:text-foreground transition-colors"
          onClick={() => setShowAdvanced((v) => !v)}
        >
          <span>Opciones avanzadas (Flowise)</span>
          <ChevronDown
            className={cn(
              "h-4 w-4 transition-transform",
              showAdvanced && "rotate-180",
            )}
          />
        </button>
        {showAdvanced && (
          <div className="px-5 pb-5 flex flex-col gap-3 border-t pt-4">
            <div>
              <Label className="text-xs">Chatflow ID</Label>
              <p className="text-[10px] text-muted-foreground mb-1">
                Generado automáticamente al crear el agente. Solo modifica si
                quieres apuntar a un chatflow personalizado en Flowise.
              </p>
              <Input
                defaultValue={agent.chatflow_id ?? ""}
                onBlur={(e) =>
                  updateMut.mutate({ chatflow_id: e.target.value })
                }
                className="text-xs font-mono"
                placeholder="Auto-generado por Flowise"
              />
            </div>
            <div>
              <Label className="text-xs">Canal</Label>
              <Input
                defaultValue={agent.channel_scope ?? "ALL"}
                onBlur={(e) =>
                  updateMut.mutate({ channel_scope: e.target.value })
                }
                className="text-xs"
              />
            </div>
          </div>
        )}
      </div>

      {/* Test console */}
      <div className="rounded-xl border bg-card p-5 flex flex-col gap-3">
        <h2 className="text-sm font-semibold text-foreground">
          Consola de prueba
        </h2>
        {!chatflowProvisioned ? (
          <p className="text-xs text-amber-400/80">
            El agente aún no tiene un chatflow asignado. Activa el agente para
            que PymesHub lo cree en Flowise automáticamente.
          </p>
        ) : (
          <>
            <div className="min-h-[120px] max-h-[300px] overflow-y-auto flex flex-col gap-2 text-xs">
              {conversation.length === 0 && (
                <p className="text-muted-foreground/40 text-center py-4">
                  Escribe un mensaje para probar el agente
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
                    className={`inline-block px-3 py-1.5 rounded-xl max-w-[80%] ${
                      m.role === "user"
                        ? "bg-primary/20 text-foreground"
                        : "bg-muted/50 text-muted-foreground"
                    }`}
                  >
                    {m.text}
                  </span>
                  {m.audio_url && (
                    <audio
                      controls
                      src={m.audio_url}
                      className="h-8 max-w-[80%]"
                    />
                  )}
                </div>
              ))}
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
                className="text-xs"
              />
              <Button
                size="sm"
                disabled={!testMsg.trim() || testMut.isPending}
                onClick={() => testMut.mutate(testMsg)}
              >
                {testMut.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <SendHorizonal className="h-4 w-4" />
                )}
              </Button>
            </div>
            {sessionId && (
              <button
                className="text-[10px] text-muted-foreground/40 text-left hover:underline"
                onClick={() => {
                  setSessionId(undefined);
                  setConversation([]);
                }}
              >
                Nueva conversación
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}
