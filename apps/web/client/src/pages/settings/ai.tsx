import { useEffect, useState, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Eye, EyeOff, CheckCircle2, Bot, ShoppingCart, UtensilsCrossed, Zap, Stethoscope, Megaphone, Briefcase, Store, LayoutGrid } from "lucide-react";
import { SettingsLayout } from "@/components/settings/settings-layout";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";

function usePromptAssist(field: string, value: string, minLen = 30) {
  const [suggestion, setSuggestion] = useState("");
  const [loading, setLoading] = useState(false);
  const dismiss = useCallback(() => setSuggestion(""), []);

  useEffect(() => {
    setSuggestion("");
    if (value.trim().length < minLen) return;
    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await api.askAssistant(field, value);
        const text = res.suggestion || res.reply || "";
        if (text && text.trim() !== value.trim()) setSuggestion(text.trim());
      } catch { /* silent */ } finally { setLoading(false); }
    }, 1200);
    return () => clearTimeout(timer);
  }, [field, value, minLen]);

  return { suggestion, loading, dismiss };
}

function PromptSuggestion({
  suggestion, loading, onApply, onDismiss,
}: { suggestion: string; loading: boolean; onApply: () => void; onDismiss: () => void }) {
  if (loading) {
    return <p className="mt-1 text-[11px] text-muted-foreground animate-pulse">✨ Generando sugerencia...</p>;
  }
  if (!suggestion) return null;
  return (
    <div className="mt-1.5 rounded-md border border-primary/20 bg-primary/5 p-2.5 text-[11px]">
      <p className="font-medium text-primary mb-1">✨ Sugerencia IA</p>
      <p className="text-foreground/80 whitespace-pre-wrap leading-4">{suggestion}</p>
      <div className="mt-2 flex gap-3">
        <button onClick={onApply} className="font-medium text-primary hover:underline">Aplicar</button>
        <button onClick={onDismiss} className="text-muted-foreground hover:text-foreground transition-colors">Descartar</button>
      </div>
    </div>
  );
}

type ProfileFields = {
  ai_business_prompt: string;
  ai_business_products_services: string;
  ai_business_policies: string;
  ai_business_tone: string;
  ai_main_objective: string;
  ai_cannot_do: string;
  ai_escalation_conditions: string;
  ai_sensitive_info: string;
  ai_supported_languages: string;
  ai_max_response_time: string;
};

