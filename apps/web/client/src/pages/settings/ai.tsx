import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Eye, EyeOff, CheckCircle2, Bot, ClipboardList } from "lucide-react";
import { SettingsLayout } from "@/components/settings/settings-layout";

const AI_PROVIDERS = [
  { id: "openai",          label: "OpenAI",                 models: ["gpt-4o-mini", "gpt-4o", "gpt-4-turbo", "gpt-5"] },
  { id: "anthropic",       label: "Anthropic (Claude)",     models: ["claude-haiku-4-5-20251001", "claude-sonnet-4-6", "claude-opus-4-7"] },
  { id: "google-ai-studio",label: "Google Gemini",          models: ["gemini-2.5-flash", "gemini-2.0-flash", "gemini-1.5-pro"] },
  { id: "groq",            label: "Groq",                   models: ["llama-3.3-70b-versatile", "llama-3.1-8b-instant", "mixtral-8x7b-32768"] },
  { id: "grok",            label: "Grok (xAI)",             models: ["grok-4", "grok-3", "grok-2"] },
  { id: "mistral",         label: "Mistral",                models: ["mistral-large-latest", "mistral-small-latest", "open-mistral-7b"] },
  { id: "cohere",          label: "Cohere",                 models: ["command-r-plus", "command-r", "command"] },
  { id: "deepseek",        label: "DeepSeek",               models: ["deepseek-chat", "deepseek-reasoner"] },
  { id: "perplexity-ai",   label: "Perplexity",             models: ["llama-3.1-sonar-large-128k-online", "llama-3.1-sonar-small-128k-online"] },
  { id: "cerebras",        label: "Cerebras",               models: ["llama3.1-8b", "llama3.3-70b"] },
  { id: "workers-ai",      label: "Workers AI (gratis)",    models: ["@cf/meta/llama-3.3-70b-instruct-fp8-fast", "@cf/meta/llama-3.1-8b-instruct", "@cf/moonshotai/kimi-k2.6"] },
  { id: "moonshot",        label: "Moonshot (Kimi)",        models: ["moonshot-v1-8k", "moonshot-v1-32k"] },
];

const GATEWAY_MODELS = [
  { id: "workers-ai/@cf/meta/llama-3.3-70b-instruct-fp8-fast", label: "Llama 3.3 70B Fast", provider: "Workers AI", badge: "Gratis" },
  { id: "workers-ai/@cf/meta/llama-3.1-8b-instruct", label: "Llama 3.1 8B", provider: "Workers AI", badge: "Gratis" },
  { id: "workers-ai/@cf/moonshotai/kimi-k2.6", label: "Kimi K2.6", provider: "Workers AI", badge: "Gratis" },
  { id: "openai/gpt-5", label: "GPT-5", provider: "OpenAI" },
  { id: "openai/gpt-4o", label: "GPT-4o", provider: "OpenAI" },
  { id: "openai/gpt-4o-mini", label: "GPT-4o Mini", provider: "OpenAI" },
  { id: "anthropic/claude-sonnet-4-5", label: "Claude Sonnet 4.5", provider: "Anthropic" },
  { id: "anthropic/claude-haiku-4-5-20251001", label: "Claude Haiku 4.5", provider: "Anthropic" },
  { id: "google-ai-studio/gemini-2.5-flash", label: "Gemini 2.5 Flash", provider: "Google" },
  { id: "google-ai-studio/gemini-2.0-flash", label: "Gemini 2.0 Flash", provider: "Google" },
  { id: "grok/grok-4", label: "Grok 4", provider: "xAI" },
  { id: "grok/grok-3", label: "Grok 3", provider: "xAI" },
  { id: "groq/llama-3.3-70b-versatile", label: "Llama 3.3 70B", provider: "Groq" },
  { id: "groq/llama-3.1-8b-instant", label: "Llama 3.1 8B Instant", provider: "Groq" },
  { id: "deepseek/deepseek-chat", label: "DeepSeek Chat", provider: "DeepSeek" },
  { id: "deepseek/deepseek-reasoner", label: "DeepSeek Reasoner", provider: "DeepSeek" },
  { id: "cerebras/llama3.1-8b", label: "Llama 3.1 8B", provider: "Cerebras" },
  { id: "cerebras/llama3.3-70b", label: "Llama 3.3 70B", provider: "Cerebras" },
  { id: "mistral/mistral-large-latest", label: "Mistral Large", provider: "Mistral" },
  { id: "mistral/mistral-small-latest", label: "Mistral Small", provider: "Mistral" },
  { id: "cohere/command-r-plus", label: "Command R+", provider: "Cohere" },
  { id: "cohere/command-r", label: "Command R", provider: "Cohere" },
  { id: "perplexity-ai/llama-3.1-sonar-large-128k-online", label: "Sonar Large (online)", provider: "Perplexity" },
  { id: "baseten/openai/gpt-oss-120b", label: "GPT-OSS 120B", provider: "Baseten" },
  { id: "parallel/speed", label: "Speed", provider: "Parallel" },
  { id: "moonshot/moonshot-v1-8k", label: "Moonshot V1 8K", provider: "Moonshot" },
];

