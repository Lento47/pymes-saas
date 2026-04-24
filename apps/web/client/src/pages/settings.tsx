import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { openExternal } from "@/lib/platform";
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
import {
  Building2, Users, PlugZap, UserPlus, Plus, Plug,
  Mail, MessageCircle, Radio, Eye, EyeOff, ExternalLink,
  PowerOff, Trash2, Layers, UserMinus, ShieldCheck, Search, BrainCircuit, CheckCircle2, AlertTriangle, BookOpen,
} from "lucide-react";

// ─── Paletas ──────────────────────────────────────────────────────────────────

const ROLE_COLORS: Record<string, string> = {
  OWNER: "bg-yellow-500/10 text-yellow-400 border-yellow-500/30",
  ADMIN: "bg-blue-500/10 text-blue-400 border-blue-500/30",
  AGENT: "bg-green-500/10 text-green-400 border-green-500/30",
  VIEWER: "bg-gray-500/10 text-gray-400 border-gray-500/30",
};

const CHANNEL_TYPE_COLORS: Record<string, string> = {
  EMAIL: "bg-blue-500/10 text-blue-400",
  WHATSAPP: "bg-green-500/10 text-green-400",
  FORM: "bg-purple-500/10 text-purple-400",
  API: "bg-orange-500/10 text-orange-400",
  MANUAL: "bg-gray-500/10 text-gray-400",
};

const CHANNEL_ICONS: Record<string, any> = {
  EMAIL: Mail,
  WHATSAPP: MessageCircle,
  FORM: PlugZap,
  API: Plug,
  MANUAL: Radio,
};

// ─── Campo password con toggle ────────────────────────────────────────────────
function SecretInput({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder?: string }) {
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      <Input
        type={show ? "text" : "password"}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        className="bg-[hsl(var(--elevated))] border-border pr-10 font-mono text-xs"
      />
      <button
        type="button"
        onClick={() => setShow(s => !s)}
        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
      >
        {show ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
      </button>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// WORKSPACE TAB
// ═══════════════════════════════════════════════════════════════════════════════

function WorkspaceTab() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["/api/workspaces/current"],
    queryFn: () => api.getWorkspace(),
  });
  const [financeOptIn, setFinanceOptIn] = useState(false);
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

  if (isLoading) return <div className="text-muted-foreground text-sm">Cargando...</div>;
  const ws = workspace;
  const hasFinanceOptInChanges = financeOptIn !== (ws?.ai_message_finance_opt_in === true);
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

          <div className="space-y-3 lg:pl-4 lg:border-l lg:border-border">
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
// MEMBERS TAB
// ═══════════════════════════════════════════════════════════════════════════════

