import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ChevronDown, ChevronRight, Settings2, Volume2 } from "lucide-react";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

const GATEWAY_MODELS = [
  { id: "workers-ai/@cf/meta/llama-3.3-70b-instruct-fp8-fast", label: "Llama 3.3 70B Fast", provider: "Workers AI", badge: "Gratis" },
  { id: "workers-ai/@cf/meta/llama-3.1-8b-instruct", label: "Llama 3.1 8B", provider: "Workers AI", badge: "Gratis" },
  { id: "workers-ai/@cf/moonshotai/kimi-k2.6", label: "Kimi K2.6", provider: "Workers AI", badge: "Gratis" },
  { id: "deepseek/deepseek-v4-pro", label: "DeepSeek V4 Pro", provider: "DeepSeek" },
  { id: "deepseek/deepseek-v4-flash", label: "DeepSeek V4 Flash", provider: "DeepSeek" },
];

const INTENT_OPTIONS = [
  { id: "ORDER", label: "Pedidos" },
  { id: "APPOINTMENT", label: "Citas" },
  { id: "QUOTE", label: "Cotizaciones" },
  { id: "COMPLAINT", label: "Reclamos" },
];

export function AgentGlobalConfig() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [open, setOpen] = useState(true);

  const { data: workspace } = useQuery({ queryKey: ["/api/workspaces/current"], queryFn: api.getWorkspace });
  const { data: membersData } = useQuery({ queryKey: ["/api/workspaces/current/members"], queryFn: api.getMembers, enabled: open });

  const [agentAutoActive, setAgentAutoActive] = useState(false);
  const [agentProviders, setAgentProviders] = useState<string[]>([]);
  const [addingModel, setAddingModel] = useState("");
  const [assignmentMode, setAssignmentMode] = useState("conversation_assignee");
  const [defaultAssigneeId, setDefaultAssigneeId] = useState("");
  const [intentAssignees, setIntentAssignees] = useState<Record<string, string>>({});
  const [voiceEnabled, setVoiceEnabled] = useState(false);
  const [voiceId, setVoiceId] = useState("");
  const [elevenlabsApiKey, setElevenlabsApiKey] = useState("");

  useEffect(() => {
    if (!workspace) return;
    setAgentAutoActive(workspace.ai_agent_auto_active ?? false);
    setAgentProviders(Array.isArray(workspace.ai_agent_providers) ? workspace.ai_agent_providers : []);
    setAssignmentMode(workspace.ai_agent_assignment_mode ?? "conversation_assignee");
    setDefaultAssigneeId(workspace.ai_agent_default_assignee_id ?? "");
    setIntentAssignees((workspace.ai_agent_intent_assignees as Record<string, string>) ?? {});
    setVoiceEnabled(workspace.ai_voice_enabled ?? false);
    setVoiceId(workspace.ai_voice_id ?? "");
  }, [
    workspace?.ai_agent_auto_active,
    workspace?.ai_agent_providers,
    workspace?.ai_agent_assignment_mode,
    workspace?.ai_agent_default_assignee_id,
    workspace?.ai_agent_intent_assignees,
    workspace?.ai_voice_enabled,
    workspace?.ai_voice_id,
  ]);

  const memberList: any[] = Array.isArray(membersData) ? membersData : (membersData as any)?.data ?? [];
  const assignableMembers = memberList
    .map((m: any) => m.user ?? m)
    .filter((m: any) => m?.id);

  const updateIntentAssignee = (intent: string, userId: string) => {
    setIntentAssignees((cur) => {
      const next = { ...cur };
      if (!userId || userId === "none") delete next[intent];
      else next[intent] = userId;
      return next;
    });
  };

  const save = useMutation({
    mutationFn: () => api.updateWorkspace({
      ...(elevenlabsApiKey ? { elevenlabs_api_key: elevenlabsApiKey } : {}),
      settings_json: {
        ai_agent_providers: agentProviders,
        ai_agent_provider: "workers_ai",
        ai_agent_model: "",
        ai_agent_assignment_mode: assignmentMode,
        ai_agent_default_assignee_id: defaultAssigneeId || "",
        ai_agent_intent_assignees: intentAssignees,
        ai_agent_auto_active: agentAutoActive,
        ai_voice_enabled: voiceEnabled,
        ai_voice_id: voiceId,
      },
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/workspaces/current"] });
      setElevenlabsApiKey("");
      toast({ title: "Configuración global guardada" });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  return (
    <div className="rounded-lg border border-border bg-card/40">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between px-4 py-3 text-left"
      >
        <div className="flex items-center gap-2">
          <Settings2 className="h-4 w-4 text-primary" />
          <span className="text-sm font-medium text-foreground">Configuración global del agente</span>
          {voiceEnabled && (
            <span className="ml-2 text-[10px] bg-emerald-500/15 text-emerald-400 px-1.5 py-0.5 rounded-full">
              Voz activa
            </span>
          )}
        </div>
        {open ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
      </button>

      {open && (
        <div className="border-t border-border px-4 py-4 space-y-5">
          {/* Toggle active */}
          <div className="flex items-center justify-between py-1">
            <div>
              <p className="text-xs font-medium">Agente IA activo por defecto</p>
              <p className="text-[11px] text-muted-foreground">
                El agente responde automáticamente en todas las conversaciones.
              </p>
            </div>
            <Switch checked={agentAutoActive} onCheckedChange={setAgentAutoActive} />
          </div>

          {/* Load Balancer */}
          <div>
            <Label className="text-xs mb-1 block">Proveedores del Agente IA · Load Balancer</Label>
            <p className="text-[11px] text-muted-foreground mb-2">
              El agente intenta los proveedores en orden. Si uno falla, pasa al siguiente.
            </p>
            <div className="space-y-2 mb-2">
              {agentProviders.map((modelId, index) => {
                const info = GATEWAY_MODELS.find((m) => m.id === modelId);
                return (
                  <div key={modelId} className="flex items-center gap-2 rounded-lg border border-border/60 bg-card/40 px-3 py-2">
                    <span className="text-[10px] text-muted-foreground font-mono w-4 text-center">{index + 1}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium truncate">
                        {info?.label ?? modelId}
                        {info?.badge && (
                          <span className="ml-1.5 text-[9px] bg-emerald-500/15 text-emerald-400 px-1.5 py-0.5 rounded-full">
                            {info.badge}
                          </span>
                        )}
                      </p>
                      <p className="text-[10px] text-muted-foreground">{info?.provider ?? ""}</p>
                    </div>
                    <div className="flex gap-1 shrink-0">
                      <button
                        type="button"
                        disabled={index === 0}
                        onClick={() => setAgentProviders((prev) => {
                          const next = [...prev];
                          [next[index - 1], next[index]] = [next[index], next[index - 1]];
                          return next;
                        })}
                        className="p-1 rounded hover:bg-sidebar-accent/40 disabled:opacity-30 disabled:cursor-not-allowed"
                      >▲</button>
                      <button
                        type="button"
                        disabled={index === agentProviders.length - 1}
                        onClick={() => setAgentProviders((prev) => {
                          const next = [...prev];
                          [next[index], next[index + 1]] = [next[index + 1], next[index]];
                          return next;
                        })}
                        className="p-1 rounded hover:bg-sidebar-accent/40 disabled:opacity-30 disabled:cursor-not-allowed"
                      >▼</button>
                      <button
                        type="button"
                        onClick={() => setAgentProviders((prev) => prev.filter((_, i) => i !== index))}
                        className="p-1 rounded hover:bg-destructive/20 text-muted-foreground hover:text-destructive"
                      >✕</button>
                    </div>
                  </div>
                );
              })}
              {agentProviders.length === 0 && (
                <p className="text-[11px] text-amber-400 py-1">Sin proveedores — el agente no responderá.</p>
              )}
            </div>
            <div className="flex gap-2">
              <Select value={addingModel} onValueChange={setAddingModel}>
                <SelectTrigger className="bg-[hsl(var(--elevated))] border-border text-xs h-8 flex-1">
                  <SelectValue placeholder="Agregar proveedor..." />
                </SelectTrigger>
                <SelectContent className="bg-card border-border">
                  {GATEWAY_MODELS.filter((m) => !agentProviders.includes(m.id)).map((m) => (
                    <SelectItem key={m.id} value={m.id} className="text-xs">
                      <span className="font-medium">{m.provider}</span> · {m.label}
                      {m.badge && <span className="ml-1.5 text-[9px] text-emerald-400">({m.badge})</span>}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-8 text-xs shrink-0"
                disabled={!addingModel}
                onClick={() => {
                  if (addingModel && !agentProviders.includes(addingModel)) {
                    setAgentProviders((prev) => [...prev, addingModel]);
                    setAddingModel("");
                  }
                }}
              >
                Agregar
              </Button>
            </div>
          </div>

          {/* Task assignment */}
          <div className="grid gap-3 md:grid-cols-2">
            <div>
              <Label className="text-xs mb-1 block">Asignación de tareas creadas por IA</Label>
              <Select value={assignmentMode} onValueChange={setAssignmentMode}>
                <SelectTrigger className="bg-[hsl(var(--elevated))] border-border">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-card border-border">
                  <SelectItem value="conversation_assignee">Usar agente asignado a la conversación</SelectItem>
                  <SelectItem value="default_user">Usar responsable predeterminado</SelectItem>
                  <SelectItem value="unassigned">Dejar sin asignar</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs mb-1 block">Responsable predeterminado</Label>
              <Select value={defaultAssigneeId || "none"} onValueChange={(v) => setDefaultAssigneeId(v === "none" ? "" : v)}>
                <SelectTrigger className="bg-[hsl(var(--elevated))] border-border">
                  <SelectValue placeholder="Sin responsable" />
                </SelectTrigger>
                <SelectContent className="bg-card border-border">
                  <SelectItem value="none">Sin responsable</SelectItem>
                  {assignableMembers.map((m: any) => (
                    <SelectItem key={m.id} value={m.id}>{m.name ?? m.email ?? m.id}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {INTENT_OPTIONS.map((intent) => (
              <div key={intent.id}>
                <Label className="text-xs mb-1 block">{intent.label}</Label>
                <Select value={intentAssignees[intent.id] ?? "none"} onValueChange={(v) => updateIntentAssignee(intent.id, v)}>
                  <SelectTrigger className="bg-[hsl(var(--elevated))] border-border">
                    <SelectValue placeholder="Usar regla general" />
                  </SelectTrigger>
                  <SelectContent className="bg-card border-border">
                    <SelectItem value="none">Usar regla general</SelectItem>
                    {assignableMembers.map((m: any) => (
                      <SelectItem key={m.id} value={m.id}>{m.name ?? m.email ?? m.id}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ))}
          </div>

          {/* Voice */}
          <div className="border-t border-border/60 pt-4 space-y-3">
            <div className="flex items-center gap-2">
              <Volume2 className="h-3.5 w-3.5 text-primary" />
              <p className="text-xs font-semibold">Voz para el Agente IA</p>
            </div>
            <div className="flex items-center justify-between py-1">
              <div>
                <p className="text-xs font-medium">Activar respuestas de voz</p>
                <p className="text-[11px] text-muted-foreground">WhatsApp y Telegram. Requiere clave ElevenLabs.</p>
              </div>
              <Switch checked={voiceEnabled} onCheckedChange={setVoiceEnabled} />
            </div>
            {voiceEnabled && (workspace as any)?.voice_last_error && (
              <p className="text-[11px] text-destructive bg-destructive/10 rounded px-2 py-1.5">
                ⚠ {(workspace as any).voice_last_error}
              </p>
            )}
            <div className={cn("space-y-3", !voiceEnabled && "opacity-40 pointer-events-none")}>
              <div>
                <Label className="text-xs mb-1 block">ID de voz (ElevenLabs)</Label>
                <Input
                  className="text-xs h-8 bg-[hsl(var(--elevated))] border-border"
                  placeholder="U9TSK9KHMlMU2qkeXlQP"
                  value={voiceId}
                  onChange={(e) => setVoiceId(e.target.value)}
                />
              </div>
              <div>
                <Label className="text-xs mb-1 block">
                  API Key ElevenLabs{" "}
                  <span className="text-muted-foreground">(opcional — usa la del sistema si se deja vacía)</span>
                </Label>
                <Input
                  className="text-xs h-8 bg-[hsl(var(--elevated))] border-border font-mono"
                  type="password"
                  placeholder="sk_..."
                  value={elevenlabsApiKey}
                  onChange={(e) => setElevenlabsApiKey(e.target.value)}
                />
              </div>
            </div>
          </div>

          <Button
            onClick={() => save.mutate()}
            disabled={save.isPending}
            className="bg-primary hover:bg-primary/90 h-8 text-xs"
          >
            {save.isPending ? "Guardando..." : "Guardar configuración global"}
          </Button>
        </div>
      )}
    </div>
  );
}