const BUSINESS_PROFILES: { id: string; label: string; Icon: React.ElementType; fields: ProfileFields }[] = [
  {
    id: "ecommerce",
    label: "Tienda / Ecommerce",
    Icon: ShoppingCart,
    fields: {
      ai_business_prompt: "Soy el asistente virtual de esta tienda online. Ayudo a los clientes con información sobre productos, estado de pedidos, opciones de envío y política de devoluciones.",
      ai_business_products_services: "Catálogo de productos físicos con entrega a domicilio. Incluye variantes de talla, color y modelo.",
      ai_business_policies: "Envíos en 3-5 días hábiles. Devoluciones en 30 días con producto sin uso. Pago con tarjeta, transferencia o contra entrega.",
      ai_business_tone: "Amigable, entusiasta, orientado a la venta",
      ai_main_objective: "Convertir consultas en ventas. Atender pedidos, catálogo, envíos y devoluciones.",
      ai_cannot_do: "No puede confirmar pagos. No puede cancelar pedidos sin validación del sistema. No puede cambiar precios. No puede acceder a datos de tarjetas.",
      ai_escalation_conditions: "Pedidos perdidos, disputas de pago, solicitudes de reembolso, reclamos sin resolver en 48h.",
      ai_sensitive_info: "No compartir información de otros clientes ni datos internos de inventario o proveedores.",
      ai_supported_languages: "Español",
      ai_max_response_time: "Responder en menos de 1 hora en horario laboral (lunes-sábado 8am-6pm).",
    },
  },
  {
    id: "restaurante",
    label: "Restaurante / Cafetería",
    Icon: UtensilsCrossed,
    fields: {
      ai_business_prompt: "Soy el asistente del restaurante. Ayudo con el menú, horarios, reservas y pedidos para delivery.",
      ai_business_products_services: "Menú de comidas y bebidas. Servicio en local y delivery. Carta especial para eventos.",
      ai_business_policies: "Reservas con mínimo 2h de anticipación. Delivery en radio de 5km. Menú actualizado semanalmente.",
      ai_business_tone: "Cálido, hospitalario, apetitoso",
      ai_main_objective: "Gestionar reservas, informar menú del día y horarios, tomar pedidos para delivery.",
      ai_cannot_do: "No puede confirmar reservas en horarios ya llenos sin consultar disponibilidad. No puede cambiar precios del menú. No puede procesar pagos.",
      ai_escalation_conditions: "Quejas sobre calidad de alimentos, solicitudes de grupos grandes (+10 personas), alergias o necesidades dietéticas especiales.",
      ai_sensitive_info: "No compartir fórmulas de recetas, datos de proveedores ni información interna del negocio.",
      ai_supported_languages: "Español",
      ai_max_response_time: "Responder en menos de 30 minutos durante horario de atención.",
    },
  },
  {
    id: "comidas_rapidas",
    label: "Comidas Rápidas",
    Icon: Zap,
    fields: {
      ai_business_prompt: "Soy el asistente de atención rápida. Tomo pedidos, informo tiempos de espera y gestiono delivery y recogida.",
      ai_business_products_services: "Combos, hamburguesas, wraps, bebidas. Personalización básica de ingredientes. Delivery y para llevar.",
      ai_business_policies: "Tiempo promedio de preparación 15-20 minutos. Sin reservas, servicio por orden de llegada. Delivery mínimo $5.",
      ai_business_tone: "Rápido, directo, energético",
      ai_main_objective: "Tomar pedidos, informar disponibilidad y tiempo de espera, confirmar pickup o delivery.",
      ai_cannot_do: "No puede modificar precios ni aplicar descuentos sin código válido. No puede garantizar tiempos exactos. No puede procesar pagos.",
      ai_escalation_conditions: "Pedidos incorrectos, quejas de calidad, demoras de más de 30 minutos, solicitudes de reembolso.",
      ai_sensitive_info: "No compartir datos de otros pedidos ni información interna de operaciones.",
      ai_supported_languages: "Español",
      ai_max_response_time: "Responder en menos de 10 minutos.",
    },
  },
  {
    id: "clinica",
    label: "Clínica / Estética",
    Icon: Stethoscope,
    fields: {
      ai_business_prompt: "Soy el asistente de la clínica. Ayudo a agendar citas, informar sobre tratamientos disponibles y recopilar datos del paciente para la consulta.",
      ai_business_products_services: "Consultas médicas, tratamientos estéticos, exámenes. Atención presencial y telemedicina.",
      ai_business_policies: "Citas con 24h de anticipación mínimo. Cancelación con 12h de aviso. Se requiere nombre completo, cédula y motivo de consulta.",
      ai_business_tone: "Profesional, empático, tranquilizador",
      ai_main_objective: "Agendar citas, informar sobre tratamientos y precios, recopilar datos iniciales del paciente.",
      ai_cannot_do: "No puede dar diagnósticos médicos ni recomendaciones de tratamiento. No puede confirmar disponibilidad sin verificar la agenda del médico. No puede acceder a historial clínico.",
      ai_escalation_conditions: "Urgencias médicas o síntomas graves. Solicitudes de historial clínico. Quejas sobre procedimientos o efectos adversos.",
      ai_sensitive_info: "Datos de salud e historial médico son estrictamente confidenciales. No confirmar ni divulgar información de pacientes a terceros.",
      ai_supported_languages: "Español",
      ai_max_response_time: "Responder en menos de 2 horas en horario de atención.",
    },
  },
  {
    id: "agencia_marketing",
    label: "Agencia de Marketing",
    Icon: Megaphone,
    fields: {
      ai_business_prompt: "Soy el asistente de ventas de la agencia. Califico leads, presento nuestros servicios y agendo reuniones de descubrimiento.",
      ai_business_products_services: "Social media management, publicidad digital, SEO, diseño gráfico, desarrollo web, email marketing.",
      ai_business_policies: "Reuniones de diagnóstico gratuitas de 30 minutos. Propuestas personalizadas en 3-5 días hábiles. Contratos mínimos de 3 meses.",
      ai_business_tone: "Estratégico, creativo, orientado a resultados",
      ai_main_objective: "Calificar leads, agendar reuniones de descubrimiento, presentar casos de éxito y servicios.",
      ai_cannot_do: "No puede cotizar sin entender el alcance completo del proyecto. No puede comprometer fechas de entrega ni garantizar resultados específicos.",
      ai_escalation_conditions: "Clientes con presupuesto mensual mayor a $3000. Solicitudes urgentes de campañas activas. Clientes de marcas reconocidas.",
      ai_sensitive_info: "No compartir estrategias de campañas activas, datos de performance de otros clientes ni información de contratos.",
      ai_supported_languages: "Español, Inglés",
      ai_max_response_time: "Responder en menos de 4 horas en días hábiles (lunes-viernes 9am-5pm).",
    },
  },
  {
    id: "servicios_profesionales",
    label: "Servicios Profesionales",
    Icon: Briefcase,
    fields: {
      ai_business_prompt: "Soy el asistente del despacho profesional. Agendo consultas iniciales, informo sobre servicios y áreas de práctica, y califico casos potenciales.",
      ai_business_products_services: "Consultoría y asesoría profesional especializada. Consulta inicial gratuita de 20 minutos.",
      ai_business_policies: "Consultas con cita previa. Respuesta en 24 horas hábiles. Honorarios definidos caso por caso.",
      ai_business_tone: "Formal, confiable, experto",
      ai_main_objective: "Captar clientes potenciales, informar sobre servicios, agendar consultas iniciales.",
      ai_cannot_do: "No puede dar asesoría legal, contable o técnica directa. No puede comprometer honorarios sin consulta con el profesional. No puede emitir documentos oficiales.",
      ai_escalation_conditions: "Casos urgentes o con plazos legales próximos. Montos o complejidad que requieren evaluación directa del profesional.",
      ai_sensitive_info: "Toda información de clientes es estrictamente confidencial por secreto profesional. Nunca divulgar datos de casos a terceros.",
      ai_supported_languages: "Español",
      ai_max_response_time: "Responder en menos de 24 horas hábiles.",
    },
  },
  {
    id: "retail",
    label: "Tienda Física / Retail",
    Icon: Store,
    fields: {
      ai_business_prompt: "Soy el asistente de la tienda. Informo sobre productos disponibles, precios, horarios y ubicación.",
      ai_business_products_services: "Productos físicos disponibles en local. Consultas de stock, precios y disponibilidad.",
      ai_business_policies: "Horario de atención lunes a sábado. Cambios y devoluciones en 15 días con ticket de compra. No se aceptan devoluciones de artículos en oferta.",
      ai_business_tone: "Servicial, amable, local",
      ai_main_objective: "Informar disponibilidad de productos, horarios y ubicación. Generar visitas a la tienda.",
      ai_cannot_do: "No puede reservar productos por más de 24h sin pago. No puede confirmar precios sin verificar stock actualizado. No puede procesar pagos.",
      ai_escalation_conditions: "Quejas de productos defectuosos, solicitudes de garantía, pedidos mayoristas.",
      ai_sensitive_info: "No compartir información de proveedores ni márgenes de precio.",
      ai_supported_languages: "Español",
      ai_max_response_time: "Responder en menos de 2 horas en horario de atención.",
    },
  },
];

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
  const [customApiEnabled, setCustomApiEnabled] = useState(true);
  const [selectedProfile, setSelectedProfile] = useState<string | null>(null);
  const [mainObjective, setMainObjective] = useState("");
  const [cannotDo, setCannotDo] = useState("");
  const [escalationConditions, setEscalationConditions] = useState("");
  const [sensitiveInfo, setSensitiveInfo] = useState("");
  const [supportedLanguages, setSupportedLanguages] = useState("");
  const [maxResponseTime, setMaxResponseTime] = useState("");
  const [intentPositiveExamples, setIntentPositiveExamples] = useState("");
  const [intentNegativeExamples, setIntentNegativeExamples] = useState("");

  useEffect(() => {
    if (workspace) {
      setCustomApiEnabled(workspace.ai_custom_api_enabled !== false);
      setProvider(workspace.ai_provider ?? "");
      setModel(workspace.ai_model ?? "");
      setBusinessPrompt(workspace.ai_business_prompt ?? "");
      setProductsServices(workspace.ai_business_products_services ?? "");
      setPolicies(workspace.ai_business_policies ?? "");
      setTone(workspace.ai_business_tone ?? "");
      setMainObjective(workspace.ai_main_objective ?? "");
      setCannotDo(workspace.ai_cannot_do ?? "");
      setEscalationConditions(workspace.ai_escalation_conditions ?? "");
      setSensitiveInfo(workspace.ai_sensitive_info ?? "");
      setSupportedLanguages(workspace.ai_supported_languages ?? "");
      setMaxResponseTime(workspace.ai_max_response_time ?? "");
      setIntentPositiveExamples(workspace.ai_intent_positive_examples ?? "");
      setIntentNegativeExamples(workspace.ai_intent_negative_examples ?? "");
      // never pre-fill the API key
    }
  }, [
    workspace?.ai_custom_api_enabled,
    workspace?.ai_provider,
    workspace?.ai_model,
    workspace?.ai_business_prompt,
    workspace?.ai_business_products_services,
    workspace?.ai_business_policies,
    workspace?.ai_business_tone,
    workspace?.ai_main_objective,
    workspace?.ai_cannot_do,
    workspace?.ai_escalation_conditions,
    workspace?.ai_sensitive_info,
    workspace?.ai_supported_languages,
    workspace?.ai_max_response_time,
    workspace?.ai_intent_positive_examples,
    workspace?.ai_intent_negative_examples,
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
        ai_custom_api_enabled: customApiEnabled,
        ai_business_prompt: businessPrompt,
        ai_business_products_services: productsServices,
        ai_business_policies: policies,
        ai_business_tone: tone,
        ai_main_objective: mainObjective,
        ai_cannot_do: cannotDo,
        ai_escalation_conditions: escalationConditions,
        ai_sensitive_info: sensitiveInfo,
        ai_supported_languages: supportedLanguages,
        ai_max_response_time: maxResponseTime,
        ai_intent_positive_examples: intentPositiveExamples,
        ai_intent_negative_examples: intentNegativeExamples,
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
  const applyProfile = (profile: typeof BUSINESS_PROFILES[0]) => {
    setSelectedProfile(profile.id);
    setBusinessPrompt(profile.fields.ai_business_prompt);
    setProductsServices(profile.fields.ai_business_products_services);
    setPolicies(profile.fields.ai_business_policies);
    setTone(profile.fields.ai_business_tone);
    setMainObjective(profile.fields.ai_main_objective);
    setCannotDo(profile.fields.ai_cannot_do);
    setEscalationConditions(profile.fields.ai_escalation_conditions);
    setSensitiveInfo(profile.fields.ai_sensitive_info);
    setSupportedLanguages(profile.fields.ai_supported_languages);
    setMaxResponseTime(profile.fields.ai_max_response_time);
  };

  const assistBusinessPrompt = usePromptAssist("ai_business_prompt", businessPrompt);
  const assistProducts       = usePromptAssist("ai_business_products_services", productsServices);
  const assistPolicies       = usePromptAssist("ai_business_policies", policies);
  const assistObjective      = usePromptAssist("ai_main_objective", mainObjective);
  const assistCannotDo       = usePromptAssist("ai_cannot_do", cannotDo);
  const assistEscalation     = usePromptAssist("ai_escalation_conditions", escalationConditions);

  return (
    <SettingsLayout>
      <div className="space-y-6 max-w-3xl">
        <div>
          <p style={{ fontSize: "13px", color: "hsl(var(--fg-2))", lineHeight: 1.6 }}>
            PymeHub usa tu propia API key — tú controlas el costo. La clave se guarda encriptada y nunca se expone.
          </p>
        </div>

        {hasKey && (
          <div className="flex items-center gap-2 px-3 py-2 rounded border border-emerald-500/25 bg-emerald-500/10">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
            <span className="text-xs text-emerald-300">
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
          <div className="flex items-center justify-between py-1">
            <div>
              <p className="text-xs font-medium">Activar API personalizada</p>
              <p className="text-[11px] text-muted-foreground">Análisis de conversaciones con tu clave de IA</p>
            </div>
            <Switch checked={customApiEnabled} onCheckedChange={setCustomApiEnabled} />
          </div>

          <div className={cn("space-y-4", !customApiEnabled && "opacity-40 pointer-events-none")}>
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

          </div>{/* end opacity wrapper */}

          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => testConnection.mutate()}
              disabled={!canTest || testConnection.isPending || !customApiEnabled}
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

        {/* ── Perfil de negocio ── */}
        <div className="pt-6 space-y-4">
          <div className="flex items-center gap-2">
            <LayoutGrid className="h-4 w-4 text-primary" />
            <h2 className="text-[15px] font-semibold text-foreground">Perfil de negocio</h2>
          </div>
          <p className="text-[11px] text-muted-foreground">
            Seleccioná una plantilla para configurar el agente automáticamente. Podés editarla después.
          </p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            {BUSINESS_PROFILES.map(({ id, label, Icon }) => (
              <button
                key={id}
                type="button"
                onClick={() => applyProfile(BUSINESS_PROFILES.find(p => p.id === id)!)}
                className={cn(
                  "flex flex-col items-center gap-1.5 rounded-lg border px-3 py-3 text-center transition-colors",
                  selectedProfile === id
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border bg-card/40 text-muted-foreground hover:border-primary/40 hover:text-foreground"
                )}
              >
                <Icon className="h-5 w-5 shrink-0" strokeWidth={1.8} />
                <span className="text-[11px] font-medium leading-tight">{label}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="pt-6 space-y-4">
          <div className="flex items-center gap-2">
            <Bot className="h-4 w-4 text-primary" />
            <h2 className="text-[15px] font-semibold text-foreground">Contexto del negocio</h2>
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
              <PromptSuggestion
                suggestion={assistBusinessPrompt.suggestion}
                loading={assistBusinessPrompt.loading}
                onApply={() => { setBusinessPrompt(assistBusinessPrompt.suggestion); assistBusinessPrompt.dismiss(); }}
                onDismiss={assistBusinessPrompt.dismiss}
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
              <PromptSuggestion
                suggestion={assistProducts.suggestion}
                loading={assistProducts.loading}
                onApply={() => { setProductsServices(assistProducts.suggestion); assistProducts.dismiss(); }}
                onDismiss={assistProducts.dismiss}
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
              <PromptSuggestion
                suggestion={assistPolicies.suggestion}
                loading={assistPolicies.loading}
                onApply={() => { setPolicies(assistPolicies.suggestion); assistPolicies.dismiss(); }}
                onDismiss={assistPolicies.dismiss}
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

          {/* Restricciones y escalado */}
          <div className="pt-2">
            <p className="text-xs font-semibold text-foreground mb-3">Restricciones y escalado</p>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="md:col-span-2">
                <Label className="text-xs mb-1 block">Objetivo principal de la IA</Label>
                <Textarea
                  value={mainObjective}
                  onChange={(e) => setMainObjective(e.target.value)}
                  maxLength={500}
                  className="min-h-[72px] bg-[hsl(var(--elevated))] border-border text-sm"
                  placeholder="Ej: Convertir consultas en ventas. Tomar pedidos y confirmar disponibilidad."
                />
                <PromptSuggestion
                  suggestion={assistObjective.suggestion}
                  loading={assistObjective.loading}
                  onApply={() => { setMainObjective(assistObjective.suggestion); assistObjective.dismiss(); }}
                  onDismiss={assistObjective.dismiss}
                />
              </div>

              <div className="md:col-span-2">
                <Label className="text-xs mb-1 block">Lo que la IA NO puede hacer</Label>
                <Textarea
                  value={cannotDo}
                  onChange={(e) => setCannotDo(e.target.value)}
                  maxLength={1000}
                  className="min-h-[90px] bg-[hsl(var(--elevated))] border-border text-sm"
                  placeholder="Ej: No puede confirmar pagos. No puede cambiar precios. No puede dar diagnósticos médicos."
                />
                <PromptSuggestion
                  suggestion={assistCannotDo.suggestion}
                  loading={assistCannotDo.loading}
                  onApply={() => { setCannotDo(assistCannotDo.suggestion); assistCannotDo.dismiss(); }}
                  onDismiss={assistCannotDo.dismiss}
                />
              </div>

              <div>
                <Label className="text-xs mb-1 block">Cuándo escalar a humano</Label>
                <Textarea
                  value={escalationConditions}
                  onChange={(e) => setEscalationConditions(e.target.value)}
                  maxLength={500}
                  className="min-h-[80px] bg-[hsl(var(--elevated))] border-border text-sm"
                  placeholder="Ej: Pedidos perdidos, disputas de pago, urgencias médicas."
                />
                <PromptSuggestion
                  suggestion={assistEscalation.suggestion}
                  loading={assistEscalation.loading}
                  onApply={() => { setEscalationConditions(assistEscalation.suggestion); assistEscalation.dismiss(); }}
                  onDismiss={assistEscalation.dismiss}
                />
              </div>

              <div>
                <Label className="text-xs mb-1 block">Información sensible (no divulgar)</Label>
                <Textarea
                  value={sensitiveInfo}
                  onChange={(e) => setSensitiveInfo(e.target.value)}
                  maxLength={500}
                  className="min-h-[80px] bg-[hsl(var(--elevated))] border-border text-sm"
                  placeholder="Ej: No compartir datos de otros clientes ni información de proveedores."
                />
              </div>

              <div>
                <Label className="text-xs mb-1 block">Idiomas soportados</Label>
                <Input
                  value={supportedLanguages}
                  onChange={(e) => setSupportedLanguages(e.target.value)}
                  maxLength={120}
                  className="bg-[hsl(var(--elevated))] border-border text-sm"
                  placeholder="Ej: Español, Inglés"
                />
              </div>

              <div>
                <Label className="text-xs mb-1 block">Tiempo de respuesta objetivo</Label>
                <Input
                  value={maxResponseTime}
                  onChange={(e) => setMaxResponseTime(e.target.value)}
                  maxLength={120}
                  className="bg-[hsl(var(--elevated))] border-border text-sm"
                  placeholder="Ej: Responder en menos de 1 hora en horario laboral."
                />
              </div>
            </div>
          </div>

          {/* Calibración de intenciones */}
          <div className="pt-2">
            <p className="text-xs font-semibold text-foreground mb-1">Calibración de intenciones</p>
            <p className="text-[11px] text-muted-foreground mb-3">
              Escribe frases ejemplo para que el agente aprenda cuándo iniciar un flujo estructurado
              (pedido, cita, cotización, reclamo) y cuándo responder de forma conversacional.
            </p>
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <Label className="text-xs mb-1 block">Frases que SÍ deben iniciar un flujo</Label>
                <Textarea
                  value={intentPositiveExamples}
                  onChange={(e) => setIntentPositiveExamples(e.target.value)}
                  maxLength={500}
                  className="min-h-[90px] bg-[hsl(var(--elevated))] border-border text-sm"
                  placeholder={"Quiero hacer un pedido\nNecesito agendar una cita\nMe pueden cotizar...\nQuiero reservar una mesa"}
                />
              </div>
              <div>
                <Label className="text-xs mb-1 block">Frases que NO deben iniciar un flujo</Label>
                <Textarea
                  value={intentNegativeExamples}
                  onChange={(e) => setIntentNegativeExamples(e.target.value)}
                  maxLength={500}
                  className="min-h-[90px] bg-[hsl(var(--elevated))] border-border text-sm"
                  placeholder={"¿Cuáles son sus horarios?\n¿Tienen estacionamiento?\nHola buenos días\n¿Dónde están ubicados?"}
                />
              </div>
            </div>
          </div>
        </div>

      </div>
    </SettingsLayout>
  );
}
