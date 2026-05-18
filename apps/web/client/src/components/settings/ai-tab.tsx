import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Eye, EyeOff, CheckCircle2 } from "lucide-react";
import { api } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

type AiTestResult = { ok: boolean; message?: string; provider?: string; model?: string; latency_ms?: number; reply?: string };

const AI_PROVIDERS = [
  { id: "openai",    label: "OpenAI",          models: ["gpt-4o-mini", "gpt-4o", "gpt-4-turbo"] },
  { id: "anthropic", label: "Anthropic (Claude)", models: ["claude-haiku-4-5-20251001", "claude-sonnet-4-6", "claude-opus-4-7"] },
  { id: "gemini",    label: "Google Gemini",   models: ["gemini-2.0-flash", "gemini-1.5-pro"] },
  { id: "moonshot",  label: "Moonshot (Kimi)",  models: ["moonshot-v1-8k", "moonshot-v1-32k"] },
];

export function AiTab() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const { data: workspace } = useQuery({ queryKey: ["/api/workspaces/current"], queryFn: api.getWorkspace });

  const [provider, setProvider] = useState("");
  const [model, setModel]       = useState("");
  const [apiKey, setApiKey]     = useState("");
  const [showKey, setShowKey]   = useState(false);
  const [testResult, setTestResult] = useState<AiTestResult | null>(null);

  useEffect(() => {
    if (workspace) {
      setProvider(workspace.ai_provider ?? "");
      setModel(workspace.ai_model ?? "");
    }
  }, [workspace?.ai_provider, workspace?.ai_model]);

  useEffect(() => {
    setTestResult(null);
  }, [provider, model, apiKey]);

  const save = useMutation({
    mutationFn: () => api.updateWorkspace({
      ai_provider: provider || undefined,
      ai_model:    model    || undefined,
      ai_api_key:  apiKey   || undefined,
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/workspaces/current"] });
      setApiKey("");
      toast({ title: "Configuración de IA guardada" });
    },
    onError: (e) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const testConnection = useMutation({
    mutationFn: () => api.testAiConnection({
      ai_provider: provider || undefined,
      ai_model: model || undefined,
      ai_api_key: apiKey || undefined,
    }),
    onSuccess: (result) => {
      setTestResult(result as AiTestResult);
      toast({ title: "Conexion validada" });
    },
    onError: (e) => {
      setTestResult({ ok: false, message: e.message });
      toast({ title: "Fallo la conexion", description: e.message, variant: "destructive" });
    },
  });

  const selectedProvider = AI_PROVIDERS.find(p => p.id === provider);
  const hasKey  = !!workspace?.ai_provider;
  const canSave = provider && (apiKey || hasKey);
  const canTest = provider && (apiKey || hasKey);

  return (
    <div className="space-y-6 max-w-lg">
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

      <div className="space-y-4">
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
    </div>
  );
}