export default function AiSettingsPage() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const { data: workspace } = useQuery({ queryKey: ["/api/workspaces/current"], queryFn: api.getWorkspace });

  const [provider, setProvider] = useState("");
  const [model, setModel]       = useState("");
  const [apiKey, setApiKey]     = useState("");
  const [showKey, setShowKey]   = useState(false);
  const [testResult, setTestResult] = useState<any>(null);
  const [businessPrompt, setBusinessPrompt] = useState("");
  const [productsServices, setProductsServices] = useState("");
  const [policies, setPolicies] = useState("");
  const [tone, setTone] = useState("");
  const [agentProviders, setAgentProviders] = useState<string[]>(["workers-ai/@cf/meta/llama-3.3-70b-instruct-fp8-fast"]);
  const [addingModel, setAddingModel] = useState("");
  const [assignmentMode, setAssignmentMode] = useState("conversation_assignee");
  const [defaultAssigneeId, setDefaultAssigneeId] = useState("");
  const [intentAssignees, setIntentAssignees] = useState<Record<string, string>>({});

  const { data: members } = useQuery({
    queryKey: ["/api/workspaces/current/members"],
    queryFn: api.getMembers,
  });

  useEffect(() => {
    if (workspace) {
      setProvider(workspace.ai_provider ?? "");
      setModel(workspace.ai_model ?? "");
      setBusinessPrompt(workspace.ai_business_prompt ?? "");
      setProductsServices(workspace.ai_business_products_services ?? "");
      setPolicies(workspace.ai_business_policies ?? "");
      setTone(workspace.ai_business_tone ?? "");
      // Load ai_agent_providers (new format) or fall back from legacy single provider
      const savedProviders = workspace.ai_agent_providers;
      if (Array.isArray(savedProviders) && savedProviders.length > 0) {
        setAgentProviders(savedProviders);
      } else {
        // Legacy: convert old ai_agent_provider + ai_agent_model
        const legacyProvider = workspace.ai_agent_provider ?? "workers_ai";
        const legacyModel = workspace.ai_agent_model;
        if (legacyProvider === "workers_ai" && legacyModel && legacyModel !== "global") {
          setAgentProviders([`workers-ai/${legacyModel}`]);
        } else {
          setAgentProviders(["workers-ai/@cf/meta/llama-3.3-70b-instruct-fp8-fast"]);
        }
      }
      setAssignmentMode(workspace.ai_agent_assignment_mode ?? "conversation_assignee");
      setDefaultAssigneeId(workspace.ai_agent_default_assignee_id ?? "");
      setIntentAssignees(workspace.ai_agent_intent_assignees ?? {});
    }
  }, [
    workspace?.ai_provider,
    workspace?.ai_model,
    workspace?.ai_business_prompt,
    workspace?.ai_business_products_services,
    workspace?.ai_business_policies,
    workspace?.ai_business_tone,
    workspace?.ai_agent_providers,
    workspace?.ai_agent_provider,
    workspace?.ai_agent_model,
    workspace?.ai_agent_assignment_mode,
    workspace?.ai_agent_default_assignee_id,
    workspace?.ai_agent_intent_assignees,
  ]);

  useEffect(() => {
    setTestResult(null);
  }, [provider, model, apiKey]);

  const save = useMutation({
    mutationFn: () => api.updateWorkspace({
      ai_provider: provider || undefined,
      ai_model:    model    || undefined,
      ai_api_key:  apiKey   || undefined,
      settings_json: {
        ai_business_prompt: businessPrompt,
        ai_business_products_services: productsServices,
        ai_business_policies: policies,
        ai_business_tone: tone,
        ai_agent_providers: agentProviders,
        ai_agent_provider: "workers_ai", // keep for backwards compat
        ai_agent_model: "",
        ai_agent_assignment_mode: assignmentMode,
        ai_agent_default_assignee_id: defaultAssigneeId || "",
        ai_agent_intent_assignees: intentAssignees,
      },
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/workspaces/current"] });
      setApiKey("");
      toast({ title: "Configuración de IA guardada" });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const testConnection = useMutation({
    mutationFn: () => api.testAiConnection({
      ai_provider: provider || undefined,
      ai_model: model || undefined,
      ai_api_key: apiKey || undefined,
    }),
    onSuccess: (result) => {
      setTestResult(result);
      toast({ title: "Conexion validada" });
    },
    onError: (e: any) => {
      setTestResult({ ok: false, message: e.message });
      toast({ title: "Fallo la conexion", description: e.message, variant: "destructive" });
    },
  });

  const selectedProvider = AI_PROVIDERS.find(p => p.id === provider);
  const hasKey  = !!workspace?.ai_provider;
  const canSave = !provider || apiKey || hasKey;
  const canTest = provider && (apiKey || hasKey);
  const memberList = Array.isArray(members) ? members : members?.data ?? [];
  const assignableMembers = memberList
    .map((member: any) => member.user ?? member)
    .filter((member: any) => member?.id);
  const intentOptions = [
    { id: "ORDER", label: "Pedidos" },
    { id: "APPOINTMENT", label: "Citas" },
    { id: "QUOTE", label: "Cotizaciones" },
    { id: "COMPLAINT", label: "Reclamos" },
  ];
  const updateIntentAssignee = (intent: string, userId: string) => {
    setIntentAssignees((current) => {
      const next = { ...current };
      if (!userId || userId === "none") delete next[intent];
      else next[intent] = userId;
      return next;
    });
  };

  return (
    <SettingsLayout>
      <div className="space-y-6 max-w-3xl">
        <div>
          <p style={{ fontSize: "13px", color: "hsl(var(--fg-2))", lineHeight: 1.6 }}>
            PymeHub usa tu propia API key — tú controlas el costo. La clave se guarda encriptada y nunca se expone.
          </p>
        </div>

        {hasKey && (
          <div className="flex items-center gap-2 px-3 py-2 rounded"
            style={{ background: "hsl(142 60% 12%)", border: "1px solid hsl(142 60% 25%)" }}>
            <CheckCircle2 style={{ width: 13, height: 13, color: "hsl(142 60% 50%)" }} />
            <span style={{ fontSize: "12px", color: "hsl(142 60% 60%)" }}>
              API key configurada · {AI_PROVIDERS.find(p => p.id === workspace.ai_provider)?.label ?? workspace.ai_provider}
              {workspace.ai_model ? ` · ${workspace.ai_model}` : ""}
            </span>
          </div>
        )}

        {testResult?.ok && (
          <div className="rounded border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-200">
            Conexion valida con {AI_PROVIDERS.find(p => p.id === testResult.provider)?.label ?? testResult.provider}
            {testResult.model ? ` · ${testResult.model}` : ""}
            {typeof testResult.latency_ms === "number" ? ` · ${testResult.latency_ms} ms` : ""}
            {testResult.reply ? ` · "${testResult.reply}"` : ""}
          </div>
        )}

        {testResult && testResult.ok === false && (
          <div className="rounded border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-200">
            No se pudo validar la conexion. {testResult.message}
          </div>
        )}

        <div className="space-y-4 max-w-lg">
          <div>
            <Label className="text-xs mb-1 block">Proveedor de IA</Label>
            <Select value={provider} onValueChange={v => { setProvider(v); setModel(""); }}>
              <SelectTrigger className="bg-[hsl(var(--elevated))] border-border">
                <SelectValue placeholder="Selecciona un proveedor" />
              </SelectTrigger>
              <SelectContent className="bg-card border-border">
                {AI_PROVIDERS.map(p => (
                  <SelectItem key={p.id} value={p.id}>{p.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {selectedProvider && (
            <div>
              <Label className="text-xs mb-1 block">Modelo</Label>
              <Select value={model} onValueChange={setModel}>
                <SelectTrigger className="bg-[hsl(var(--elevated))] border-border">
                  <SelectValue placeholder="Selecciona un modelo" />
                </SelectTrigger>
                <SelectContent className="bg-card border-border">
                  {selectedProvider.models.map(m => (
                    <SelectItem key={m} value={m}>{m}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div>
            <Label className="text-xs mb-1 block">
              API Key {hasKey && <span style={{ color: "hsl(var(--fg-3))" }}>(dejar vacío para mantener la actual)</span>}
            </Label>
            <div className="relative">
              <Input
                type={showKey ? "text" : "password"}
                value={apiKey}
                onChange={e => setApiKey(e.target.value)}
                placeholder={hasKey ? "••••••••••••••••••••" : "sk-... / AIza... / re_..."}
                className="pr-9 bg-[hsl(var(--elevated))] border-border font-mono text-xs"
              />
              <button
                type="button"
                onClick={() => setShowKey(v => !v)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                {showKey ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
              </button>
            </div>
          </div>

          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => testConnection.mutate()}
              disabled={!canTest || testConnection.isPending}
              className="h-8 text-xs border-border"
            >
              {testConnection.isPending ? "Probando..." : "Probar conexion"}
            </Button>
            <Button
              onClick={() => save.mutate()}
              disabled={!canSave || save.isPending}
              className="bg-primary hover:bg-primary/90 h-8 text-xs"
            >
              {save.isPending ? "Guardando..." : "Guardar configuración"}
            </Button>
          </div>
        </div>

        <div className="border-t border-border pt-6 space-y-4">
          <div className="flex items-center gap-2">
            <Bot className="h-4 w-4 text-primary" />
            <h2 className="text-sm font-semibold text-foreground">Contexto del negocio</h2>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="md:col-span-2">
              <Label className="text-xs mb-1 block">Instrucciones para la IA</Label>
              <Textarea
                value={businessPrompt}
                onChange={(e) => setBusinessPrompt(e.target.value)}
                maxLength={2000}
                className="min-h-[110px] bg-[hsl(var(--elevated))] border-border text-sm"
                placeholder="Ej: Somos una cafeteria de especialidad. Responde de forma calida, ofrece opciones disponibles y escala a humano si preguntan por eventos grandes."
              />
            </div>

            <div>
              <Label className="text-xs mb-1 block">Productos o servicios</Label>
              <Textarea
                value={productsServices}
                onChange={(e) => setProductsServices(e.target.value)}
                maxLength={2000}
                className="min-h-[96px] bg-[hsl(var(--elevated))] border-border text-sm"
                placeholder="Lista breve de productos, servicios, paquetes, zonas o especialidades."
              />
            </div>

            <div>
              <Label className="text-xs mb-1 block">Politicas y limites</Label>
              <Textarea
                value={policies}
                onChange={(e) => setPolicies(e.target.value)}
                maxLength={2000}
                className="min-h-[96px] bg-[hsl(var(--elevated))] border-border text-sm"
                placeholder="Horarios, tiempos de respuesta, reglas de entrega, reservas, devoluciones o que nunca debe prometer."
              />
            </div>

            <div className="md:col-span-2">
              <Label className="text-xs mb-1 block">Tono de marca</Label>
              <Input
                value={tone}
                onChange={(e) => setTone(e.target.value)}
                maxLength={240}
                className="bg-[hsl(var(--elevated))] border-border text-sm"
                placeholder="Ej: cercano, profesional, conciso, sin emojis, estilo premium."
              />
            </div>
          </div>
        </div>

        <div className="border-t border-border pt-6 space-y-4">
          <div className="flex items-center gap-2">
            <ClipboardList className="h-4 w-4 text-primary" />
            <h2 className="text-sm font-semibold text-foreground">Agente y tareas</h2>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="md:col-span-2">
              <Label className="text-xs mb-2 block">Proveedores del Agente IA · Load Balancer</Label>
              <p className="text-[11px] text-muted-foreground mb-3">
                El agente intentará los proveedores en orden. Si uno falla, pasa al siguiente automáticamente.
              </p>

              {/* Ordered list of selected providers */}
              <div className="space-y-2 mb-3">
                {agentProviders.map((modelId, index) => {
                  const info = GATEWAY_MODELS.find(m => m.id === modelId);
                  return (
                    <div key={modelId} className="flex items-center gap-2 rounded-lg border border-border/60 bg-card/40 px-3 py-2">
                      <span className="text-[10px] text-muted-foreground font-mono w-4 text-center">{index + 1}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-foreground truncate">
                          {info?.label ?? modelId}
                          {info?.badge && (
                            <span className="ml-1.5 text-[9px] bg-emerald-500/15 text-emerald-400 px-1.5 py-0.5 rounded-full">
                              {info.badge}
                            </span>
                          )}
                        </p>
                        <p className="text-[10px] text-muted-foreground">{info?.provider ?? ""} · {modelId}</p>
                      </div>
                      <div className="flex gap-1 shrink-0">
                        <button
                          type="button"
                          onClick={() => setAgentProviders(prev => {
                            if (index === 0) return prev;
                            const next = [...prev];
                            [next[index - 1], next[index]] = [next[index], next[index - 1]];
                            return next;
                          })}
                          disabled={index === 0}
                          className="p-1 rounded hover:bg-sidebar-accent/40 disabled:opacity-30 disabled:cursor-not-allowed"
                          title="Subir"
                        >
                          ▲
                        </button>
                        <button
                          type="button"
                          onClick={() => setAgentProviders(prev => {
                            if (index === prev.length - 1) return prev;
                            const next = [...prev];
                            [next[index], next[index + 1]] = [next[index + 1], next[index]];
                            return next;
                          })}
                          disabled={index === agentProviders.length - 1}
                          className="p-1 rounded hover:bg-sidebar-accent/40 disabled:opacity-30 disabled:cursor-not-allowed"
                          title="Bajar"
                        >
                          ▼
                        </button>
                        <button
                          type="button"
                          onClick={() => setAgentProviders(prev => prev.filter((_, i) => i !== index))}
                          className="p-1 rounded hover:bg-destructive/20 text-muted-foreground hover:text-destructive"
                          title="Quitar"
                        >
                          ✕
                        </button>
                      </div>
                    </div>
                  );
                })}
                {agentProviders.length === 0 && (
                  <p className="text-[11px] text-amber-400 py-2">Sin proveedores configurados — el agente no responderá.</p>
                )}
              </div>

              {/* Add provider selector */}
              <div className="flex gap-2">
                <Select
                  value={addingModel}
                  onValueChange={setAddingModel}
                >
                  <SelectTrigger className="bg-[hsl(var(--elevated))] border-border text-xs h-8 flex-1">
                    <SelectValue placeholder="Agregar proveedor..." />
                  </SelectTrigger>
                  <SelectContent className="bg-card border-border">
                    {GATEWAY_MODELS.filter(m => !agentProviders.includes(m.id)).map(m => (
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
                      setAgentProviders(prev => [...prev, addingModel]);
                      setAddingModel("");
                    }
                  }}
                >
                  Agregar
                </Button>
              </div>
            </div>

            <div>
              <Label className="text-xs mb-1 block">Asignacion de tareas creadas por IA</Label>
              <Select value={assignmentMode} onValueChange={setAssignmentMode}>
                <SelectTrigger className="bg-[hsl(var(--elevated))] border-border">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-card border-border">
                  <SelectItem value="conversation_assignee">Usar agente asignado a la conversacion</SelectItem>
                  <SelectItem value="default_user">Usar responsable predeterminado</SelectItem>
                  <SelectItem value="unassigned">Dejar sin asignar</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label className="text-xs mb-1 block">Responsable predeterminado</Label>
              <Select
                value={defaultAssigneeId || "none"}
                onValueChange={(value) => setDefaultAssigneeId(value === "none" ? "" : value)}
              >
                <SelectTrigger className="bg-[hsl(var(--elevated))] border-border">
                  <SelectValue placeholder="Sin responsable" />
                </SelectTrigger>
                <SelectContent className="bg-card border-border">
                  <SelectItem value="none">Sin responsable</SelectItem>
                  {assignableMembers.map((member: any) => (
                    <SelectItem key={member.id} value={member.id}>
                      {member.name ?? member.email ?? member.id}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            {intentOptions.map((intent) => (
              <div key={intent.id}>
                <Label className="text-xs mb-1 block">{intent.label}</Label>
                <Select
                  value={intentAssignees[intent.id] ?? "none"}
                  onValueChange={(value) => updateIntentAssignee(intent.id, value)}
                >
                  <SelectTrigger className="bg-[hsl(var(--elevated))] border-border">
                    <SelectValue placeholder="Usar regla general" />
                  </SelectTrigger>
                  <SelectContent className="bg-card border-border">
                    <SelectItem value="none">Usar regla general</SelectItem>
                    {assignableMembers.map((member: any) => (
                      <SelectItem key={member.id} value={member.id}>
                        {member.name ?? member.email ?? member.id}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ))}
          </div>

          <Button
            onClick={() => save.mutate()}
            disabled={!canSave || save.isPending}
            className="bg-primary hover:bg-primary/90 h-8 text-xs"
          >
            {save.isPending ? "Guardando..." : "Guardar reglas del agente"}
          </Button>
        </div>
      </div>
    </SettingsLayout>
  );
}
