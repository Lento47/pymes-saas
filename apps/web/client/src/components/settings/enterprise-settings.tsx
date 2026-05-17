import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { api } from "@/lib/api";
import { apiErrorDescription } from "@/lib/api-error";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Loader2, Save, Building2 } from "lucide-react";

const SLA_TIERS = ["none", "standard", "priority", "custom"];
const SUPPORT_TIERS = ["standard", "priority", "dedicated", "custom"];
const SECURITY_TIERS = ["standard", "advanced", "custom"];
const ONBOARDING_TIERS = ["none", "assisted", "dedicated", "custom"];

export default function EnterpriseSettingsTab() {
  const { user } = useAuth();
  const { toast } = useToast();
  const workspaceId = user?.workspace?.id ?? "";

  const { data: config, isLoading } = useQuery({
    queryKey: ["enterprise-config", workspaceId],
    queryFn: () => api.getEnterpriseConfig(workspaceId),
    enabled: !!workspaceId,
    retry: false,
  });

  const { data: capabilities = [] } = useQuery({
    queryKey: ["enterprise-capabilities"],
    queryFn: api.getEnterpriseCapabilities,
    retry: false,
    staleTime: 60000,
  });

  const [customPrice, setCustomPrice] = useState("");
  const [customAnnualPrice, setCustomAnnualPrice] = useState("");
  const [contractType, setContractType] = useState("monthly");
  const [slaTier, setSlaTier] = useState("none");
  const [supportTier, setSupportTier] = useState("standard");
  const [securityTier, setSecurityTier] = useState("standard");
  const [onboardingTier, setOnboardingTier] = useState("none");
  const [limits, setLimits] = useState<Record<string, string>>({});
  const [internalNotes, setInternalNotes] = useState("");
  const [enabledCaps, setEnabledCaps] = useState<string[]>([]);

  // Sync state from fetched config
  useEffect(() => {
    if (config) {
      setCustomPrice(String(config.custom_monthly_price ?? ""));
      setCustomAnnualPrice(String(config.custom_annual_price ?? ""));
      setContractType(config.contract_type ?? "monthly");
      setSlaTier(config.sla_tier ?? "none");
      setSupportTier(config.support_tier ?? "standard");
      setSecurityTier(config.security_tier ?? "standard");
      setOnboardingTier(config.onboarding_tier ?? "none");
      setInternalNotes(config.internal_notes ?? "");
      setEnabledCaps(config.enabled_capabilities ?? []);
      const cl = config.custom_limits ?? {};
      setLimits({
        contacts: String(cl.contacts ?? ""),
        invoicesPerMonth: String(cl.invoicesPerMonth ?? ""),
        automations: String(cl.automations ?? ""),
        storageGb: String(cl.storageGb ?? ""),
        locations: String(cl.locations ?? ""),
        users: String(cl.users ?? ""),
      });
    }
  }, [config]);

  const saveMutation = useMutation({
    mutationFn: () =>
      api.upsertEnterpriseConfig(workspaceId, {
        custom_monthly_price: customPrice ? parseFloat(customPrice) : null,
        custom_annual_price: customAnnualPrice ? parseFloat(customAnnualPrice) : null,
        contract_type: contractType,
        sla_tier: slaTier,
        support_tier: supportTier,
        security_tier: securityTier,
        onboarding_tier: onboardingTier,
        internal_notes: internalNotes,
        enabled_capabilities: enabledCaps,
        custom_limits: {
          contacts: limits.contacts ? parseInt(limits.contacts) : undefined,
          invoicesPerMonth: limits.invoicesPerMonth ? parseInt(limits.invoicesPerMonth) : undefined,
          automations: limits.automations ? parseInt(limits.automations) : undefined,
          storageGb: limits.storageGb ? parseInt(limits.storageGb) : undefined,
          locations: limits.locations ? parseInt(limits.locations) : undefined,
          users: limits.users ? parseInt(limits.users) : undefined,
        },
      }),
    onSuccess: () => toast({ title: "Configuración guardada" }),
    onError: (err) => toast({ title: "Error", description: apiErrorDescription(err), variant: "destructive" }),
  });

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 py-4">
        <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
        <span className="text-xs text-muted-foreground">Cargando configuración...</span>
      </div>
    );
  }

  const plan = user?.workspace?.plan ?? "FREE";
  const isBusinessPlus = plan === "BUSINESS_PLUS" || plan === "ENTERPRISE";

  if (!isBusinessPlus) {
    return (
      <div className="text-center py-8">
        <Building2 className="w-8 h-8 text-muted-foreground mx-auto mb-3" />
        <p className="text-sm text-muted-foreground">
          Esta sección está disponible para planes Business+.
        </p>
        <p className="text-xs text-muted-foreground mt-1">
          Contactá a ventas para conocer más.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-sm font-semibold text-foreground mb-4">Enterprise Configuration</h3>
      </div>

      {/* Pricing */}
      <div className="space-y-3">
        <h4 className="text-xs font-semibold text-muted-foreground uppercase">Precio personalizado</h4>
        <div className="grid gap-3 md:grid-cols-2">
          <div>
            <Label className="text-xs">Precio mensual (CRC)</Label>
            <Input
              value={customPrice}
              onChange={(e) => setCustomPrice(e.target.value)}
              placeholder="Ej: 149900"
              className="mt-1 bg-[hsl(var(--elevated))] border-border"
            />
          </div>
          <div>
            <Label className="text-xs">Precio anual (CRC)</Label>
            <Input
              value={customAnnualPrice}
              onChange={(e) => setCustomAnnualPrice(e.target.value)}
              placeholder="Ej: 1499000"
              className="mt-1 bg-[hsl(var(--elevated))] border-border"
            />
          </div>
        </div>
        <div>
          <Label className="text-xs">Tipo de contrato</Label>
          <Select value={contractType} onValueChange={setContractType}>
            <SelectTrigger className="mt-1 bg-[hsl(var(--elevated))] border-border w-48">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-card border-border">
              <SelectItem value="monthly">Mensual</SelectItem>
              <SelectItem value="annual">Anual</SelectItem>
              <SelectItem value="custom">Personalizado</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Custom Limits */}
      <div className="space-y-3">
        <h4 className="text-xs font-semibold text-muted-foreground uppercase">Límites personalizados</h4>
        <div className="grid gap-3 md:grid-cols-3">
          {["contacts", "invoicesPerMonth", "automations", "storageGb", "locations", "users"].map((key) => (
            <div key={key}>
              <Label className="text-xs capitalize">{key.replace(/([A-Z])/g, " $1")}</Label>
              <Input
                value={limits[key] ?? ""}
                onChange={(e) => setLimits((prev) => ({ ...prev, [key]: e.target.value }))}
                placeholder="Sin límite"
                className="mt-1 bg-[hsl(var(--elevated))] border-border"
              />
            </div>
          ))}
        </div>
      </div>

      {/* Tiers */}
      <div className="space-y-3">
        <h4 className="text-xs font-semibold text-muted-foreground uppercase">Niveles de servicio</h4>
        <div className="grid gap-3 md:grid-cols-2">
          <div>
            <Label className="text-xs">SLA Tier</Label>
            <Select value={slaTier} onValueChange={setSlaTier}>
              <SelectTrigger className="mt-1 bg-[hsl(var(--elevated))] border-border">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-card border-border">
                {SLA_TIERS.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Support Tier</Label>
            <Select value={supportTier} onValueChange={setSupportTier}>
              <SelectTrigger className="mt-1 bg-[hsl(var(--elevated))] border-border">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-card border-border">
                {SUPPORT_TIERS.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Security Tier</Label>
            <Select value={securityTier} onValueChange={setSecurityTier}>
              <SelectTrigger className="mt-1 bg-[hsl(var(--elevated))] border-border">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-card border-border">
                {SECURITY_TIERS.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Onboarding Tier</Label>
            <Select value={onboardingTier} onValueChange={setOnboardingTier}>
              <SelectTrigger className="mt-1 bg-[hsl(var(--elevated))] border-border">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-card border-border">
                {ONBOARDING_TIERS.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* Capabilities */}
      {capabilities.length > 0 && (
        <div className="space-y-3">
          <h4 className="text-xs font-semibold text-muted-foreground uppercase">Capacidades habilitadas</h4>
          <div className="grid gap-2 md:grid-cols-2">
            {capabilities.map((cap) => (
              <div key={cap.key} className="flex items-center justify-between rounded-lg border border-border bg-[hsl(var(--elevated))] p-3">
                <div>
                  <span className="text-xs font-medium text-foreground">{cap.name}</span>
                  <Badge variant="outline" className="text-[9px] ml-2 px-1 py-0">
                    {cap.status}
                  </Badge>
                </div>
                <Switch
                  checked={enabledCaps.includes(cap.key)}
                  onCheckedChange={(checked) => {
                    setEnabledCaps((prev) =>
                      checked ? [...prev, cap.key] : prev.filter((k) => k !== cap.key),
                    );
                  }}
                />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Internal notes */}
      <div>
        <Label className="text-xs">Notas internas</Label>
        <textarea
          value={internalNotes}
          onChange={(e) => setInternalNotes(e.target.value)}
          placeholder="Notas internas del contrato..."
          className="mt-1 w-full min-h-[80px] rounded-lg border border-border bg-[hsl(var(--elevated))] px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground resize-y"
        />
      </div>

      {/* Save */}
      <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending} size="sm" className="gap-1.5">
        {saveMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
        Guardar configuración
      </Button>
    </div>
  );
}