function MembersTab() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("AGENT");

  const { data, isLoading } = useQuery({
    queryKey: ["/api/workspaces/current/members"],
    queryFn: () => api.getMembers(),
  });

  const invite = useMutation({
    mutationFn: () => api.inviteUser({ email, role }),
    onSuccess: () => {
      toast({ title: "Invitación enviada" });
      qc.invalidateQueries({ queryKey: ["/api/workspaces/current/members"] });
      setOpen(false);
      setEmail("");
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const members = Array.isArray(data) ? data : [];

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <p className="text-sm text-muted-foreground">{members.length} miembro(s)</p>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm" className="bg-primary hover:bg-primary/90">
              <UserPlus className="h-4 w-4 mr-2" />Invitar
            </Button>
          </DialogTrigger>
          <DialogContent className="bg-card border-border">
            <DialogHeader><DialogTitle>Invitar usuario</DialogTitle></DialogHeader>
            <div className="space-y-3 pt-2">
              <div>
                <Label>Email</Label>
                <Input value={email} onChange={e => setEmail(e.target.value)} placeholder="usuario@empresa.com" className="mt-1 bg-[hsl(var(--elevated))] border-border" />
              </div>
              <div>
                <Label>Rol</Label>
                <Select value={role} onValueChange={setRole}>
                  <SelectTrigger className="mt-1 bg-[hsl(var(--elevated))] border-border"><SelectValue /></SelectTrigger>
                  <SelectContent className="bg-card border-border">
                    {["ADMIN", "AGENT", "VIEWER"].map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <Button onClick={() => invite.mutate()} disabled={!email || invite.isPending} className="w-full bg-primary hover:bg-primary/90">
                {invite.isPending ? "Enviando..." : "Enviar invitación"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? <div className="text-muted-foreground text-sm">Cargando...</div> : (
        <div className="space-y-2">
          {members.map((m: any) => (
            <div key={m.id} className="flex items-center justify-between p-3 rounded-lg bg-card border border-border">
              <div className="flex items-center gap-3">
                <Avatar className="h-8 w-8">
                  <AvatarFallback className="bg-elevated text-xs">{m.name?.[0]?.toUpperCase()}</AvatarFallback>
                </Avatar>
                <div>
                  <p className="text-sm font-medium">{m.name}</p>
                  <p className="text-xs text-muted-foreground">{m.email}</p>
                </div>
              </div>
              <Badge variant="outline" className={ROLE_COLORS[m.role] ?? ""}>{m.role}</Badge>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// CHANNELS TAB
// ═══════════════════════════════════════════════════════════════════════════════

// channel.config viene del backend (sanitised — sin keys encrypted)
function EmailConfigModal({ channel, onClose }: { channel: any; onClose: () => void }) {
  const { toast } = useToast();
  const qc = useQueryClient();
  // Pre-populate with existing values; api_key is secret so can't be pre-filled
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
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const isEdit = channel?.status === "ACTIVE";

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
                        Si lo dejás vacío, PymesHub enruta por <span className="font-mono">{fromEmail || "from_email"}</span>. Si usás un buzón distinto para recibir, ponelo aquí.
        </p>
      </div>

      <div>
        <Label>Nombre remitente</Label>
        <Input value={fromName} onChange={e => setFromName(e.target.value)}
          placeholder="PYMES CRM" className="mt-1 bg-[hsl(var(--elevated))] border-border" />
      </div>

      <div className="space-y-3 rounded-lg border border-border bg-[hsl(var(--elevated))] p-3 text-xs">
        <div>
                      <p className="font-medium text-foreground">Recepción de correos en PymesHub</p>
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
        // On edit, api_key can be blank (keep existing) — only require it on first setup
        disabled={(!isEdit && !apiKey) || !fromEmail || !fromName || save.isPending}
        className="w-full bg-primary hover:bg-primary/90"
      >
        {save.isPending ? "Guardando..." : isEdit ? "Guardar cambios" : "Guardar y activar canal"}
      </Button>
    </div>
  );
}

function WhatsAppConfigModal({ channel, onClose }: { channel: any; onClose: () => void }) {
  const { toast } = useToast();
  const qc = useQueryClient();
  // Pre-populate non-secret fields
  const [accessToken, setAccessToken] = useState("");
  const [phoneNumberId, setPhoneNumberId] = useState(channel?.config?.phone_number_id ?? "");
  const [wabaId, setWabaId] = useState(channel?.config?.waba_id ?? "");

  const save = useMutation({
    mutationFn: () => api.configureWhatsApp(channel.id, {
      access_token: accessToken, phone_number_id: phoneNumberId, waba_id: wabaId,
    }),
    onSuccess: () => {
      toast({ title: "Canal WhatsApp guardado y activado" });
      qc.invalidateQueries({ queryKey: ["/api/channels"] });
      onClose();
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const isEdit = channel?.status === "ACTIVE";

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

// ─── Confirm delete ───────────────────────────────────────────────────────────
function DeleteChannelDialog({ channel, onClose }: { channel: any; onClose: () => void }) {
  const { toast } = useToast();
  const qc = useQueryClient();

  const del = useMutation({
    mutationFn: () => api.deleteChannel(channel.id),
    onSuccess: () => {
      toast({ title: "Canal eliminado" });
      qc.invalidateQueries({ queryKey: ["/api/channels"] });
      onClose();
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
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

function ChannelsTab() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);
  const [configChannel, setConfigChannel] = useState<any>(null);
  const [deleteChannel, setDeleteChannel] = useState<any>(null);
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
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const disconnect = useMutation({
    mutationFn: (id: string) => api.disconnectChannel(id),
    onSuccess: () => {
      toast({ title: "Canal desactivado" });
      qc.invalidateQueries({ queryKey: ["/api/channels"] });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const channels = Array.isArray(data) ? data : [];
  const isEmail = configChannel?.type === "EMAIL";
  const isWA = configChannel?.type === "WHATSAPP";

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <p className="text-sm text-muted-foreground">{channels.length} canal(es)</p>

        {/* Modal crear canal */}
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
                <Input value={name} onChange={e => setName(e.target.value)} placeholder="ej. Correo Principal" className="mt-1 bg-[hsl(var(--elevated))] border-border" />
              </div>
              <div>
                <Label>Tipo</Label>
                <Select value={type} onValueChange={setType}>
                  <SelectTrigger className="mt-1 bg-[hsl(var(--elevated))] border-border"><SelectValue /></SelectTrigger>
                  <SelectContent className="bg-card border-border">
                    {["EMAIL", "WHATSAPP", "FORM", "API", "MANUAL"].map(t => (
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

      {/* Modal configuración EMAIL / WhatsApp */}
      <Dialog open={!!configChannel} onOpenChange={open => { if (!open) setConfigChannel(null); }}>
        <DialogContent className="bg-card border-border max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {isEmail ? <Mail className="h-4 w-4 text-blue-400" /> : <MessageCircle className="h-4 w-4 text-green-400" />}
              {configChannel?.status === "ACTIVE" ? "Editar" : "Configurar"} {configChannel?.type}
              <span className="text-muted-foreground font-normal text-sm ml-1">— {configChannel?.name}</span>
            </DialogTitle>
          </DialogHeader>
          {isEmail && <EmailConfigModal channel={configChannel} onClose={() => setConfigChannel(null)} />}
          {isWA && <WhatsAppConfigModal channel={configChannel} onClose={() => setConfigChannel(null)} />}
        </DialogContent>
      </Dialog>

      {/* Confirm delete */}
      {deleteChannel && (
        <DeleteChannelDialog channel={deleteChannel} onClose={() => setDeleteChannel(null)} />
      )}

      {/* Lista */}
      {isLoading ? (
        <div className="text-muted-foreground text-sm">Cargando...</div>
      ) : (
        <div className="space-y-2">
          {channels.map((ch: any) => {
            const Icon = CHANNEL_ICONS[ch.type] ?? Radio;
            const needsConfig = ch.status !== "ACTIVE" && (ch.type === "EMAIL" || ch.type === "WHATSAPP");
            const canConnect = ch.status !== "ACTIVE" && !needsConfig;
            const isActive = ch.status === "ACTIVE";
            const canEdit = isActive && (ch.type === "EMAIL" || ch.type === "WHATSAPP");

            return (
              <div key={ch.id} className="flex items-center justify-between p-3 rounded-lg bg-card border border-border">
                <div className="flex items-center gap-3">
                  <Icon className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-sm font-medium">{ch.name}</p>
                    <Badge variant="outline" className={`text-xs mt-0.5 ${CHANNEL_TYPE_COLORS[ch.type] ?? ""}`}>
                      {ch.type}
                    </Badge>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className={
                    isActive
                      ? "text-green-400 border-green-500/30"
                      : ch.status === "INACTIVE"
                        ? "text-red-400 border-red-500/30"
                        : "text-gray-400 border-gray-500/30"
                  }>
                    {isActive ? "Activo" : ch.status === "INACTIVE" ? "Inactivo" : ch.status}
                  </Badge>

                  {/* Configurar (first time) */}
                  {needsConfig && (
                    <Button size="sm" variant="outline"
                      className={`h-7 text-xs ${ch.type === "EMAIL" ? "border-blue-500/30 text-blue-400" : "border-green-500/30 text-green-400"}`}
                      onClick={() => setConfigChannel(ch)}
                    >
                      <PlugZap className="h-3 w-3 mr-1" />Configurar
                    </Button>
                  )}

                  {/* Editar configuración */}
                  {canEdit && (
                    <Button size="sm" variant="outline"
                      className="h-7 text-xs border-border text-muted-foreground hover:text-foreground"
                      onClick={() => setConfigChannel(ch)}
                    >
                      Editar
                    </Button>
                  )}

                  {/* Conectar (FORM, API, MANUAL) */}
                  {canConnect && (
                    <Button size="sm" variant="outline" className="h-7 text-xs border-border"
                      onClick={() => api.connectChannel(ch.id).then(() => qc.invalidateQueries({ queryKey: ["/api/channels"] }))}
                    >
                      <Plug className="h-3 w-3 mr-1" />Conectar
                    </Button>
                  )}

                  {/* Desactivar */}
                  {isActive && (
                    <Button
                      size="sm" variant="outline"
                      className="h-7 text-xs border-orange-500/30 text-orange-400 hover:bg-orange-500/10"
                      disabled={disconnect.isPending}
                      onClick={() => disconnect.mutate(ch.id)}
                      title="Desactivar canal"
                    >
                      <PowerOff className="h-3 w-3" />
                    </Button>
                  )}

                  {/* Eliminar */}
                  <Button
                    size="sm" variant="outline"
                    className="h-7 text-xs border-red-500/30 text-red-400 hover:bg-red-500/10"
                    onClick={() => setDeleteChannel(ch)}
                    title="Eliminar canal"
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
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

// ═══════════════════════════════════════════════════════════════════════════════
// DEPARTMENTS TAB
// ═══════════════════════════════════════════════════════════════════════════════

function DepartmentsTab() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);
  const [editDept, setEditDept] = useState<any>(null);
  const [deleteDept, setDeleteDept] = useState<any>(null);
  const [addMemberDept, setAddMemberDept] = useState<any>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [color, setColor] = useState("#4f8ef7");
  const [memberUserId, setMemberUserId] = useState("");

  const { data: depts, isLoading } = useQuery({
    queryKey: ["departments"],
    queryFn: () => api.getDepartments(),
  });

  const { data: membersData } = useQuery({
    queryKey: ["workspace-members"],
    queryFn: () => api.getMembers(),
  });

  const departments: any[] = Array.isArray(depts) ? depts : [];
  const allMembers: any[] = Array.isArray(membersData) ? membersData : [];

  const createMut = useMutation({
    mutationFn: (d: any) => api.createDepartment(d),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["departments"] });
      setCreateOpen(false);
      setName(""); setDescription(""); setColor("#4f8ef7");
      toast({ title: "Departamento creado" });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const updateMut = useMutation({
    mutationFn: ({ id, ...d }: any) => api.updateDepartment(id, d),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["departments"] });
      setEditDept(null);
      toast({ title: "Departamento actualizado" });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => api.deleteDepartment(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["departments"] });
      setDeleteDept(null);
      toast({ title: "Departamento eliminado" });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const addMemberMut = useMutation({
    mutationFn: ({ deptId, userId }: any) => api.addDepartmentMember(deptId, { user_id: userId }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["departments"] });
      setAddMemberDept(null);
      setMemberUserId("");
      toast({ title: "Miembro agregado" });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const removeMemberMut = useMutation({
    mutationFn: ({ deptId, userId }: any) => api.removeDepartmentMember(deptId, userId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["departments"] }),
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const openEdit = (dept: any) => {
    setEditDept(dept);
    setName(dept.name);
    setDescription(dept.description ?? "");
    setColor(dept.color ?? "#4f8ef7");
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">Organiza usuarios y conversaciones por departamento.</p>
        <Button size="sm" onClick={() => setCreateOpen(true)}>
          <Plus className="h-4 w-4 mr-1" />Nuevo departamento
        </Button>
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Cargando...</p>
      ) : departments.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-8">No hay departamentos aún.</p>
      ) : (
        <div className="space-y-3">
          {departments.map((dept: any) => (
            <div key={dept.id} className="border border-border rounded-lg p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span
                    className="w-3 h-3 rounded-full"
                    style={{ backgroundColor: dept.color ?? "#4f8ef7" }}
                  />
                  <span className="font-medium text-sm">{dept.name}</span>
                  {!dept.is_active && (
                    <Badge variant="outline" className="text-xs text-muted-foreground">Inactivo</Badge>
                  )}
                  <Badge variant="outline" className="text-xs">
                    {dept._count?.conversations ?? 0} convs
                  </Badge>
                </div>
                <div className="flex gap-1">
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(dept)}>
                    <Eye className="h-3.5 w-3.5" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setAddMemberDept(dept)}>
                    <UserPlus className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    variant="ghost" size="icon"
                    className="h-7 w-7 text-destructive hover:text-destructive"
                    onClick={() => setDeleteDept(dept)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
              {dept.description && (
                <p className="text-xs text-muted-foreground">{dept.description}</p>
              )}
              {dept.members?.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {dept.members.map((m: any) => (
                    <div key={m.id} className="flex items-center gap-1 bg-elevated rounded px-2 py-0.5 text-xs">
                      <span>{m.user?.name ?? m.user?.email}</span>
                      {m.is_lead && <Badge variant="outline" className="text-xs h-4 px-1">Lead</Badge>}
                      <button
                        className="ml-1 text-muted-foreground hover:text-destructive"
                        onClick={() => removeMemberMut.mutate({ deptId: dept.id, userId: m.user_id })}
                      >
                        <UserMinus className="h-3 w-3" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Create dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Nuevo departamento</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label className="text-xs">Nombre</Label>
              <Input value={name} onChange={e => setName(e.target.value)} placeholder="Soporte, Ventas..." />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Descripción (opcional)</Label>
              <Input value={description} onChange={e => setDescription(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Color</Label>
              <div className="flex items-center gap-2">
                <input type="color" value={color} onChange={e => setColor(e.target.value)} className="h-8 w-8 rounded cursor-pointer" />
                <span className="text-xs text-muted-foreground">{color}</span>
              </div>
            </div>
            <Button
              className="w-full"
              disabled={!name.trim() || createMut.isPending}
              onClick={() => createMut.mutate({ name, description: description || undefined, color })}
            >
              Crear
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit dialog */}
      <Dialog open={!!editDept} onOpenChange={v => { if (!v) setEditDept(null); }}>
        <DialogContent>
          <DialogHeader><DialogTitle>Editar departamento</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label className="text-xs">Nombre</Label>
              <Input value={name} onChange={e => setName(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Descripción</Label>
              <Input value={description} onChange={e => setDescription(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Color</Label>
              <div className="flex items-center gap-2">
                <input type="color" value={color} onChange={e => setColor(e.target.value)} className="h-8 w-8 rounded cursor-pointer" />
                <span className="text-xs text-muted-foreground">{color}</span>
              </div>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => updateMut.mutate({ id: editDept?.id, is_active: !editDept?.is_active })}
              >
                {editDept?.is_active ? <PowerOff className="h-4 w-4 mr-1" /> : <Plug className="h-4 w-4 mr-1" />}
                {editDept?.is_active ? "Desactivar" : "Activar"}
              </Button>
              <Button
                className="flex-1"
                disabled={!name.trim() || updateMut.isPending}
                onClick={() => updateMut.mutate({ id: editDept?.id, name, description: description || undefined, color })}
              >
                Guardar
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Add member dialog */}
      <Dialog open={!!addMemberDept} onOpenChange={v => { if (!v) { setAddMemberDept(null); setMemberUserId(""); } }}>
        <DialogContent>
          <DialogHeader><DialogTitle>Agregar miembro — {addMemberDept?.name}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label className="text-xs">Usuario</Label>
              <Select value={memberUserId} onValueChange={setMemberUserId}>
                <SelectTrigger><SelectValue placeholder="Seleccionar usuario" /></SelectTrigger>
                <SelectContent>
                  {allMembers.map((m: any) => (
                    <SelectItem key={m.user?.id ?? m.id} value={m.user?.id ?? m.id}>
                      {m.user?.name ?? m.name} ({m.user?.email ?? m.email})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button
              className="w-full"
              disabled={!memberUserId || addMemberMut.isPending}
              onClick={() => addMemberMut.mutate({ deptId: addMemberDept?.id, userId: memberUserId })}
            >
              Agregar
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete confirm */}
      <AlertDialog open={!!deleteDept} onOpenChange={v => { if (!v) setDeleteDept(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar departamento?</AlertDialogTitle>
            <AlertDialogDescription>
              Se eliminará <strong>{deleteDept?.name}</strong>. Las conversaciones y canales asociados perderán su departamento.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => deleteMut.mutate(deleteDept?.id)}
            >
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

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

// ═══════════════════════════════════════════════════════════════════════════════
// INTEGRATIONS TAB
// ═══════════════════════════════════════════════════════════════════════════════

function ApiKeyCard({
  label, description, icon, iconBg, iconColor,
  isSet, keyValue, onKeyChange, placeholder,
  onSave, onClear, isPending,
}: {
  label: string; description: string;
  icon: React.ReactNode; iconBg: string; iconColor: string;
  isSet: boolean; keyValue: string; onKeyChange: (v: string) => void; placeholder: string;
  onSave: () => void; onClear: () => void; isPending: boolean;
}) {
  return (
    <div className="rounded-xl border border-border bg-[hsl(var(--elevated))] p-4 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className={`flex items-center justify-center w-8 h-8 rounded-lg ${iconBg}`}>
            {icon}
          </div>
          <div>
            <p className="text-sm font-medium">{label}</p>
            <p className="text-xs text-muted-foreground">{description}</p>
          </div>
        </div>
        <Badge variant="outline" className={isSet ? "text-green-400 border-green-500/30 bg-green-500/10" : "text-gray-400 border-gray-500/30 bg-gray-500/10"}>
          {isSet ? "Configurado" : "Sin configurar"}
        </Badge>
      </div>
      <div className="space-y-1.5">
        <Label className="text-xs text-muted-foreground uppercase tracking-wider">API Key</Label>
        <SecretInput value={keyValue} onChange={onKeyChange} placeholder={isSet ? "••••••••••••••••" : placeholder} />
      </div>
      <div className="flex items-center gap-2 justify-end">
        {isSet && (
          <Button size="sm" variant="outline" className="border-red-500/30 text-red-400 hover:bg-red-500/10" onClick={onClear} disabled={isPending}>
            {isPending ? "Eliminando..." : "Eliminar key"}
          </Button>
        )}
        <Button size="sm" onClick={onSave} disabled={!keyValue.trim() || isPending}>
          {isPending ? "Guardando..." : "Guardar"}
        </Button>
      </div>
    </div>
  );
}

function IntegrationsTab() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [resendKey, setResendKey] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["/api/workspaces/current/api-keys"],
    queryFn: () => api.getApiKeys(),
  });

  const resendSet = data?.resend_api_key_set === true;

  const saveKey = useMutation({
    mutationFn: (payload: Record<string, string>) => api.updateApiKeys(payload),
    onSuccess: (_data, payload) => {
      qc.invalidateQueries({ queryKey: ["/api/workspaces/current/api-keys"] });
      const isDelete = Object.values(payload)[0] === "";
      toast({ title: isDelete ? "API key eliminada" : "API key guardada" });
      if (payload.resend_api_key !== undefined) setResendKey("");
    },
    onError: (e: any) =>
      toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  if (isLoading) return <div className="text-muted-foreground text-sm">Cargando...</div>;

  return (
    <div className="space-y-4 max-w-lg">
      <p className="text-sm text-muted-foreground">
        Configurá aquí las integraciones operativas del workspace. La configuración de modelos y proveedores de IA se administra únicamente desde la pestaña de Inteligencia Artificial.
      </p>

      <ApiKeyCard
        label="Resend"
        description="Emails transaccionales del sistema (invitaciones, notificaciones)"
        icon={<Mail className="h-4 w-4 text-blue-400" />}
        iconBg="bg-blue-500/10 border border-blue-500/20"
        iconColor="text-blue-400"
        isSet={resendSet}
        keyValue={resendKey}
        onKeyChange={setResendKey}
        placeholder="re_..."
        onSave={() => saveKey.mutate({ resend_api_key: resendKey })}
        onClear={() => saveKey.mutate({ resend_api_key: "" })}
        isPending={saveKey.isPending}
      />
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN
// ═══════════════════════════════════════════════════════════════════════════════

// ─── AI Tab ───────────────────────────────────────────────────────────────────

const AI_PROVIDERS = [
  { id: "openai",    label: "OpenAI",          models: ["gpt-4o-mini", "gpt-4o", "gpt-4-turbo"] },
  { id: "anthropic", label: "Anthropic (Claude)", models: ["claude-haiku-4-5-20251001", "claude-sonnet-4-6", "claude-opus-4-7"] },
  { id: "gemini",    label: "Google Gemini",   models: ["gemini-2.0-flash", "gemini-1.5-pro"] },
  { id: "moonshot",  label: "Moonshot (Kimi)",  models: ["moonshot-v1-8k", "moonshot-v1-32k"] },
];

function AiTab() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const { data: workspace } = useQuery({ queryKey: ["/api/workspaces/current"], queryFn: api.getWorkspace });

  const [provider, setProvider] = useState("");
  const [model, setModel]       = useState("");
  const [apiKey, setApiKey]     = useState("");
  const [showKey, setShowKey]   = useState(false);
  const [testResult, setTestResult] = useState<any>(null);

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
      setTestResult({
        ok: false,
        message: e.message,
      });
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
                          PymesHub usa tu propia API key — tú controlas el costo. La clave se guarda encriptada y nunca se expone.
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

export default function Settings() {
  const { user } = useAuth();
  const isPlatformAdmin = user?.is_platform_admin === true;

  return (
    <div className="p-6 space-y-6">
      <PageHeader title="Configuración" />
      <Tabs defaultValue="workspace">
        <TabsList className="bg-card border border-border">
          <TabsTrigger value="workspace" className="data-[state=active]:bg-elevated">
            <Building2 className="h-4 w-4 mr-2" />Workspace
          </TabsTrigger>
          <TabsTrigger value="members" className="data-[state=active]:bg-elevated">
            <Users className="h-4 w-4 mr-2" />Miembros
          </TabsTrigger>
          <TabsTrigger value="channels" className="data-[state=active]:bg-elevated">
            <PlugZap className="h-4 w-4 mr-2" />Canales
          </TabsTrigger>
          <TabsTrigger value="departments" className="data-[state=active]:bg-elevated">
            <Layers className="h-4 w-4 mr-2" />Departamentos
          </TabsTrigger>
          <TabsTrigger value="integrations" className="data-[state=active]:bg-elevated">
            <Plug className="h-4 w-4 mr-2" />Integraciones
          </TabsTrigger>
          <TabsTrigger value="ai" className="data-[state=active]:bg-elevated">
            <BrainCircuit className="h-4 w-4 mr-2" />Inteligencia Artificial
          </TabsTrigger>
          {isPlatformAdmin && (
            <TabsTrigger value="platform" className="data-[state=active]:bg-elevated">
              <ShieldCheck className="h-4 w-4 mr-2" />Plataforma
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
            {isPlatformAdmin && (
              <TabsContent value="platform"><PlatformTab /></TabsContent>
            )}
          </CardContent>
        </Card>
      </Tabs>
    </div>
  );
}
