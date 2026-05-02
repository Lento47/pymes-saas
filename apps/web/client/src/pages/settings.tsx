import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { openExternal } from "@/lib/platform";
import { useI18n } from "@/components/providers/i18n-provider";
import { useAuth } from "@/hooks/use-auth";
import { PageHeader } from "@/components/shared/page-header";
import { DiagnosticButton } from "@/components/shared/diagnostic-button";
import { HelpButton } from "@/components/shared/help-button";
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
  PowerOff, Trash2, Layers, UserMinus, ShieldCheck, Search, BrainCircuit, CheckCircle2, AlertTriangle, BookOpen, CreditCard, Shuffle, Loader2, Key, Copy, Shield, Send, Crown, UserCircle, Pencil,
} from "lucide-react";
import BillingPage from "@/pages/billing";
import { SamlConfig } from "@/components/settings/saml-config";
import EnterpriseSettingsTab from "@/components/settings/enterprise-settings";
import { ProfileTab } from "@/components/settings/profile-tab";
import { ModuleHero } from "@/components/shared/module-hero";

function RoutingRulesTab() {
  const { toast } = useToast();
  const { data: rules = [], isLoading, refetch } = useQuery({
    queryKey: ['routing-rules'],
    queryFn: api.getRoutingRules,
  });

  const createRule = useMutation({
    mutationFn: api.createRoutingRule,
    onSuccess: () => { refetch(); toast({ title: 'Regla creada' }); },
    onError: (err: any) => toast({ title: 'Error', description: err?.message, variant: 'destructive' }),
  });

  const deleteRule = useMutation({
    mutationFn: (id: string) => api.deleteRoutingRule(id),
    onSuccess: () => { refetch(); toast({ title: 'Regla eliminada' }); },
    onError: (err: any) => toast({ title: 'Error', description: err?.message, variant: 'destructive' }),
  });

  const toggleRule = useMutation({
    mutationFn: ({ id, active }: { id: string; active: boolean }) =>
      api.updateRoutingRule(id, { is_active: active }),
    onSuccess: () => refetch(),
  });

  const updateRule = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) =>
      api.updateRoutingRule(id, data),
    onSuccess: () => { refetch(); toast({ title: 'Regla actualizada' }); },
    onError: (err: any) => toast({ title: 'Error', description: err?.message, variant: 'destructive' }),
  });

  const [newRule, setNewRule] = useState({ name: '', pattern: '', match_type: 'KEYWORD', department_id: '', channel_id: '', priority: 0, is_active: true });
  const [editingRule, setEditingRule] = useState<any>(null);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-foreground">Reglas de Enrutamiento</h2>
        <Dialog>
          <DialogTrigger asChild>
            <Button size="sm"><Plus className="h-4 w-4 mr-1" />Nueva Regla</Button>
          </DialogTrigger>
          <DialogContent className="bg-card border-border max-w-md">
            <DialogHeader>
              <DialogTitle className="text-foreground">Nueva Regla de Enrutamiento</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <div>
                <Label className="text-foreground">Nombre</Label>
                <Input value={newRule.name} onChange={e => setNewRule({ ...newRule, name: e.target.value })} placeholder="Ej: Ventas" className="bg-[hsl(var(--elevated))] border-border" />
              </div>
              <div>
                <Label className="text-foreground">Tipo de coincidencia</Label>
                <Select value={newRule.match_type} onValueChange={v => setNewRule({ ...newRule, match_type: v })}>
                  <SelectTrigger className="bg-[hsl(var(--elevated))] border-border"><SelectValue /></SelectTrigger>
                  <SelectContent className="bg-card border-border">
                    <SelectItem value="KEYWORD">Palabra clave</SelectItem>
                    <SelectItem value="MENU_REPLY">Menú (texto exacto)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-foreground">Patrón / Palabra clave</Label>
                <Input value={newRule.pattern} onChange={e => setNewRule({ ...newRule, pattern: e.target.value })} placeholder="Ej: factura, precio, ayuda, 1, 2..." className="bg-[hsl(var(--elevated))] border-border" />
              </div>
              <div>
                <Label className="text-foreground">ID del Depto</Label>
                <Input value={newRule.department_id} onChange={e => setNewRule({ ...newRule, department_id: e.target.value })} placeholder="ID del departamento destino" className="bg-[hsl(var(--elevated))] border-border" />
              </div>
              <div>
                <Label className="text-foreground">ID del Canal (opcional)</Label>
                <Input value={newRule.channel_id} onChange={e => setNewRule({ ...newRule, channel_id: e.target.value })} placeholder="Dejar vacío para todos" className="bg-[hsl(var(--elevated))] border-border" />
              </div>
              <Button
                className="w-full"
                disabled={createRule.isPending || !newRule.name || !newRule.pattern || !newRule.department_id}
                onClick={() => {
                  createRule.mutate({
                    name: newRule.name,
                    pattern: newRule.pattern,
                    match_type: newRule.match_type,
                    department_id: newRule.department_id,
                    channel_id: newRule.channel_id || undefined,
                    priority: newRule.priority,
                    is_active: newRule.is_active,
                  });
                  setNewRule({ name: '', pattern: '', match_type: 'KEYWORD', department_id: '', channel_id: '', priority: 0, is_active: true });
                }}
              >
                {createRule.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
                Crear
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? (
        <div className="flex items-center gap-2 text-muted-foreground py-4">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span className="text-sm">Cargando...</span>
        </div>
      ) : rules.length === 0 ? (
        <p className="text-sm text-muted-foreground">Sin reglas de enrutamiento. Creá la primera regla para distribuir mensajes automáticamente.</p>
      ) : (
        <div className="rounded-lg border border-border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-[hsl(var(--elevated))]">
              <tr>
                <th className="text-left px-4 py-2 text-muted-foreground font-medium">Nombre</th>
                <th className="text-left px-4 py-2 text-muted-foreground font-medium">Patrón</th>
                <th className="text-left px-4 py-2 text-muted-foreground font-medium">Tipo</th>
                <th className="text-left px-4 py-2 text-muted-foreground font-medium">Depto</th>
                <th className="text-left px-4 py-2 text-muted-foreground font-medium">Activo</th>
                <th className="text-right px-4 py-2 text-muted-foreground font-medium"></th>
              </tr>
            </thead>
            <tbody>
              {rules.map((r: any) => (
                <tr key={r.id} className="border-t border-border hover:bg-[hsl(var(--elevated))] transition-colors">
                  <td className="px-4 py-2.5 text-foreground">{r.name}</td>
                  <td className="px-4 py-2.5 text-foreground font-mono text-xs">{r.pattern}</td>
                  <td className="px-4 py-2.5">
                    <Badge variant={r.match_type === 'MENU_REPLY' ? 'secondary' : 'default'}>
                      {r.match_type === 'MENU_REPLY' ? 'Menú' : 'Keyword'}
                    </Badge>
                  </td>
                  <td className="px-4 py-2.5 text-muted-foreground text-xs">{r.department?.name || r.department_id}</td>
                  <td className="px-4 py-2.5">
                    <Switch
                      checked={r.is_active}
                      onCheckedChange={(checked) => toggleRule.mutate({ id: r.id, active: checked })}
                    />
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setEditingRule({ ...r, department_id: r.department?.name || r.department_id })}
                    >
                      <Pencil className="h-4 w-4 text-muted-foreground hover:text-foreground" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => { if (confirm('Eliminar regla?')) deleteRule.mutate(r.id); }}
                    >
                      <Trash2 className="h-4 w-4 text-red-400" />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Edit Dialog */}
      <Dialog open={!!editingRule} onOpenChange={(open) => { if (!open) setEditingRule(null); }}>
        <DialogContent className="bg-card border-border max-w-md">
          <DialogHeader>
            <DialogTitle className="text-foreground">Editar Regla</DialogTitle>
          </DialogHeader>
          {editingRule && (
            <div className="space-y-3">
              <div>
                <Label className="text-foreground">Nombre</Label>
                <Input value={editingRule.name} onChange={e => setEditingRule({ ...editingRule, name: e.target.value })} className="bg-[hsl(var(--elevated))] border-border" />
              </div>
              <div>
                <Label className="text-foreground">Tipo de coincidencia</Label>
                <Select value={editingRule.match_type} onValueChange={v => setEditingRule({ ...editingRule, match_type: v })}>
                  <SelectTrigger className="bg-[hsl(var(--elevated))] border-border"><SelectValue /></SelectTrigger>
                  <SelectContent className="bg-card border-border">
                    <SelectItem value="KEYWORD">Palabra clave</SelectItem>
                    <SelectItem value="MENU_REPLY">Menú (texto exacto)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-foreground">Patrón / Palabra clave</Label>
                <Input value={editingRule.pattern} onChange={e => setEditingRule({ ...editingRule, pattern: e.target.value })} className="bg-[hsl(var(--elevated))] border-border" />
              </div>
              <div>
                <Label className="text-foreground">Departamento</Label>
                <Input value={editingRule.department_id} onChange={e => setEditingRule({ ...editingRule, department_id: e.target.value })} placeholder="Nombre o ID del departamento" className="bg-[hsl(var(--elevated))] border-border" />
              </div>
              <div>
                <Label className="text-foreground">ID del Canal (opcional)</Label>
                <Input value={editingRule.channel_id || ''} onChange={e => setEditingRule({ ...editingRule, channel_id: e.target.value })} placeholder="Dejar vacío para todos" className="bg-[hsl(var(--elevated))] border-border" />
              </div>
              <div className="flex items-center gap-2">
                <Label className="text-foreground">Prioridad</Label>
                <Input type="number" min={0} value={editingRule.priority ?? 0} onChange={e => setEditingRule({ ...editingRule, priority: parseInt(e.target.value) || 0 })} className="bg-[hsl(var(--elevated))] border-border w-20" />
              </div>
              <div className="flex gap-2 pt-2">
                <Button
                  className="flex-1"
                  disabled={updateRule.isPending}
                  onClick={() => {
                    updateRule.mutate({
                      id: editingRule.id,
                      data: {
                        name: editingRule.name,
                        pattern: editingRule.pattern,
                        match_type: editingRule.match_type,
                        department_id: editingRule.department_id,
                        channel_id: editingRule.channel_id || undefined,
                        priority: editingRule.priority,
                      },
                    });
                    setEditingRule(null);
                  }}
                >
                  {updateRule.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
                  Guardar
                </Button>
                <Button variant="outline" onClick={() => setEditingRule(null)}>Cancelar</Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

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
  TELEGRAM: "bg-sky-500/10 text-sky-400",
  FORM: "bg-purple-500/10 text-purple-400",
  API: "bg-orange-500/10 text-orange-400",
  MANUAL: "bg-gray-500/10 text-gray-400",
};

const CHANNEL_ICONS: Record<string, any> = {
  EMAIL: Mail,
  WHATSAPP: MessageCircle,
  TELEGRAM: Send,
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
    // IMPORTANTE — DEFAULT `staging` ES PARA DEV/PRUEBAS DE FACTURACION.
    // CUANDO EL CLIENTE QUIERA EMITIR FACTURAS REALES A HACIENDA, DEBE
    // CAMBIAR ESTE CAMPO A `production` EN SUS SETTINGS. SI SE QUEDA EN
    // STAGING, LAS FACTURAS NO TIENEN VALIDEZ FISCAL.
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
            <div className="rounded-md border border-sky-500/20 bg-sky-500/10 p-4">
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
                  className={`w-full rounded-md border px-4 py-3 text-left transition-colors ${
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

          <div className="rounded-md border border-border bg-[hsl(var(--elevated))] p-5">
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
  const [codeOpen, setCodeOpen] = useState(false);
  const [codeRole, setCodeRole] = useState("AGENT");
  const [codeMax, setCodeMax] = useState("5");
  const [codeExpiry, setCodeExpiry] = useState("7");

  const { data, isLoading } = useQuery({
    queryKey: ["/api/workspaces/current/members"],
    queryFn: () => api.getMembers(),
  });

  const { data: codes, isLoading: codesLoading } = useQuery({
    queryKey: ["/api/workspaces/current/invite-codes"],
    queryFn: () => api.getInviteCodes().catch(() => []),
  });

  const invite = useMutation({
    mutationFn: () => api.inviteUser({ email, role }),
    onSuccess: () => {
      toast({ title: "Invitación enviada" });
      qc.invalidateQueries({ queryKey: ["/api/workspaces/current/members"] });
      setOpen(false); setEmail("");
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const changeRoleMut = useMutation({
    mutationFn: ({ userId, newRole }: { userId: string; newRole: string }) => api.changeMemberRole(userId, newRole),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/workspaces/current/members"] }); toast({ title: "Rol actualizado" }); },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const removeMut = useMutation({
    mutationFn: (userId: string) => api.removeMember(userId),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/workspaces/current/members"] }); toast({ title: "Miembro removido" }); },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const genCode = useMutation({
    mutationFn: () => api.createInviteCode({ role: codeRole, max_uses: Number(codeMax) || 5, expires_in_days: Number(codeExpiry) || 7 }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/workspaces/current/invite-codes"] }); setCodeOpen(false); toast({ title: "Código generado" }); },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const revokeCode = useMutation({
    mutationFn: (id: string) => api.revokeInviteCode(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/workspaces/current/invite-codes"] }); toast({ title: "Código revocado" }); },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const members = Array.isArray(data) ? data : [];
  const codesList = Array.isArray(codes) ? codes : [];

  return (
    <div className="space-y-6">
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
                <div className="flex items-center gap-2">
                  <Select value={m.role} onValueChange={newRole => changeRoleMut.mutate({ userId: m.user_id, newRole })} disabled={m.role === 'OWNER'}>
                    <SelectTrigger className="h-7 text-[11px] w-24 bg-elevated border-border"><SelectValue /></SelectTrigger>
                    <SelectContent className="bg-card border-border">
                      {["ADMIN", "AGENT", "VIEWER"].map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  {m.role !== 'OWNER' && (
                    <Button variant="ghost" size="sm" className="h-7 text-[11px] text-destructive hover:text-destructive" onClick={() => { if (window.confirm(`¿Remover a ${m.name || m.email} del workspace?`)) removeMut.mutate(m.user_id); }}>
                      <UserMinus className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="border-t border-border my-4" />

      <div>
        <div className="flex justify-between items-center mb-3">
          <div>
            <h3 className="text-sm font-semibold">Códigos de invitación</h3>
            <p className="text-xs text-muted-foreground">Generá códigos para compartir en WhatsApp, SMS o verbalmente.</p>
          </div>
          <Dialog open={codeOpen} onOpenChange={setCodeOpen}>
            <DialogTrigger asChild>
              <Button size="sm" variant="outline"><Key className="h-4 w-4 mr-2" />Generar código</Button>
            </DialogTrigger>
            <DialogContent className="bg-card border-border">
              <DialogHeader><DialogTitle>Generar código de invitación</DialogTitle></DialogHeader>
              <div className="space-y-3 pt-2">
                <div>
                  <Label>Rol asignado</Label>
                  <Select value={codeRole} onValueChange={setCodeRole}>
                    <SelectTrigger className="mt-1 bg-[hsl(var(--elevated))] border-border"><SelectValue /></SelectTrigger>
                    <SelectContent className="bg-card border-border">
                      {["ADMIN", "AGENT", "VIEWER"].map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Usos máximos</Label>
                    <Input type="number" value={codeMax} onChange={e => setCodeMax(e.target.value)} placeholder="5" className="mt-1 bg-[hsl(var(--elevated))] border-border" />
                  </div>
                  <div>
                    <Label>Expira en días</Label>
                    <Input type="number" value={codeExpiry} onChange={e => setCodeExpiry(e.target.value)} placeholder="7" className="mt-1 bg-[hsl(var(--elevated))] border-border" />
                  </div>
                </div>
                <Button onClick={() => genCode.mutate()} disabled={genCode.isPending} className="w-full bg-primary hover:bg-primary/90">
                  {genCode.isPending ? "Generando..." : "Generar código"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {codesList.length > 0 && (
          <div className="space-y-2">
            {codesList.map((c: any) => (
              <div key={c.id} className="flex items-center justify-between p-3 rounded-lg bg-card border border-border">
                <div className="flex items-center gap-3">
                  <span className="font-mono text-sm font-bold tracking-wider text-primary">{c.code}</span>
                  <span className="text-xs text-muted-foreground">{c.used_count}/{c.max_uses} usos</span>
                  <Badge variant="outline" className={c.is_active && new Date(c.expires_at) > new Date() ? "border-green-500/30 text-green-400 bg-green-500/10" : "border-red-500/30 text-red-400 bg-red-500/10"}>
                    {!c.is_active ? "Revocado" : new Date(c.expires_at) > new Date() ? "Activo" : "Expirado"}
                  </Badge>
                  <span className="text-[10px] text-muted-foreground">{new Date(c.expires_at).toLocaleDateString("es-CR")}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Button variant="ghost" size="sm" className="h-7 text-[11px]" onClick={() => { navigator.clipboard.writeText(c.code); toast({ title: "Copiado", description: "Compartí el código con quien quieras invitar." }); }}>
                    <Copy className="h-3.5 w-3.5 mr-1" />Copiar
                  </Button>
                  {c.is_active && (
                    <Button variant="ghost" size="sm" className="h-7 text-[11px] text-destructive" onClick={() => { if (window.confirm("¿Revocar este código?")) revokeCode.mutate(c.id); }}>
                      Revocar
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
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
  const [smtpHost, setSmtpHost] = useState(channel?.config?.smtp_host ?? "");
  const [smtpPort, setSmtpPort] = useState(channel?.config?.smtp_port ?? 587);
  const [smtpUser, setSmtpUser] = useState(channel?.config?.smtp_user ?? "");
  const [smtpPassword, setSmtpPassword] = useState("");
  const [smtpTls, setSmtpTls] = useState(channel?.config?.smtp_tls ?? true);
  const [useSmtp, setUseSmtp] = useState(!!channel?.config?.smtp_host);
  const webhookUrl = `${window.location.origin}/api/inbound/email/webhook`;
  const resolvedInboundEmail = inboundEmail.trim() || fromEmail.trim();
  const workspaceHeader = channel?.workspace_id ?? "WORKSPACE_ID";

  const save = useMutation({
    mutationFn: () => api.configureEmail(channel.id, {
      api_key: useSmtp ? undefined : (apiKey || undefined),
      from_email: fromEmail,
      inbound_email: inboundEmail.trim() ? inboundEmail : undefined,
      from_name: fromName,
      ...(useSmtp ? {
        smtp_host: smtpHost || undefined,
        smtp_port: smtpPort,
        smtp_user: smtpUser || undefined,
        smtp_password: smtpPassword || undefined,
        smtp_tls: smtpTls,
      } : {}),
    }),
    onSuccess: () => {
      toast({ title: "Canal EMAIL guardado y activado" });
      qc.invalidateQueries({ queryKey: ["/api/channels"] });
      onClose();
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const isEdit = channel?.status === "ACTIVE";

  const [testingSmtp, setTestingSmtp] = useState(false);
  const testSmtp = async () => {
    if (!smtpHost || !smtpUser || !smtpPassword) {
      toast({ title: "Faltan datos", description: "Completá servidor, usuario y contraseña SMTP.", variant: "destructive" });
      return;
    }
    setTestingSmtp(true);
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL || ""}/api/email/test-smtp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ host: smtpHost, port: smtpPort, user: smtpUser, password: smtpPassword, tls: smtpTls, from_email: fromEmail, from_name: fromName }),
      });
      if (res.ok) {
        toast({ title: "Conexión SMTP exitosa", description: "El servidor SMTP respondió correctamente." });
      } else {
        const err = await res.json().catch(() => ({}));
        toast({ title: "Error SMTP", description: err.message || "No se pudo conectar al servidor SMTP.", variant: "destructive" });
      }
    } catch (e: any) {
      toast({ title: "Error SMTP", description: e.message || "No se pudo conectar.", variant: "destructive" });
    } finally {
      setTestingSmtp(false);
    }
  };

  return (
    <div className="space-y-4 pt-2">
      {!useSmtp && (
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
      )}

      {!useSmtp && (
        <div>
          <Label>API Key de Resend {isEdit && <span className="text-muted-foreground font-normal">(dejá vacío para mantener la actual)</span>}</Label>
          <div className="mt-1">
            <SecretInput value={apiKey} onChange={setApiKey} placeholder={isEdit ? "••••••••••••••••••••" : "re_xxxxxxxxxxxxxxxxxxxx"} />
          </div>
        </div>
      )}

      <div className="flex items-center justify-between rounded-lg border border-border p-3">
        <div>
          <Label className="text-xs">Usar SMTP personalizado</Label>
          <p className="text-[10px] text-muted-foreground mt-0.5">Gmail, Outlook, hosting propio — configurá tu servidor SMTP.</p>
        </div>
        <Switch checked={useSmtp} onCheckedChange={setUseSmtp} />
      </div>

      {useSmtp && (
        <div className="space-y-3 rounded-lg border border-border p-3">
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="sm" className="h-6 text-[10px] px-2" onClick={() => { setSmtpHost("smtp.gmail.com"); setSmtpPort(587); setSmtpTls(true); }}>Gmail</Button>
            <Button variant="ghost" size="sm" className="h-6 text-[10px] px-2" onClick={() => { setSmtpHost("smtp.office365.com"); setSmtpPort(587); setSmtpTls(true); }}>Outlook</Button>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-[11px]">Servidor SMTP</Label>
              <Input value={smtpHost} onChange={e => setSmtpHost(e.target.value)}
                placeholder="smtp.gmail.com" className="mt-1 h-8 text-xs bg-[hsl(var(--elevated))] border-border" />
            </div>
            <div>
              <Label className="text-[11px]">Puerto</Label>
              <Input type="number" value={smtpPort} onChange={e => setSmtpPort(Number(e.target.value))}
                placeholder="587" className="mt-1 h-8 text-xs bg-[hsl(var(--elevated))] border-border" />
            </div>
          </div>
          <div>
            <Label className="text-[11px]">Usuario SMTP</Label>
            <Input value={smtpUser} onChange={e => setSmtpUser(e.target.value)}
              placeholder="tu-email@gmail.com" className="mt-1 h-8 text-xs bg-[hsl(var(--elevated))] border-border" />
          </div>
          <div>
            <Label className="text-[11px]">Contraseña SMTP {isEdit && <span className="text-muted-foreground font-normal">(dejá vacío para mantener la actual)</span>}</Label>
            <div className="mt-1">
              <SecretInput value={smtpPassword} onChange={setSmtpPassword} placeholder={isEdit ? "••••••••••••••" : "contraseña o app password"} />
            </div>
            <p className="text-[10px] text-amber-400/80 mt-1">
              Gmail: usá una <a href="https://myaccount.google.com/apppasswords" target="_blank" rel="noreferrer" className="underline" onClick={e => { e.preventDefault(); void openExternal("https://myaccount.google.com/apppasswords"); }}>app password</a>, no tu contraseña normal.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Switch checked={smtpTls} onCheckedChange={setSmtpTls} id="smtp-tls" />
            <Label htmlFor="smtp-tls" className="text-[11px] text-muted-foreground">Usar TLS/STARTTLS</Label>
          </div>
        </div>
      )}

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

      {!useSmtp && (
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

        <div className="rounded border border-blue-500/20 bg-blue-500/10 px-3 py-2 text-blue-700 dark:text-blue-200">
          <p>
            Dirección inbound activa: <span className="font-mono">{resolvedInboundEmail || "sin definir"}</span>
          </p>
          <p className="mt-1 text-blue-600/80 dark:text-blue-100/80">
            Recomendado si tienes varios buzones: configurar esta dirección en Resend y además enviar <span className="font-mono">X-Channel-Id</span>.
          </p>
        </div>
      </div>
      )}

      <div className="flex gap-2">
        <Button
          onClick={() => save.mutate()}
          disabled={(!isEdit && ((!useSmtp && !apiKey) || (useSmtp && (!smtpHost || !smtpUser)))) || !fromEmail || !fromName || save.isPending}
          className="flex-1 bg-primary hover:bg-primary/90"
        >
          {save.isPending ? "Guardando..." : isEdit ? "Guardar cambios" : "Guardar y activar canal"}
        </Button>
        {useSmtp && (
          <Button
            variant="outline"
            onClick={testSmtp}
            disabled={!smtpHost || !smtpUser || !smtpPassword || testingSmtp}
            className="flex-1"
          >
            {testingSmtp && <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />}
            Probar conexión
          </Button>
        )}
      </div>
    </div>
  );
}

function WhatsAppConfigModal({ channel, onClose }: { channel: any; onClose: () => void }) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [accessToken, setAccessToken] = useState("");
  const [phoneNumberId, setPhoneNumberId] = useState(channel?.config?.phone_number_id ?? "");
  const [wabaId, setWabaId] = useState(channel?.config?.waba_id ?? "");
  const [copied, setCopied] = useState<string | null>(null);

  const { data: waConfig } = useQuery({
    queryKey: ["whatsapp-config"],
    queryFn: api.getWhatsAppConfig,
    staleTime: Infinity,
  });

  const copyToClipboard = async (text: string, label: string) => {
    try { await navigator.clipboard.writeText(text); setCopied(label); setTimeout(() => setCopied(null), 2000); }
    catch { /* ignore */ }
  };

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

      <div className="p-3 rounded-lg bg-[hsl(var(--elevated))] border border-border text-xs space-y-2">
        <p className="font-medium text-foreground">Configuración del webhook en Meta</p>

        <div>
          <Label className="text-[10px] text-muted-foreground">Webhook URL</Label>
          <div className="flex items-center gap-1.5 mt-1">
            <code className="text-[11px] bg-background px-2 py-1.5 rounded border border-border flex-1 truncate font-mono">
              {waConfig?.webhookUrl || "Cargando..."}
            </code>
            <Button variant="ghost" size="sm" className="h-7 text-[10px]"
              onClick={() => copyToClipboard(waConfig?.webhookUrl || "", "url")}>
              {copied === "url" ? "¡Copiado!" : "Copiar"}
            </Button>
          </div>
        </div>

        <div>
          <Label className="text-[10px] text-muted-foreground">Verify Token</Label>
          <div className="flex items-center gap-1.5 mt-1">
            <code className="text-[11px] bg-background px-2 py-1.5 rounded border border-border flex-1 truncate font-mono">
              {waConfig?.verifyToken || "••••"}
            </code>
            <Button variant="ghost" size="sm" className="h-7 text-[10px]"
              onClick={() => copyToClipboard(waConfig?.verifyToken || "", "token")}>
              {copied === "token" ? "¡Copiado!" : "Copiar"}
            </Button>
          </div>
        </div>

        <p className="text-[10px] text-muted-foreground/60">
          Copiá URL y token en Meta Developers → WhatsApp → Configuration → Webhook.
        </p>
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

function TelegramConfigModal({ channel, onClose }: { channel: any; onClose: () => void }) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [botToken, setBotToken] = useState("");

  const save = useMutation({
    mutationFn: () => api.configureTelegram(channel.id, { bot_token: botToken }),
    onSuccess: () => {
      toast({ title: "Bot de Telegram guardado y activado" });
      qc.invalidateQueries({ queryKey: ["/api/channels"] });
      onClose();
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const isEdit = channel?.status === "ACTIVE";

  return (
    <div className="space-y-4 pt-2">
      <div className="p-3 rounded-lg bg-sky-500/10 border border-sky-500/20 text-xs text-sky-300">
        Obtené el token del bot en{" "}
        <a
          href="https://t.me/BotFather"
          target="_blank"
          rel="noreferrer"
          className="underline inline-flex items-center gap-1"
          onClick={(event) => {
            event.preventDefault();
            void openExternal("https://t.me/BotFather");
          }}
        >
          @BotFather <ExternalLink className="h-3 w-3" />
        </a>
        {" "} con los comandos /newbot
      </div>

      <div>
        <Label>Bot Token {isEdit && <span className="text-muted-foreground font-normal">(dejá vacío para mantener el actual)</span>}</Label>
        <div className="mt-1">
          <SecretInput value={botToken} onChange={setBotToken} placeholder={isEdit ? "••••••••••••••••••••" : "123456789:ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefgh"} />
        </div>
      </div>

      <div className="p-3 rounded-lg bg-[hsl(var(--elevated))] border border-border text-xs text-muted-foreground space-y-1">
        <p className="font-medium text-foreground">Webhook automático:</p>
        <p>El webhook se registra automáticamente al guardar el token</p>
        <p className="mt-2">Los mensajes que reciba tu bot aparecerán como conversaciones en PyMesHub</p>
      </div>

      <Button
        onClick={() => save.mutate()}
        disabled={(!isEdit && !botToken) || save.isPending}
        className="w-full bg-sky-600 hover:bg-sky-700"
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
  const isTelegram = configChannel?.type === "TELEGRAM";

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
                    {["EMAIL", "WHATSAPP", "TELEGRAM", "FORM", "API", "MANUAL"].map(t => (
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
          {isTelegram && <TelegramConfigModal channel={configChannel} onClose={() => setConfigChannel(null)} />}
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
            const needsConfig = ch.status !== "ACTIVE" && (ch.type === "EMAIL" || ch.type === "WHATSAPP" || ch.type === "TELEGRAM");
            const canConnect = ch.status !== "ACTIVE" && !needsConfig;
            const isActive = ch.status === "ACTIVE";
            const canEdit = isActive && (ch.type === "EMAIL" || ch.type === "WHATSAPP" || ch.type === "TELEGRAM");

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
                    <SelectItem key={m.user?.id || m.id} value={m.user?.id || m.id}>
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
                  <div className="rounded-md border border-border bg-[hsl(var(--elevated))] p-4 space-y-4">
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
    <div className="rounded-md border border-border bg-[hsl(var(--elevated))] p-4 space-y-4">
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
  const [agentReadEnabled, setAgentReadEnabled] = useState(false);
  const [agentActionsEnabled, setAgentActionsEnabled] = useState(false);

  useEffect(() => {
    if (workspace) {
      setProvider(workspace.ai_provider ?? "");
      setModel(workspace.ai_model ?? "");
      const s = workspace.settings_json || {};
      setAgentReadEnabled(s.ai_agent_enabled === true);
      setAgentActionsEnabled(s.ai_agent_actions_enabled === true);
    }
  }, [workspace?.ai_provider, workspace?.ai_model, workspace?.settings_json]);

  useEffect(() => {
    setTestResult(null);
  }, [provider, model, apiKey]);

  const save = useMutation({
    mutationFn: () => api.updateWorkspace({
      ai_provider: provider || undefined,
      ai_model:    model    || undefined,
      ai_api_key:  apiKey   || undefined,
      settings_json: {
        ai_agent_enabled: agentReadEnabled,
        ai_agent_actions_enabled: agentActionsEnabled,
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

function ApiTokensTab() {
  const { toast } = useToast();
  const { data: tokens = [], isLoading, refetch } = useQuery({
    queryKey: ['api-tokens'],
    queryFn: api.getApiTokens,
  });

  const createToken = useMutation({
    mutationFn: (name: string) => api.createApiToken(name),
    onSuccess: (data: any) => {
      refetch();
      setNewToken(data?.token || null);
      toast({ title: 'Token creado' });
    },
    onError: (err: any) => toast({ title: 'Error', description: err?.message, variant: 'destructive' }),
  });

  const revokeToken = useMutation({
    mutationFn: (id: string) => api.revokeApiToken(id),
    onSuccess: () => { refetch(); toast({ title: 'Token revocado' }); },
    onError: (err: any) => toast({ title: 'Error', description: err?.message, variant: 'destructive' }),
  });

  const [name, setName] = useState('');
  const [newToken, setNewToken] = useState<string | null>(null);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-foreground">API Keys</h2>
          <p className="text-sm text-muted-foreground mt-1">Tokens de acceso para aplicaciones externas.</p>
        </div>
        <Dialog>
          <DialogTrigger asChild>
            <Button size="sm"><Plus className="h-4 w-4 mr-1" />Nuevo Token</Button>
          </DialogTrigger>
          <DialogContent className="bg-card border-border max-w-md">
            <DialogHeader><DialogTitle className="text-foreground">Generar API Key</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div>
                <Label className="text-foreground">Nombre</Label>
                <Input value={name} onChange={e => setName(e.target.value)} placeholder="Ej: App de facturación" className="bg-[hsl(var(--elevated))] border-border" />
              </div>
              <Button className="w-full" disabled={createToken.isPending || !name.trim()} onClick={() => { createToken.mutate(name.trim()); setName(''); }}>
                {createToken.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null} Generar
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {newToken && (
        <div className="rounded-lg p-4 border border-yellow-500/30 bg-yellow-500/5 space-y-2">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-yellow-500" />
            <span className="text-sm font-semibold text-yellow-400">¡Guardá este token! No se mostrará de nuevo.</span>
          </div>
          <div className="flex items-center gap-2">
            <code className="flex-1 bg-foreground/[0.04] rounded px-3 py-2 text-xs text-yellow-600 dark:text-yellow-200 break-all font-mono">{newToken}</code>
            <Button variant="ghost" size="sm" onClick={() => { navigator.clipboard.writeText(newToken); toast({ title: 'Copiado' }); }}><Copy className="h-4 w-4" /></Button>
          </div>
        </div>
      )}

      {isLoading ? (
        <div className="flex items-center gap-2 text-muted-foreground py-4"><Loader2 className="h-4 w-4 animate-spin" /><span className="text-sm">Cargando...</span></div>
      ) : tokens.length === 0 ? (
        <p className="text-sm text-muted-foreground">Sin API keys creadas aún. Requiere plan Enterprise.</p>
      ) : (
        <div className="rounded-lg border border-border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-[hsl(var(--elevated))]"><tr><th className="text-left px-4 py-2 text-muted-foreground font-medium">Nombre</th><th className="text-left px-4 py-2 text-muted-foreground font-medium">Creado</th><th className="text-left px-4 py-2 text-muted-foreground font-medium">Último uso</th><th className="text-right px-4 py-2 text-muted-foreground font-medium"></th></tr></thead>
            <tbody>
              {tokens.map((t: any) => (
                <tr key={t.id} className="border-t border-border hover:bg-[hsl(var(--elevated))] transition-colors">
                  <td className="px-4 py-2.5 text-foreground font-medium">{t.name}</td>
                  <td className="px-4 py-2.5 text-muted-foreground text-xs">{t.created_at ? new Date(t.created_at).toLocaleDateString() : '-'}</td>
                  <td className="px-4 py-2.5 text-muted-foreground text-xs">{t.last_used_at ? new Date(t.last_used_at).toLocaleString() : 'Nunca'}</td>
                  <td className="px-4 py-2.5 text-right"><Button variant="ghost" size="sm" onClick={() => { if (confirm('¿Revocar?')) revokeToken.mutate(t.id); }}><Trash2 className="h-4 w-4 text-red-400" /></Button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// PROFILE TAB
// ═══════════════════════════════════════════════════════════════════════════════




export default function Settings() {
  const { user } = useAuth();
  const { messages } = useI18n();
  const copy = messages.settings;
  const isPlatformAdmin = user?.is_platform_admin === true;
  const plan = user?.workspace?.plan ?? 'FREE';
  const tabParam = new URLSearchParams(window.location.search).get('tab');
  const defaultTab = tabParam || 'workspace';
  const isPlanAtLeast = (min: string) => {
    const order = ['FREE', 'STARTER', 'GROWTH', 'BUSINESS', 'ENTERPRISE', 'BUSINESS_PLUS'];
    return order.indexOf(plan) >= order.indexOf(min);
  };

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
      <div className="px-6 pb-2">
        <DiagnosticButton module="settings" />
      </div>
      <Card className="bg-card border-border">
        <CardContent className="pt-6">
          {defaultTab === "profile" && <ProfileTab />}
          {defaultTab === "workspace" && <WorkspaceTab />}
          {defaultTab === "billing" && <BillingPage />}
          {defaultTab === "members" && <MembersTab />}
          {defaultTab === "departments" && <DepartmentsTab />}
          {defaultTab === "channels" && <ChannelsTab />}
          {defaultTab === "routing" && <RoutingRulesTab />}
          {defaultTab === "integrations" && <IntegrationsTab />}
          {defaultTab === "ai" && <AiTab />}
          {defaultTab === "apitokens" && isPlanAtLeast('BUSINESS') && <ApiTokensTab />}
          {defaultTab === "saml" && isPlanAtLeast('BUSINESS') && <SamlConfig />}
          {defaultTab === "enterprise" && isPlanAtLeast('BUSINESS_PLUS') && <EnterpriseSettingsTab />}
          {defaultTab === "platform" && isPlatformAdmin && <PlatformTab />}
          {!["profile","workspace","billing","members","departments","channels","routing","integrations","ai","apitokens","saml","enterprise","platform"].includes(defaultTab) && <WorkspaceTab />}
        </CardContent>
      </Card>
      <HelpButton page="Configuración" />
    </div>
  );
}
