import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { openExternal } from "@/lib/platform";
import { useI18n } from "@/components/providers/i18n-provider";
import { useAuth } from "@/hooks/use-auth";
import { PageHeader } from "@/components/shared/page-header";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useToast } from "@/hooks/use-toast";
import { SUPPORTED_LOCALES, normalizeLocale, type SupportedLocale } from "@/lib/i18n";
import {
  Building2, Users, PlugZap, UserPlus, Plus, Plug,
  Mail, MessageCircle, Radio, Eye, EyeOff, ExternalLink,
  PowerOff, Trash2, Layers, UserMinus, ShieldCheck, Search, BrainCircuit, CheckCircle2, AlertTriangle, BookOpen, CreditCard, Shuffle, Loader2, Key, Copy, Shield,
} from "lucide-react";
import BillingPage from "@/pages/billing";
import { SamlConfig } from "@/components/settings/saml-config";
import { SecretInput } from "@/components/settings/secret-input";
import { DeleteChannelDialog } from "@/components/settings/delete-channel-dialog";
import { ApiKeyCard } from "@/components/settings/api-key-card";
import { EmailConfigModal } from "@/components/settings/email-config-modal";
import { WhatsAppConfigModal } from "@/components/settings/whatsapp-config-modal";
import { MembersTab } from "@/components/settings/members-tab";
import { RoutingRulesTab } from "@/components/settings/routing-rules-tab";
import { IntegrationsTab } from "@/components/settings/integrations-tab";
import { AiTab } from "@/components/settings/ai-tab";
import { ApiTokensTab } from "@/components/settings/api-tokens-tab";
import { ChannelsTab } from "@/components/settings/channels-tab";
import { DepartmentsTab } from "@/components/settings/departments-tab";
import { ROLE_COLORS, CHANNEL_TYPE_COLORS, CHANNEL_ICONS } from "@/components/settings/settings-constants";
import { ModuleHero } from "@/components/shared/module-hero";

