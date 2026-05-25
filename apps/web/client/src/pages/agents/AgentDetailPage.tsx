import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Loader2, SendHorizonal } from "lucide-react";
import { queryClient } from "@/lib/queryClient";
import { api } from "@/lib/api";
import { useRequireAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { AgentStatusBadge } from "@/components/agents/AgentStatusBadge";

interface Props {
  id: string;
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
    { role: string; text: string }[]
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
        { role: "assistant", text: res.text },
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

  return (
    <div className="flex flex-col gap-6 p-6 max-w-3xl">
      <div className="flex items-center gap-3">
        <h1 className="text-xl font-bold text-foreground">{agent.name}</h1>
        <AgentStatusBadge status={agent.status} />
      </div>

      {/* Config */}
      <div className="rounded-xl border bg-card p-5 flex flex-col gap-4">
        <h2 className="text-sm font-semibold text-foreground">Configuración</h2>
        <div className="grid gap-3">
          <div>
            <Label className="text-xs">Chatflow ID (Flowise)</Label>
            <Input
              defaultValue={agent.chatflow_id}
              onBlur={(e) =>
                updateMut.mutate({ chatflow_id: e.target.value })
              }
              className="mt-1 text-xs font-mono"
              placeholder="UUID del chatflow en Flowise"
            />
          </div>
          <div>
            <Label className="text-xs">Descripción</Label>
            <Textarea
              defaultValue={agent.description ?? ""}
              onBlur={(e) =>
                updateMut.mutate({ description: e.target.value })
              }
              className="mt-1 text-xs resize-none"
              rows={3}
            />
          </div>
          <div>
            <Label className="text-xs">Instrucciones del sistema (prompt)</Label>
            <p className="text-[10px] text-muted-foreground mb-1">
              Define el comportamiento, tono y límites del agente. Se envía a Flowise como contexto de sistema en cada mensaje.
            </p>
            <Textarea
              defaultValue={agent.system_instructions ?? ""}
              onBlur={(e) =>
                updateMut.mutate({ system_instructions: e.target.value })
              }
              className="mt-1 text-xs font-mono resize-y"
              rows={8}
              placeholder={`Eres un asistente de soporte para [nombre del negocio].\nResponde de forma clara y profesional en español.\nSi el cliente pregunta por precios, consultas legales o temas delicados, deriva al equipo humano.`}
            />
          </div>
        </div>
      </div>

      {/* Test console */}
      <div className="rounded-xl border bg-card p-5 flex flex-col gap-3">
        <h2 className="text-sm font-semibold text-foreground">
          Consola de prueba
        </h2>
        <div className="min-h-[120px] max-h-[300px] overflow-y-auto flex flex-col gap-2 text-xs">
          {conversation.map((m, i) => (
            <div key={i} className={m.role === "user" ? "text-right" : "text-left"}>
              <span
                className={`inline-block px-3 py-1.5 rounded-xl max-w-[80%] ${
                  m.role === "user"
                    ? "bg-primary/20 text-foreground"
                    : "bg-muted/50 text-muted-foreground"
                }`}
              >
                {m.text}
              </span>
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
      </div>
    </div>
  );
}
