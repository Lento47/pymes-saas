import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { BookOpen, CheckCircle2, AlertTriangle } from "lucide-react";
import { SecretInput } from "@/components/settings/secret-input";
import { SettingsLayout } from "@/components/settings/settings-layout";

export default function WorkspaceSettingsPage() {
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
    mutationFn: (payload: Record<string, any>) => api.updateWorkspace(payload),
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

  if (isLoading) return <SettingsLayout><div className="text-muted-foreground text-sm">Cargando...</div></SettingsLayout>;
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
    <SettingsLayout>
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
    </SettingsLayout>
  );
}