function WorkspaceTab() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const { setLocale, messages } = useI18n();
  const { refreshUser } = useAuth();
  const localeCopy = messages.settings.locale;
  const { data, isLoading } = useQuery({
    queryKey: ["/api/workspaces/current"],
    queryFn: () => api.getWorkspace(),
  });
  const [financeOptIn, setFinanceOptIn] = useState(false);
  const [workspaceLocale, setWorkspaceLocale] = useState<SupportedLocale>(() => normalizeLocale());
  const [workspaceName, setWorkspaceName] = useState("");
  const [taxStep, setTaxStep] = useState(0);
  const [taxConfig, setTaxConfig] = useState({
    legal_name: "",
    trade_name: "",
    identification_type: "",
    identification_number: "",
    activity_code: "",
    tax_email: "",
    phone: "",
    province: "",
    canton: "",
    district: "",
    address_detail: "",
    hacienda_environment: "staging",
    hacienda_callback_url: "",
    hacienda_client_id: "",
    hacienda_token_url: "",
    hacienda_username: "",
    hacienda_password: "",
    hacienda_certificate_path: "",
    hacienda_certificate_pin: "",
    hacienda_signing_enabled: false,
  });

  const saveWorkspace = useMutation({
    mutationFn: (payload: Record<string, any>) =>
      api.updateWorkspace(payload),
    onSuccess: (workspace) => {
      qc.setQueryData(["/api/workspaces/current"], workspace);
      setFinanceOptIn(workspace?.ai_message_finance_opt_in === true);
      toast({ title: "Permiso actualizado" });
    },
    onError: (e: any) =>
      toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const saveWorkspaceLocale = useMutation({
    mutationFn: (locale: SupportedLocale) => api.updateWorkspace({ locale }),
    onSuccess: async (workspace) => {
      const nextLocale = normalizeLocale(workspace?.locale);
      qc.setQueryData(["/api/workspaces/current"], workspace);
      setWorkspaceLocale(nextLocale);
      setLocale(nextLocale);
      toast({ title: localeCopy.saved });
      await refreshUser();
    },
    onError: (e: any) =>
      toast({ title: localeCopy.error, description: e.message, variant: "destructive" }),
  });

  const saveWorkspaceName = useMutation({
    mutationFn: (name: string) => api.updateWorkspace({ name: name.trim() }),
    onSuccess: async (workspace) => {
      qc.setQueryData(["/api/workspaces/current"], workspace);
      setWorkspaceName(workspace?.name ?? "");
      toast({ title: "Nombre actualizado" });
      await refreshUser();
    },
    onError: (e: any) =>
      toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const workspace = data;
  const taxChecklist = [
    {
      label: "Perfil fiscal del emisor",
      ready: Boolean(
        taxConfig.legal_name &&
        taxConfig.identification_type &&
        taxConfig.identification_number &&
        taxConfig.activity_code &&
        taxConfig.tax_email,
      ),
      detail: "Razón social, identificación, actividad y correo tributario.",
    },
    {
      label: "Dirección fiscal",
      ready: Boolean(taxConfig.province && taxConfig.canton && taxConfig.district && taxConfig.address_detail),
      detail: "Provincia, cantón, distrito y dirección exacta.",
    },
    {
      label: "Conexión con Hacienda",
      ready: Boolean(
        taxConfig.hacienda_environment &&
        taxConfig.hacienda_callback_url &&
        taxConfig.hacienda_client_id &&
        taxConfig.hacienda_token_url &&
        taxConfig.hacienda_username &&
        taxConfig.hacienda_password,
      ),
      detail: "Ambiente, callback, client ID, token URL y credenciales.",
    },
    {
      label: "Certificado y firma",
      ready: Boolean(
        taxConfig.hacienda_certificate_path &&
        taxConfig.hacienda_certificate_pin &&
        taxConfig.hacienda_signing_enabled,
      ),
      detail: "Ruta del certificado, PIN y firma real activada.",
    },
  ];
  const readyChecklistCount = taxChecklist.filter((item) => item.ready).length;
  const taxSectionStatus = {
    issuer: taxChecklist[0].ready,
    address: taxChecklist[1].ready,
    hacienda: taxChecklist[2].ready,
    certificate: taxChecklist[3].ready,
  };
  const taxSteps = [
    { key: "issuer", title: "1. Perfil fiscal del emisor", description: "Razón social, identificación, actividad y correo tributario.", ready: taxSectionStatus.issuer },
    { key: "address", title: "2. Dirección fiscal", description: "Provincia, cantón, distrito y dirección exacta.", ready: taxSectionStatus.address },
    { key: "hacienda", title: "3. Conexión con Hacienda", description: "Ambiente, callback, client ID, token URL y credenciales.", ready: taxSectionStatus.hacienda },
    { key: "certificate", title: "4. Certificado y firma", description: "Ruta del certificado, PIN y activación de firma real.", ready: taxSectionStatus.certificate },
  ] as const;
  const currentTaxStep = taxSteps[taxStep] ?? taxSteps[0];

  useEffect(() => {
    setFinanceOptIn(workspace?.ai_message_finance_opt_in === true);
    setWorkspaceName(workspace?.name ?? "");
    setTaxConfig({
      legal_name: workspace?.workspace_tax_profile?.legal_name ?? "",
      trade_name: workspace?.workspace_tax_profile?.trade_name ?? "",
      identification_type: workspace?.workspace_tax_profile?.identification_type ?? "",
      identification_number: workspace?.workspace_tax_profile?.identification_number ?? "",
      activity_code: workspace?.workspace_tax_profile?.activity_code ?? "",
      tax_email: workspace?.workspace_tax_profile?.tax_email ?? "",
      phone: workspace?.workspace_tax_profile?.phone ?? "",
      province: workspace?.workspace_tax_profile?.province ?? "",
      canton: workspace?.workspace_tax_profile?.canton ?? "",
      district: workspace?.workspace_tax_profile?.district ?? "",
      address_detail: workspace?.workspace_tax_profile?.address_detail ?? "",
      hacienda_environment: workspace?.hacienda_environment ?? "staging",
      hacienda_callback_url: workspace?.hacienda_callback_url ?? "",
      hacienda_client_id: "",
      hacienda_token_url: "",
      hacienda_username: "",
      hacienda_password: "",
      hacienda_certificate_path: "",
      hacienda_certificate_pin: "",
      hacienda_signing_enabled: workspace?.hacienda_signing_enabled === true,
    });
  }, [workspace?.ai_message_finance_opt_in, workspace?.workspace_tax_profile, workspace?.hacienda_environment, workspace?.hacienda_callback_url, workspace?.hacienda_signing_enabled]);

  useEffect(() => {
    setWorkspaceLocale(normalizeLocale(workspace?.locale));
  }, [workspace?.locale]);

  if (isLoading) return <div className="text-muted-foreground text-sm">Cargando...</div>;
  const ws = workspace;
  const hasFinanceOptInChanges = financeOptIn !== (ws?.ai_message_finance_opt_in === true);
  const hasLocaleChanges = workspaceLocale !== normalizeLocale(ws?.locale);
  const saveTaxConfig = () => saveWorkspace.mutate({
    hacienda_environment: taxConfig.hacienda_environment,
    hacienda_callback_url: taxConfig.hacienda_callback_url,
    hacienda_client_id: taxConfig.hacienda_client_id,
    hacienda_token_url: taxConfig.hacienda_token_url,
    hacienda_username: taxConfig.hacienda_username,
    hacienda_password: taxConfig.hacienda_password,
    hacienda_certificate_path: taxConfig.hacienda_certificate_path,
    hacienda_certificate_pin: taxConfig.hacienda_certificate_pin,
    hacienda_signing_enabled: String(taxConfig.hacienda_signing_enabled),
    tax_profile: {
      legal_name: taxConfig.legal_name,
      trade_name: taxConfig.trade_name,
      identification_type: taxConfig.identification_type,
      identification_number: taxConfig.identification_number,
      activity_code: taxConfig.activity_code,
      tax_email: taxConfig.tax_email,
      phone: taxConfig.phone,
      province: taxConfig.province,
      canton: taxConfig.canton,
      district: taxConfig.district,
      address_detail: taxConfig.address_detail,
    },
  });

  return (
    <div className="space-y-6">
      <section className="space-y-5">
        <div className="grid gap-6 border-b border-border pb-5 lg:grid-cols-[minmax(0,1.8fr)_minmax(320px,0.9fr)] lg:items-start">
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-3">
              <h2 className="text-xl font-semibold tracking-tight text-foreground">{ws?.name ?? "Workspace"}</h2>
              <Badge variant="outline" className="text-blue-400 border-blue-500/30 bg-blue-500/10">
                {ws?.plan}
              </Badge>
            </div>
            <p className="max-w-2xl text-sm text-muted-foreground">
              Configuración general del espacio, permisos rápidos de operación y preparación para facturación electrónica en Costa Rica.
            </p>

            <div className="max-w-xl space-y-2">
              <Label htmlFor="workspace-name" className="text-xs uppercase tracking-[0.14em] text-muted-foreground">
                Nombre del workspace
              </Label>

      <div className="flex gap-2">
                <Input
                  id="workspace-name"
                  value={workspaceName}
                  onChange={(e) => setWorkspaceName(e.target.value)}
                  placeholder="Mi empresa S.A."
                  maxLength={80}
                  className="bg-[hsl(var(--elevated))] border-border"
                />
                <Button
                  onClick={() => saveWorkspaceName.mutate(workspaceName)}
                  disabled={
                    saveWorkspaceName.isPending ||
                    workspaceName.trim().length < 2 ||
                    workspaceName.trim() === (ws?.name ?? "")
                  }
                >
                  {saveWorkspaceName.isPending ? "Guardando…" : "Guardar"}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Los miembros verán este nombre en tiempo real cuando lo cambies.
              </p>
            </div>

            <div className="grid gap-x-10 gap-y-3 sm:grid-cols-2 xl:grid-cols-4">
              {[
                { label: "Slug", value: ws?.slug },
                { label: "Zona horaria", value: ws?.timezone },
                { label: "Idioma", value: ws?.locale },
                { label: "Estado", value: ws?.status ?? "—" },
              ].map(({ label, value }) => (
                <div key={label} className="min-w-0">
                  <div className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">{label}</div>
                  <div className="mt-1 truncate text-sm font-medium text-foreground">{value ?? "—"}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-4 lg:border-l lg:border-border lg:pl-4">
            <div className="rounded-lg border border-border bg-[hsl(var(--elevated))] p-4">
              <div>
                <div className="text-sm font-medium text-foreground">{localeCopy.title}</div>
                <div className="mt-1 text-xs leading-5 text-muted-foreground">
                  {localeCopy.description}
                </div>
              </div>

              <div className="mt-4 space-y-2">
                <Label htmlFor="workspace-language" className="text-xs uppercase tracking-[0.14em] text-muted-foreground">
                  {localeCopy.label}
                </Label>
                <Select
                  value={workspaceLocale}
                  onValueChange={(value) => setWorkspaceLocale(value as SupportedLocale)}
                >
                  <SelectTrigger
                    id="workspace-language"
                    className="bg-[hsl(var(--elevated))] border-border"
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-card border-border">
                    {SUPPORTED_LOCALES.map((locale) => (
                      <SelectItem key={locale} value={locale}>
                        {locale === "en" ? messages.language.english : messages.language.spanish}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="mt-4 flex justify-end">
                <Button
                  size="sm"
                  onClick={() => saveWorkspaceLocale.mutate(workspaceLocale)}
                  disabled={!hasLocaleChanges || saveWorkspaceLocale.isPending}
                >
                  {saveWorkspaceLocale.isPending ? localeCopy.saving : localeCopy.save}
                </Button>
              </div>
            </div>

            <div className="space-y-3">
              <div>
                <div className="text-sm font-medium text-foreground">Cobros con IA</div>
                <div className="mt-1 text-xs leading-5 text-muted-foreground">
                  Permite leer mensajes para detectar promesas o pendientes de pago. La detección por facturas vencidas sigue funcionando aunque esto esté apagado.
                </div>
              </div>
              <div className="flex items-center justify-between gap-3 rounded-lg border border-border bg-[hsl(var(--elevated))] px-3 py-3">
                <div className="text-sm text-foreground">{financeOptIn ? "Activo" : "Inactivo"}</div>
                <Switch
                  checked={financeOptIn}
                  onCheckedChange={setFinanceOptIn}
                  aria-label="Permitir lectura de mensajes para cobros"
                />
              </div>
              <div className="flex justify-end">
                <Button
                  size="sm"
                  onClick={() => saveWorkspace.mutate({ ai_message_finance_opt_in: financeOptIn })}
                  disabled={!hasFinanceOptInChanges || saveWorkspace.isPending}
                >
                  {saveWorkspace.isPending ? "Guardando..." : "Guardar cambio"}
                </Button>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="space-y-5">
        <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
          <div>
            <Label className="text-sm font-medium text-foreground">Facturación electrónica CR</Label>
            <p className="mt-1 text-sm text-muted-foreground">
              Configura el emisor, la conexión con Hacienda y la firma del certificado sin salir de esta pantalla.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="border-sky-500/30 bg-sky-500/10 text-sky-300">
              {readyChecklistCount}/{taxChecklist.length} listo
            </Badge>
            <Button size="sm" onClick={saveTaxConfig} disabled={saveWorkspace.isPending}>
              {saveWorkspace.isPending ? "Guardando..." : "Guardar configuración"}
            </Button>
          </div>
        </div>

        <div className="grid gap-6 xl:grid-cols-[320px_minmax(0,1fr)]">
          <aside className="space-y-3 xl:pr-2">
            <div className="rounded-xl border border-sky-500/20 bg-sky-500/10 p-4">
              <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                <BookOpen className="h-4 w-4 text-sky-400" />
                Estado de preparación
              </div>
              <p className="mt-2 text-xs leading-5 text-muted-foreground">
                Completa estos cuatro bloques para dejar listo el workspace de cara a una operación seria con Hacienda.
              </p>
            </div>

            <div className="space-y-2">
              {taxSteps.map((step, index) => (
                <button
                  key={step.key}
                  type="button"
                  onClick={() => setTaxStep(index)}
                  className={`w-full rounded-xl border px-4 py-3 text-left transition-colors ${
                    taxStep === index
                      ? "border-sky-500/40 bg-sky-500/10"
                      : "border-border bg-[hsl(var(--elevated))] hover:bg-[hsl(var(--elevated))]/80"
                  }`}
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <span className={`inline-flex h-7 w-7 items-center justify-center rounded-full border text-xs font-medium ${
                        taxStep === index ? "border-sky-400/40 text-sky-200" : "border-border text-muted-foreground"
                      }`}>
                        {index + 1}
                      </span>
                      <div>
                        <div className="text-sm font-medium text-foreground">{step.title.replace(/^\d+\.\s*/, "")}</div>
                        <div className="text-xs text-muted-foreground">{step.description}</div>
                      </div>
                    </div>
                    {step.ready ? (
                      <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                    ) : (
                      <AlertTriangle className="h-4 w-4 text-amber-400" />
                    )}
                  </div>
                </button>
              ))}
            </div>
          </aside>

          <div className="rounded-xl border border-border bg-[hsl(var(--elevated))] p-5">
            <div className="mb-5 flex items-start justify-between gap-4 border-b border-border pb-4">
              <div>
                <div className="text-base font-semibold text-foreground">{currentTaxStep.title}</div>
                <div className="mt-1 text-sm text-muted-foreground">{currentTaxStep.description}</div>
              </div>
              <Badge variant="outline" className={currentTaxStep.ready ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300" : "border-amber-500/30 bg-amber-500/10 text-amber-300"}>
                {currentTaxStep.ready ? "Listo" : "Pendiente"}
              </Badge>
            </div>

            <div className="min-h-[360px] space-y-4">
            {currentTaxStep.key === "issuer" && (
              <div className="space-y-4">
                <div className="grid gap-3 md:grid-cols-2">
                  <div>
                    <Label>Razón social</Label>
                    <Input value={taxConfig.legal_name} onChange={(e) => setTaxConfig((prev) => ({ ...prev, legal_name: e.target.value }))} className="mt-1 bg-[hsl(var(--elevated))] border-border" />
                    <p className="mt-1 text-[11px] text-muted-foreground">Ejemplo: `Servicios Técnicos del Valle S.A.`</p>
                  </div>
                  <div>
                    <Label>Nombre comercial</Label>
                    <Input value={taxConfig.trade_name} onChange={(e) => setTaxConfig((prev) => ({ ...prev, trade_name: e.target.value }))} className="mt-1 bg-[hsl(var(--elevated))] border-border" />
                    <p className="mt-1 text-[11px] text-muted-foreground">Ejemplo: `STV Soporte`</p>
                  </div>
                </div>
                <div className="grid gap-3 md:grid-cols-3">
                  <div>
                    <Label>Tipo ID</Label>
                    <Input value={taxConfig.identification_type} onChange={(e) => setTaxConfig((prev) => ({ ...prev, identification_type: e.target.value }))} className="mt-1 bg-[hsl(var(--elevated))] border-border" placeholder="02" />
                    <p className="mt-1 text-[11px] text-muted-foreground">Ejemplo: `01` física, `02` jurídica.</p>
                  </div>
                  <div>
                    <Label>Identificación</Label>
                    <Input value={taxConfig.identification_number} onChange={(e) => setTaxConfig((prev) => ({ ...prev, identification_number: e.target.value }))} className="mt-1 bg-[hsl(var(--elevated))] border-border" />
                  </div>
                  <div>
                    <Label>Actividad</Label>
                    <Input value={taxConfig.activity_code} onChange={(e) => setTaxConfig((prev) => ({ ...prev, activity_code: e.target.value }))} className="mt-1 bg-[hsl(var(--elevated))] border-border" />
                  </div>
                </div>
                <div className="grid gap-3 md:grid-cols-2">
                  <div>
                    <Label>Correo tributario</Label>
                    <Input value={taxConfig.tax_email} onChange={(e) => setTaxConfig((prev) => ({ ...prev, tax_email: e.target.value }))} className="mt-1 bg-[hsl(var(--elevated))] border-border" />
                  </div>
                  <div>
                    <Label>Teléfono</Label>
                    <Input value={taxConfig.phone} onChange={(e) => setTaxConfig((prev) => ({ ...prev, phone: e.target.value }))} className="mt-1 bg-[hsl(var(--elevated))] border-border" />
                  </div>
                </div>
              </div>
            )}

            {currentTaxStep.key === "address" && (
              <div className="space-y-4">
                <div className="grid gap-3 md:grid-cols-3">
                  <div>
                    <Label>Provincia</Label>
                    <Input value={taxConfig.province} onChange={(e) => setTaxConfig((prev) => ({ ...prev, province: e.target.value }))} className="mt-1 bg-[hsl(var(--elevated))] border-border" />
                  </div>
                  <div>
                    <Label>Cantón</Label>
                    <Input value={taxConfig.canton} onChange={(e) => setTaxConfig((prev) => ({ ...prev, canton: e.target.value }))} className="mt-1 bg-[hsl(var(--elevated))] border-border" />
                  </div>
                  <div>
                    <Label>Distrito</Label>
                    <Input value={taxConfig.district} onChange={(e) => setTaxConfig((prev) => ({ ...prev, district: e.target.value }))} className="mt-1 bg-[hsl(var(--elevated))] border-border" />
                  </div>
                </div>
                <div>
                  <Label>Dirección exacta</Label>
                  <Input value={taxConfig.address_detail} onChange={(e) => setTaxConfig((prev) => ({ ...prev, address_detail: e.target.value }))} className="mt-1 bg-[hsl(var(--elevated))] border-border" />
                </div>
              </div>
            )}

            {currentTaxStep.key === "hacienda" && (
              <div className="space-y-4">
                <div className="grid gap-3 md:grid-cols-2">
                  <div>
                    <Label>Ambiente Hacienda</Label>
                    <Select value={taxConfig.hacienda_environment} onValueChange={(value) => setTaxConfig((prev) => ({ ...prev, hacienda_environment: value }))}>
                      <SelectTrigger className="mt-1 bg-[hsl(var(--elevated))] border-border"><SelectValue /></SelectTrigger>
                      <SelectContent className="bg-card border-border">
                        <SelectItem value="staging">staging</SelectItem>
                        <SelectItem value="production">production</SelectItem>
                      </SelectContent>
                    </Select>
                    <p className="mt-1 text-[11px] text-muted-foreground">Usa `staging` para pruebas y `production` cuando ya todo esté validado.</p>
                  </div>
                  <div>
                    <Label>Callback URL</Label>
                    <Input value={taxConfig.hacienda_callback_url} onChange={(e) => setTaxConfig((prev) => ({ ...prev, hacienda_callback_url: e.target.value }))} className="mt-1 bg-[hsl(var(--elevated))] border-border" />
                  </div>
                </div>
                <div className="grid gap-3 md:grid-cols-2">
                  <div>
                    <Label>Client ID</Label>
                    <Input value={taxConfig.hacienda_client_id} onChange={(e) => setTaxConfig((prev) => ({ ...prev, hacienda_client_id: e.target.value }))} className="mt-1 bg-[hsl(var(--elevated))] border-border" />
                  </div>
                  <div>
                    <Label>Token URL</Label>
                    <Input value={taxConfig.hacienda_token_url} onChange={(e) => setTaxConfig((prev) => ({ ...prev, hacienda_token_url: e.target.value }))} className="mt-1 bg-[hsl(var(--elevated))] border-border" />
                  </div>
                </div>
                <div className="grid gap-3 md:grid-cols-2">
                  <div>
                    <Label>Usuario Hacienda</Label>
                    <Input value={taxConfig.hacienda_username} onChange={(e) => setTaxConfig((prev) => ({ ...prev, hacienda_username: e.target.value }))} className="mt-1 bg-[hsl(var(--elevated))] border-border" />
                  </div>
                  <div>
                    <Label>Contraseña Hacienda</Label>
                    <SecretInput value={taxConfig.hacienda_password} onChange={(value) => setTaxConfig((prev) => ({ ...prev, hacienda_password: value }))} placeholder="••••••••" />
                  </div>
                </div>
              </div>
            )}

            {currentTaxStep.key === "certificate" && (
              <div className="space-y-4">
                <div className="grid gap-3 md:grid-cols-2">
                  <div>
                    <Label>Ruta certificado</Label>
                    <Input value={taxConfig.hacienda_certificate_path} onChange={(e) => setTaxConfig((prev) => ({ ...prev, hacienda_certificate_path: e.target.value }))} className="mt-1 bg-[hsl(var(--elevated))] border-border" />
                  </div>
                  <div>
                    <Label>PIN certificado</Label>
                    <SecretInput value={taxConfig.hacienda_certificate_pin} onChange={(value) => setTaxConfig((prev) => ({ ...prev, hacienda_certificate_pin: value }))} placeholder="••••" />
                  </div>
                </div>
                <div className="flex items-center justify-between gap-4 rounded-lg border border-border bg-[hsl(var(--elevated))] p-3">
                  <div>
                    <Label className="text-sm font-medium text-foreground">Activar firma</Label>
                    <p className="text-xs text-muted-foreground mt-1">Si está apagado, el backend usa firma placeholder para el flujo técnico.</p>
                  </div>
                  <Switch
                    checked={taxConfig.hacienda_signing_enabled}
                    onCheckedChange={(value) => setTaxConfig((prev) => ({ ...prev, hacienda_signing_enabled: value }))}
                    aria-label="Activar firma Hacienda"
                  />
                </div>
              </div>
            )}
            </div>

            <div className="mt-5 flex items-center justify-between gap-3 border-t border-border pt-4">
              <Button size="sm" onClick={saveTaxConfig} disabled={saveWorkspace.isPending}>
                {saveWorkspace.isPending ? "Guardando..." : "Guardar"}
              </Button>
              <div className="flex items-center gap-3">
                <div className="text-xs text-muted-foreground">
                  Paso {taxStep + 1} de {taxSteps.length}
                </div>
                <div className="flex items-center gap-2">
                  <Button type="button" variant="outline" onClick={() => setTaxStep((prev) => Math.max(prev - 1, 0))} disabled={taxStep === 0}>
                    Anterior
                  </Button>
                  <Button type="button" onClick={() => setTaxStep((prev) => Math.min(prev + 1, taxSteps.length - 1))} disabled={taxStep === taxSteps.length - 1}>
                    Siguiente
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// PLATFORM TAB (platform admins only)
// ═══════════════════════════════════════════════════════════════════════════════

// ═══════════════════════════════════════════════════════════════════════════════
// PLATFORM TAB (platform admins only)
// ═══════════════════════════════════════════════════════════════════════════════

function PlatformTab() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [selectedSlug, setSelectedSlug] = useState<string | null>(null);
  const [assignOpen, setAssignOpen] = useState(false);
  const [assignEmail, setAssignEmail] = useState("");
  const [assignRole, setAssignRole] = useState("AGENT");
  const [searchEmail, setSearchEmail] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [billingPlan, setBillingPlan] = useState("FREE");
  const [billingStatus, setBillingStatus] = useState("MANUAL");
  const [billingProvider, setBillingProvider] = useState("MANUAL");
  const [billingInterval, setBillingInterval] = useState("MONTHLY");
  const [providerCustomerId, setProviderCustomerId] = useState("");
  const [providerSubscriptionId, setProviderSubscriptionId] = useState("");
  const [billingNotes, setBillingNotes] = useState("");
  const [periodStart, setPeriodStart] = useState("");
  const [periodEnd, setPeriodEnd] = useState("");
  const [cancelAtPeriodEnd, setCancelAtPeriodEnd] = useState(false);

  const { data: workspaces, isLoading: wsLoading } = useQuery({
    queryKey: ["/api/platform/workspaces"],
    queryFn: () => api.platformListWorkspaces(),
  });

  const { data: members, isLoading: membersLoading } = useQuery({
    queryKey: ["/api/platform/workspaces", selectedSlug, "members"],
    queryFn: () => api.platformListMembers(selectedSlug!),
    enabled: !!selectedSlug,
  });

  const { data: billingData, isLoading: billingLoading } = useQuery({
    queryKey: ["/api/platform/workspaces", selectedSlug, "billing"],
    queryFn: () => api.platformGetWorkspaceBilling(selectedSlug!),
    enabled: !!selectedSlug,
  });

  const { data: users } = useQuery({
    queryKey: ["/api/platform/users", searchQuery],
    queryFn: () => api.platformSearchUsers(searchQuery || undefined),
    enabled: searchQuery.length >= 2 || searchQuery === "",
  });

  const assign = useMutation({
    mutationFn: () => api.platformAssignMember(selectedSlug!, { email: assignEmail, role: assignRole }),
    onSuccess: () => {
      toast({ title: "Usuario asignado al workspace" });
      qc.invalidateQueries({ queryKey: ["/api/platform/workspaces", selectedSlug, "members"] });
      setAssignOpen(false);
      setAssignEmail("");
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const revoke = useMutation({
    mutationFn: ({ userId }: { userId: string }) => api.platformRemoveMember(selectedSlug!, userId),
    onSuccess: () => {
      toast({ title: "Acceso revocado" });
      qc.invalidateQueries({ queryKey: ["/api/platform/workspaces", selectedSlug, "members"] });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const updateBilling = useMutation({
    mutationFn: () =>
      api.platformUpdateWorkspaceBilling(selectedSlug!, {
        plan: billingPlan,
        status: billingStatus,
        provider: billingProvider,
        billing_interval: billingInterval,
        provider_customer_id: providerCustomerId || undefined,
        provider_subscription_id: providerSubscriptionId || undefined,
        current_period_start: periodStart || undefined,
        current_period_end: periodEnd || undefined,
        cancel_at_period_end: cancelAtPeriodEnd,
        notes: billingNotes || undefined,
      }),
    onSuccess: () => {
      toast({ title: "Billing actualizado" });
      qc.invalidateQueries({ queryKey: ["/api/platform/workspaces"] });
      qc.invalidateQueries({ queryKey: ["/api/platform/workspaces", selectedSlug, "billing"] });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  useEffect(() => {
    const subscription = billingData?.subscription;
    const workspace = billingData?.workspace;

    setBillingPlan(subscription?.plan ?? workspace?.plan ?? "FREE");
    setBillingStatus(subscription?.status ?? "MANUAL");
    setBillingProvider(subscription?.provider ?? "MANUAL");
    setBillingInterval(subscription?.billing_interval ?? "MONTHLY");
    setProviderCustomerId(subscription?.provider_customer_id ?? "");
    setProviderSubscriptionId(subscription?.provider_subscription_id ?? "");
    setBillingNotes(subscription?.notes ?? "");
    setPeriodStart(subscription?.current_period_start ? String(subscription.current_period_start).slice(0, 10) : "");
    setPeriodEnd(subscription?.current_period_end ? String(subscription.current_period_end).slice(0, 10) : "");
    setCancelAtPeriodEnd(subscription?.cancel_at_period_end === true);
  }, [billingData]);

  const wsList = Array.isArray(workspaces) ? workspaces : [];
  const membersList = Array.isArray(members) ? members : [];
  const usersList = Array.isArray(users) ? users : [];
  const billingEvents = Array.isArray(billingData?.events) ? billingData.events : [];

  return (
    <div className="space-y-6">
      {/* Users search */}
      <div>
        <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
          <Search className="h-4 w-4" />Buscar usuarios
        </h3>
        <div className="flex gap-2 mb-3">
          <Input
            placeholder="Buscar por email..."
            value={searchEmail}
            onChange={e => setSearchEmail(e.target.value)}
            className="bg-[hsl(var(--elevated))] border-border"
          />
          <Button size="sm" onClick={() => setSearchQuery(searchEmail)}>Buscar</Button>
        </div>
        {usersList.length > 0 && (
          <div className="space-y-2">
            {usersList.map((u: any) => (
              <div key={u.id} className="p-3 rounded-lg border border-border bg-card flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-medium">{u.name}</p>
                  <p className="text-xs text-muted-foreground">{u.email}</p>
                  {u.is_platform_admin && (
                    <Badge variant="outline" className="text-xs mt-1 text-purple-400 border-purple-500/30">Admin Plataforma</Badge>
                  )}
                </div>
                <div className="flex flex-wrap gap-1">
                  {u.workspace_users?.map((wu: any) => (
                    <Badge key={wu.workspace?.id} variant="outline" className="text-xs text-muted-foreground">
                      {wu.workspace?.name} · {wu.role}
                    </Badge>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

        <div className="h-px bg-border" />

        {/* Workspace member management */}
        <div>
          <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
          <Building2 className="h-4 w-4" />Gestión de accesos por workspace
        </h3>
        <div className="grid grid-cols-2 gap-4">
          {/* Workspace list */}
          <div>
            <p className="text-xs text-muted-foreground mb-2">Seleccionar workspace</p>
            {wsLoading ? (
              <p className="text-sm text-muted-foreground">Cargando...</p>
            ) : (
                <div className="space-y-1 max-h-64 overflow-y-auto">
                  {wsList.map((w: any) => (
                    <button
                      key={w.id}
                      className={`w-full text-left px-3 py-2 rounded text-sm transition-colors ${selectedSlug === w.slug ? "bg-elevated text-white" : "text-muted-foreground hover:text-white hover:bg-white/5"}`}
                      onClick={() => setSelectedSlug(w.slug)}
                    >
                      <span className="font-medium">{w.name}</span>
                      <span className="ml-2 text-xs opacity-60">{w.member_count} miembros</span>
                      <span className="ml-2 text-[10px] rounded border border-blue-500/20 bg-blue-500/10 px-1.5 py-0.5 text-blue-300">
                        {w.plan}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Members of selected workspace */}
            <div>
              {selectedSlug ? (
                <div className="space-y-4">
                  <div className="rounded-xl border border-border bg-[hsl(var(--elevated))] p-4 space-y-4">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-medium text-foreground">Billing y desbloqueo</p>
                        <p className="text-xs text-muted-foreground">
                          Cuando el customer paga, aquí se actualiza la suscripción y el plan efectivo del workspace.
                        </p>
                      </div>
                      <Badge variant="outline" className="border-blue-500/30 bg-blue-500/10 text-blue-300">
                        Plan actual: {billingData?.workspace?.plan ?? "—"}
                      </Badge>
                    </div>

                    {billingLoading ? (
                      <p className="text-sm text-muted-foreground">Cargando billing...</p>
                    ) : (
                      <>
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <Label>Plan efectivo</Label>
                            <Select value={billingPlan} onValueChange={setBillingPlan}>
                              <SelectTrigger className="mt-1 bg-[hsl(var(--elevated))] border-border"><SelectValue /></SelectTrigger>
                              <SelectContent className="bg-card border-border">
                                {["FREE", "STARTER", "GROWTH", "ENTERPRISE"].map((value) => (
                                  <SelectItem key={value} value={value}>{value}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <div>
                            <Label>Estado suscripción</Label>
                            <Select value={billingStatus} onValueChange={setBillingStatus}>
                              <SelectTrigger className="mt-1 bg-[hsl(var(--elevated))] border-border"><SelectValue /></SelectTrigger>
                              <SelectContent className="bg-card border-border">
                                {["TRIALING", "ACTIVE", "PAST_DUE", "UNPAID", "CANCELLED", "EXPIRED", "MANUAL"].map((value) => (
                                  <SelectItem key={value} value={value}>{value}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <Label>Proveedor</Label>
                            <Select value={billingProvider} onValueChange={setBillingProvider}>
                              <SelectTrigger className="mt-1 bg-[hsl(var(--elevated))] border-border"><SelectValue /></SelectTrigger>
                              <SelectContent className="bg-card border-border">
                                {["MANUAL", "STRIPE", "PAYPAL", "BAC", "CUSTOM"].map((value) => (
                                  <SelectItem key={value} value={value}>{value}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <div>
                            <Label>Intervalo</Label>
                            <Select value={billingInterval} onValueChange={setBillingInterval}>
                              <SelectTrigger className="mt-1 bg-[hsl(var(--elevated))] border-border"><SelectValue /></SelectTrigger>
                              <SelectContent className="bg-card border-border">
                                {["MONTHLY", "YEARLY", "ONE_TIME", "CUSTOM"].map((value) => (
                                  <SelectItem key={value} value={value}>{value}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <Label>Provider Customer ID</Label>
                            <Input value={providerCustomerId} onChange={(e) => setProviderCustomerId(e.target.value)} className="mt-1 bg-[hsl(var(--elevated))] border-border" />
                          </div>
                          <div>
                            <Label>Provider Subscription ID</Label>
                            <Input value={providerSubscriptionId} onChange={(e) => setProviderSubscriptionId(e.target.value)} className="mt-1 bg-[hsl(var(--elevated))] border-border" />
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <Label>Periodo inicio</Label>
                            <Input type="date" value={periodStart} onChange={(e) => setPeriodStart(e.target.value)} className="mt-1 bg-[hsl(var(--elevated))] border-border" />
                          </div>
                          <div>
                            <Label>Periodo fin</Label>
                            <Input type="date" value={periodEnd} onChange={(e) => setPeriodEnd(e.target.value)} className="mt-1 bg-[hsl(var(--elevated))] border-border" />
                          </div>
                        </div>

                        <div className="flex items-center justify-between rounded-lg border border-border bg-card px-3 py-2">
                          <div>
                            <p className="text-sm text-foreground">Cancelar al final del periodo</p>
                            <p className="text-xs text-muted-foreground">Útil para bajas programadas sin cortar acceso hoy.</p>
                          </div>
                          <Switch checked={cancelAtPeriodEnd} onCheckedChange={setCancelAtPeriodEnd} />
                        </div>

                        <div>
                          <Label>Notas internas</Label>
                          <Input value={billingNotes} onChange={(e) => setBillingNotes(e.target.value)} className="mt-1 bg-[hsl(var(--elevated))] border-border" placeholder="Ej: pago manual confirmado por transferencia" />
                        </div>

                        <div className="flex items-center justify-between gap-3">
                          <p className="text-xs text-muted-foreground">
                            Guardar aquí sincroniza la suscripción y actualiza el `workspace.plan`, que es lo que desbloquea el producto hoy.
                          </p>
                          <Button size="sm" onClick={() => updateBilling.mutate()} disabled={updateBilling.isPending}>
                            {updateBilling.isPending ? "Guardando..." : "Guardar billing"}
                          </Button>
                        </div>

                        {billingEvents.length > 0 && (
                          <div className="space-y-2">
                            <p className="text-xs text-muted-foreground uppercase tracking-wider">Eventos recientes</p>
                            <div className="space-y-1 max-h-40 overflow-y-auto">
                              {billingEvents.map((event: any) => (
                                <div key={event.id} className="rounded border border-border bg-card px-3 py-2">
                                  <div className="flex items-center justify-between gap-3">
                                    <p className="text-xs font-medium text-foreground">{event.event_type}</p>
                                    <Badge variant="outline" className="text-[10px] border-border text-muted-foreground">
                                      {event.applied_plan ?? "sin plan"}
                                    </Badge>
                                  </div>
                                  <p className="mt-1 text-[11px] text-muted-foreground">
                                    {event.provider} · {event.source} · {event.created_at ? new Date(event.created_at).toLocaleString() : "sin fecha"}
                                  </p>
                                  {event.notes && (
                                    <p className="mt-1 text-[11px] text-muted-foreground">{event.notes}</p>
                                  )}
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </>
                    )}
                  </div>

                  <div className="flex items-center justify-between mb-2">
                    <p className="text-xs text-muted-foreground">{membersList.length} miembro(s)</p>
                    <Dialog open={assignOpen} onOpenChange={setAssignOpen}>
                      <DialogTrigger asChild>
                        <Button size="sm" variant="outline" className="h-7 text-xs">
                          <UserPlus className="h-3 w-3 mr-1" />Asignar usuario
                        </Button>
                    </DialogTrigger>
                    <DialogContent className="bg-card border-border">
                      <DialogHeader><DialogTitle>Asignar usuario al workspace</DialogTitle></DialogHeader>
                      <div className="space-y-3 pt-2">
                        <div>
                          <Label>Email del usuario</Label>
                          <Input
                            value={assignEmail}
                            onChange={e => setAssignEmail(e.target.value)}
                            placeholder="usuario@empresa.com"
                            className="mt-1 bg-[hsl(var(--elevated))] border-border"
                          />
                          <p className="text-xs text-muted-foreground mt-1">El usuario debe estar registrado en la plataforma.</p>
                        </div>
                        <div>
                          <Label>Rol</Label>
                          <Select value={assignRole} onValueChange={setAssignRole}>
                            <SelectTrigger className="mt-1 bg-[hsl(var(--elevated))] border-border"><SelectValue /></SelectTrigger>
                            <SelectContent className="bg-card border-border">
                              {["ADMIN", "AGENT", "VIEWER"].map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}
                            </SelectContent>
                          </Select>
                        </div>
                        <Button
                          onClick={() => assign.mutate()}
                          disabled={!assignEmail || assign.isPending}
                          className="w-full bg-primary hover:bg-primary/90"
                        >
                          {assign.isPending ? "Asignando..." : "Asignar"}
                        </Button>
                      </div>
                    </DialogContent>
                  </Dialog>
                </div>
                {membersLoading ? (
                  <p className="text-sm text-muted-foreground">Cargando...</p>
                ) : (
                  <div className="space-y-1 max-h-64 overflow-y-auto">
                    {membersList.map((m: any) => (
                      <div key={m.id} className="flex items-center justify-between px-2 py-1.5 rounded border border-border bg-card">
                        <div>
                          <p className="text-xs font-medium">{m.user?.name}</p>
                          <p className="text-xs text-muted-foreground">{m.user?.email}</p>
                        </div>
                        <div className="flex items-center gap-1">
                          <Badge variant="outline" className={`text-xs ${ROLE_COLORS[m.role] ?? ""}`}>{m.role}</Badge>
                          {!m.is_owner && (
                            <button
                              className="text-muted-foreground hover:text-destructive ml-1"
                              onClick={() => revoke.mutate({ userId: m.user?.id })}
                              title="Revocar acceso"
                            >
                              <UserMinus className="h-3 w-3" />
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                      {membersList.length === 0 && (
                        <p className="text-xs text-muted-foreground text-center py-4">Sin miembros</p>
                      )}
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground pt-6 text-center">Seleccioná un workspace</p>
              )}
            </div>
          </div>
      </div>
    </div>
  );
}

export default function Settings() {
  const { user } = useAuth();
  const { messages } = useI18n();
  const copy = messages.settings;
  const isPlatformAdmin = user?.is_platform_admin === true;

  return (
    <div className="p-6 space-y-6">
      <ModuleHero module="settings">
        <div className="px-6 py-5 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-gray-900">{copy.pageTitle}</h1>
            <p className="text-sm text-gray-500 mt-0.5">Gestiona tu workspace, equipo e integraciones</p>
          </div>
        </div>
      </ModuleHero>
      <Tabs defaultValue="workspace">
        <TabsList className="bg-card border border-border overflow-x-auto flex-nowrap scrollbar-none">
          <TabsTrigger value="workspace" className="data-[state=active]:bg-elevated">
            <Building2 className="h-4 w-4 mr-2" />{copy.tabs.workspace}
          </TabsTrigger>
          <TabsTrigger value="members" className="data-[state=active]:bg-elevated">
            <Users className="h-4 w-4 mr-2" />{copy.tabs.members}
          </TabsTrigger>
          <TabsTrigger value="channels" className="data-[state=active]:bg-elevated">
            <PlugZap className="h-4 w-4 mr-2" />{copy.tabs.channels}
          </TabsTrigger>
          <TabsTrigger value="departments" className="data-[state=active]:bg-elevated">
            <Layers className="h-4 w-4 mr-2" />{copy.tabs.departments}
          </TabsTrigger>
          <TabsTrigger value="integrations" className="data-[state=active]:bg-elevated">
            <Plug className="h-4 w-4 mr-2" />{copy.tabs.integrations}
          </TabsTrigger>
          <TabsTrigger value="ai" className="data-[state=active]:bg-elevated">
            <BrainCircuit className="h-4 w-4 mr-2" />{copy.tabs.ai}
          </TabsTrigger>
          <TabsTrigger value="billing" className="data-[state=active]:bg-elevated">
            <CreditCard className="h-4 w-4 mr-2" />{copy.tabs.billing}
          </TabsTrigger>
          <TabsTrigger value="routing" className="data-[state=active]:bg-elevated">
            <Shuffle className="h-4 w-4 mr-2" />{copy.tabs.routing}
          </TabsTrigger>
          <TabsTrigger value="apitokens" className="data-[state=active]:bg-elevated">
            <Key className="h-4 w-4 mr-2" />{copy.tabs.apiTokens}
          </TabsTrigger>
          <TabsTrigger value="saml" className="data-[state=active]:bg-elevated">
            <Shield className="h-4 w-4 mr-2" />SAML SSO
          </TabsTrigger>
          {isPlatformAdmin && (
            <TabsTrigger value="platform" className="data-[state=active]:bg-elevated">
              <ShieldCheck className="h-4 w-4 mr-2" />{copy.tabs.platform}
            </TabsTrigger>
          )}
        </TabsList>
        <Card className="mt-4 bg-card border-border">
          <CardContent className="pt-6">
            <TabsContent value="workspace"><WorkspaceTab /></TabsContent>
            <TabsContent value="members"><MembersTab /></TabsContent>
            <TabsContent value="channels"><ChannelsTab /></TabsContent>
            <TabsContent value="departments"><DepartmentsTab /></TabsContent>
            <TabsContent value="integrations"><IntegrationsTab /></TabsContent>
            <TabsContent value="ai"><AiTab /></TabsContent>
            <TabsContent value="billing"><BillingPage /></TabsContent>
            <TabsContent value="routing"><RoutingRulesTab /></TabsContent>
            <TabsContent value="apitokens"><ApiTokensTab /></TabsContent>
            <TabsContent value="saml"><SamlConfig /></TabsContent>
            {isPlatformAdmin && (
              <TabsContent value="platform"><PlatformTab /></TabsContent>
            )}
          </CardContent>
        </Card>
      </Tabs>
    </div>
  );
}
