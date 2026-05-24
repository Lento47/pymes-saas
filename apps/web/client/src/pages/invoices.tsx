import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { differenceInCalendarDays, format } from "date-fns";
import { es } from "date-fns/locale";
import {
  AlertTriangle,
  BookOpen,
  CheckCircle2,
  Code2,
  Coins,
  Eye,
  FileUp,
  Info,
  Loader2,
  Pencil,
  Plus,
  RefreshCw,
  Receipt,
  Search,
  Send,
  Trash2,
  Upload,
} from "lucide-react";
import { api } from "@/lib/api";
import { apiErrorDescription } from "@/lib/api-error";
import { queryClient } from "@/lib/queryClient";
import CsvImportModal from "@/components/import/csv-import-modal";
import { useRequireAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { PageHeader } from "@/components/shared/page-header";
import { DiagnosticButton } from "@/components/shared/diagnostic-button";
import { EmptyState } from "@/components/shared/empty-state";
import { PageLoader } from "@/components/shared/loading-spinner";
import { StatusBadge } from "@/components/shared/status-badge";
import { HaciendaChecklist, type ChecklistItem } from "@/components/shared/hacienda-checklist";
import { InvoiceSheet } from "@/components/invoices/InvoiceSheet";
import { FieldHelp } from "@/components/invoices/FieldHelp";
import { HACIENDA_GUIDE } from "@/data/hacienda-guide";
import { STATUS_OPTIONS, HACIENDA_STATUS_OPTIONS, DOCUMENT_TYPES, ISSUANCE_MODES } from "@/data/invoice-filters";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

function formatMoney(amount: unknown, currency = "USD") {
  const value = Number(amount ?? 0);
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

// Replaced by `apiErrorDescription` from "@/lib/api-error" so the toast can
// surface the auto-opened support ticket as a clickable link, not just text.
const getErrorMessage = (err: unknown) => apiErrorDescription(err, "Ocurrió un error inesperado");

export default function InvoicesPage() {
  useRequireAuth();
  const { toast } = useToast();

  const [statusFilter, setStatusFilter] = useState("ALL");
  const [fiscalFilter, setFiscalFilter] = useState("ALL");
  const [contactFilter, setContactFilter] = useState("ALL");
  const [search, setSearch] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [showDetail, setShowDetail] = useState(false);
  const [showGuide, setShowGuide] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [showReminder, setShowReminder] = useState(false);
  const [showPayment, setShowPayment] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState<any>(null);
  const [highlightedIds, setHighlightedIds] = useState<string[]>([]);
  const [createForm, setCreateForm] = useState({
    contact_id: "",
    number: "",
    amount: "",
    currency: "USD",
    due_date: "",
    issue_date: new Date().toISOString().slice(0, 10),
    description: "",
    issuance_mode: "MANUAL_ONLY",
    document_type: "FACTURA_ELECTRONICA",
    sale_condition: "01",
    payment_method: "01",
    activity_code: "",
    line_description: "",
    cabys_code: "",
    tax_rate: "0",
    product_id: "",
  });
  const [paymentForm, setPaymentForm] = useState({
    amount: "",
    paid_at: "",
    method: "",
    reference: "",
    notes: "",
  });
  const [reminderDraft, setReminderDraft] = useState("");
  const [selectedChannelId, setSelectedChannelId] = useState("");
  const [editForm, setEditForm] = useState({
    number: "",
    amount: "",
    currency: "CRC",
    due_date: "",
    issue_date: "",
    description: "",
    issuance_mode: "MANUAL_ONLY",
    document_type: "FACTURA_ELECTRONICA",
    sale_condition: "01",
    payment_method: "01",
    activity_code: "",
    contact_id: "",
  });

  const invoiceParams: Record<string, string> = {};
  if (statusFilter !== "ALL") invoiceParams.status = statusFilter;
  if (fiscalFilter !== "ALL") invoiceParams.hacienda_status = fiscalFilter;
  if (contactFilter !== "ALL") invoiceParams.contact_id = contactFilter;

  const { data, isLoading } = useQuery({
    queryKey: ["/api/invoices", statusFilter, fiscalFilter, contactFilter],
    queryFn: () => api.getInvoices(Object.keys(invoiceParams).length ? invoiceParams : undefined),
  });
  const { data: workspaceData } = useQuery({
    queryKey: ["/api/workspaces/current", "invoice-hacienda-readiness"],
    queryFn: () => api.getWorkspace(),
  });

  const {
    data: contactsData,
    isLoading: isContactsLoading,
    isError: hasContactsError,
    refetch: refetchContacts,
  } = useQuery({
    queryKey: ["/api/contacts", "invoice-form"],
    queryFn: () => api.getContacts({ limit: "100" }),
  });

  const { data: channelsData } = useQuery({
    queryKey: ["/api/channels", "invoice-reminders"],
    queryFn: api.getChannels,
  });

  const contacts = Array.isArray(contactsData) ? contactsData : contactsData?.data ?? [];
  const invoices = Array.isArray(data) ? data : data?.data ?? [];
  const workspaceTaxProfile = workspaceData?.workspace_tax_profile;
  const missingTaxProfileFields = [
    !workspaceTaxProfile?.legal_name?.trim() ? "razón social" : null,
    !workspaceTaxProfile?.identification_type?.trim() ? "tipo ID" : null,
    !workspaceTaxProfile?.identification_number?.trim() ? "identificación" : null,
    !workspaceTaxProfile?.activity_code?.trim() ? "actividad" : null,
    !workspaceTaxProfile?.tax_email?.trim() ? "correo tributario" : null,
  ].filter(Boolean);
  const missingHaciendaSettings = [
    !workspaceData?.hacienda_environment ? "ambiente" : null,
    !workspaceData?.hacienda_callback_url ? "callback URL" : null,
    !workspaceData?.hacienda_client_id_set ? "client ID" : null,
    !workspaceData?.hacienda_token_url_set ? "token URL" : null,
    !workspaceData?.hacienda_username_set ? "usuario Hacienda" : null,
    !workspaceData?.hacienda_password_set ? "contraseña Hacienda" : null,
  ].filter(Boolean);
  const haciendaReadinessIssues = [...missingTaxProfileFields, ...missingHaciendaSettings];
  const isHaciendaWorkspaceReady = haciendaReadinessIssues.length === 0;
  const totalOverdue = useMemo(
    () => invoices.filter((invoice: any) => invoice.status === "OVERDUE").length,
    [invoices],
  );
  const overdueAmount = useMemo(
    () =>
      invoices
        .filter((invoice: any) => invoice.status === "OVERDUE")
        .reduce((sum: number, invoice: any) => sum + Number(invoice.balance_due ?? invoice.amount ?? 0), 0),
    [invoices],
  );
  const filteredInvoices = useMemo(() => {
    if (!search.trim()) return invoices;
    const q = search.toLowerCase();
    return invoices.filter((invoice: any) =>
      invoice.number?.toLowerCase().includes(q) ||
      invoice.contact?.full_name?.toLowerCase().includes(q),
    );
  }, [invoices, search]);

  const availableChannels = useMemo(() => {
    const rows = Array.isArray(channelsData) ? channelsData : channelsData?.data ?? [];
    return rows.filter((channel: any) =>
      channel.status === "ACTIVE" && ["EMAIL", "WHATSAPP"].includes(channel.type),
    );
  }, [channelsData]);

  useEffect(() => {
    if (!selectedInvoice) return;
    const preferred = availableChannels.find((channel: any) =>
      channel.type === "WHATSAPP" ? selectedInvoice.contact?.phone : selectedInvoice.contact?.email,
    );
    setSelectedChannelId(preferred?.id ?? availableChannels[0]?.id ?? "");
  }, [availableChannels, selectedInvoice]);

  useEffect(() => {
    if (!showCreate) return;
    void refetchContacts();
  }, [showCreate, refetchContacts]);

  const invalidateInvoices = () => {
    queryClient.invalidateQueries({ queryKey: ["/api/invoices"] });
    queryClient.invalidateQueries({ queryKey: ["/api/invoices", "overdue-widget"] });
  };

  const createMutation = useMutation({
    mutationFn: () => {
      const {
        line_description,
        cabys_code,
        tax_rate,
        product_id,
        ...invoiceFields
      } = createForm;

      return api.createInvoice({
        ...invoiceFields,
        amount: Math.round(Number(createForm.amount) * 100) / 100,
        issue_date: createForm.issue_date,
        lines: createForm.issuance_mode === "HACIENDA"
          ? [{
              description: line_description || createForm.description || `Factura ${createForm.number}`,
              quantity: 1,
              unit_price: Math.round(Number(createForm.amount) * 100) / 100,
              cabys_code: cabys_code || undefined,
              unit_of_measure: "Unid",
              tax_code: "01",
              tax_rate: Number(tax_rate || 0),
              product_id: product_id || undefined,
            }]
          : undefined,
        notes: [],
      });
    },
    onSuccess: () => {
      invalidateInvoices();
      setShowCreate(false);
      setCreateForm({
        contact_id: "",
        number: "",
        amount: "",
        currency: "USD",
        due_date: "",
        issue_date: new Date().toISOString().slice(0, 10),
        description: "",
        issuance_mode: "MANUAL_ONLY",
        document_type: "FACTURA_ELECTRONICA",
        sale_condition: "01",
        payment_method: "01",
        activity_code: "",
        line_description: "",
        cabys_code: "",
        tax_rate: "0",
        product_id: "",
      });
      toast({ title: "Factura creada" });
    },
    onError: (err) => {
      toast({ title: "Error", description: getErrorMessage(err), variant: "destructive" });
    },
  });

  const detectMutation = useMutation({
    mutationFn: api.detectOverdueInvoices,
    onSuccess: (result) => {
      const rows = Array.isArray(result) ? result : result?.data ?? [];
      setHighlightedIds(rows.map((invoice: any) => invoice.id));
      invalidateInvoices();
      toast({ title: "Deudas detectadas", description: `${rows.length} factura(s) vencida(s)` });
    },
    onError: (err) => {
      toast({ title: "Error", description: getErrorMessage(err), variant: "destructive" });
    },
  });

  const markPaidMutation = useMutation({
    mutationFn: (id: string) => api.markInvoicePaid(id),
    onSuccess: () => {
      invalidateInvoices();
      toast({ title: "Factura saldada" });
    },
    onError: (err) => toast({ title: "Error", description: getErrorMessage(err), variant: "destructive" }),
  });

  const registerPaymentMutation = useMutation({
    mutationFn: () =>
      api.registerInvoicePayment(selectedInvoice.id, {
        amount: Math.round(Number(paymentForm.amount) * 100) / 100,
        paid_at: paymentForm.paid_at || undefined,
        method: paymentForm.method || undefined,
        reference: paymentForm.reference || undefined,
        notes: paymentForm.notes || undefined,
      }),
    onSuccess: () => {
      invalidateInvoices();
      setShowPayment(false);
      setSelectedInvoice(null);
      setPaymentForm({
        amount: "",
        paid_at: "",
        method: "",
        reference: "",
        notes: "",
      });
      toast({ title: "Pago registrado" });
    },
    onError: (err) => toast({ title: "Error", description: getErrorMessage(err), variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.deleteInvoice(id),
    onSuccess: () => {
      invalidateInvoices();
      toast({ title: "Factura eliminada" });
    },
    onError: (err) => toast({ title: "Error", description: getErrorMessage(err), variant: "destructive" }),
  });

  const cancelMutation = useMutation({
    mutationFn: (id: string) => api.updateInvoice(id, { status: "CANCELLED" }),
    onSuccess: () => {
      invalidateInvoices();
      toast({ title: "Factura cancelada" });
    },
    onError: (err) => toast({ title: "Error al cancelar", description: getErrorMessage(err), variant: "destructive" }),
  });

  const creditNoteMutation = useMutation({
    mutationFn: (invoice: Record<string, any>) => api.createCreditNote(invoice.id, {
      number: `NC-${invoice.number}`,
      amount: Math.round(Number(invoice.amount) * 100) / 100,
      currency: invoice.currency,
      due_date: new Date().toISOString().slice(0, 10),
    }),
    onSuccess: () => {
      invalidateInvoices();
      toast({ title: "Nota de crédito creada. Revisa y envía a Hacienda." });
    },
    onError: (err) => toast({ title: "Error", description: getErrorMessage(err), variant: "destructive" }),
  });

  const submitHaciendaMutation = useMutation({
    mutationFn: (id: string) => api.submitInvoiceToHacienda(id),
    onSuccess: () => {
      invalidateInvoices();
      toast({ title: "Comprobante enviado a Hacienda" });
    },
    onError: (err) => toast({ title: "Error Hacienda", description: getErrorMessage(err), variant: "destructive" }),
  });

  const syncHaciendaMutation = useMutation({
    mutationFn: (id: string) => api.syncInvoiceHaciendaStatus(id),
    onSuccess: () => {
      invalidateInvoices();
      toast({ title: "Estado Hacienda actualizado" });
    },
    onError: (err) => toast({ title: "Error Hacienda", description: getErrorMessage(err), variant: "destructive" }),
  });

  const [showValidation, setShowValidation] = useState(false);
  const [validationResult, setValidationResult] = useState<any>(null);
  const validateHaciendaMutation = useMutation({
    mutationFn: (id: string) => api.validateInvoiceForHacienda(id),
    onSuccess: (data) => {
      setValidationResult(data);
      setShowValidation(true);
    },
    onError: (err) => toast({ title: "Error", description: getErrorMessage(err), variant: "destructive" }),
  });

  const [showErrorExplain, setShowErrorExplain] = useState(false);
  const [errorExplainData, setErrorExplainData] = useState<any>(null);
  const explainErrorMutation = useMutation({
    mutationFn: (id: string) => api.getInvoiceHaciendaErrorExplain(id),
    onSuccess: (data) => {
      setErrorExplainData(data);
      setShowErrorExplain(true);
    },
    onError: (err) => toast({ title: "Error", description: getErrorMessage(err), variant: "destructive" }),
  });

  const [showXmlPreview, setShowXmlPreview] = useState(false);
  const [xmlPreview, setXmlPreview] = useState<{ xml: string } | null>(null);
  const xmlPreviewMutation = useMutation({
    mutationFn: (id: string) => api.getInvoiceXmlPreview(id),
    onSuccess: (data) => {
      setXmlPreview(data as { xml: string });
      setShowXmlPreview(true);
    },
    onError: (err) => toast({ title: "Error", description: getErrorMessage(err), variant: "destructive" }),
  });

  const generateReminderMutation = useMutation({
    mutationFn: (invoice: Record<string, any>) => api.generateInvoiceReminder(invoice.id),
    onSuccess: (reminder: Record<string, any>, invoice: any) => {
      setSelectedInvoice(invoice);
      setReminderDraft(reminder?.draft_text ?? "");
    },
    onError: (err) => {
      setShowReminder(false);
      toast({ title: "Error al redactar", description: getErrorMessage(err), variant: "destructive" });
    },
  });

  const sendReminderMutation = useMutation({
    mutationFn: () =>
      api.sendInvoiceReminder(selectedInvoice.id, {
        channel_id: selectedChannelId,
        draft_text: reminderDraft,
      }),
    onSuccess: () => {
      invalidateInvoices();
      setShowReminder(false);
      setSelectedInvoice(null);
      setReminderDraft("");
      toast({ title: "Recordatorio enviado" });
    },
    onError: (err) => {
      toast({ title: "Error al enviar", description: getErrorMessage(err), variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: () =>
      api.updateInvoice(selectedInvoice.id, {
        number: editForm.number,
        amount: Math.round(Number(editForm.amount) * 100) / 100,
        currency: editForm.currency,
        due_date: editForm.due_date,
        issue_date: editForm.issue_date,
        description: editForm.description || undefined,
        issuance_mode: editForm.issuance_mode,
        document_type: editForm.document_type,
        sale_condition: editForm.sale_condition || undefined,
        payment_method: editForm.payment_method || undefined,
        activity_code: editForm.activity_code || undefined,
        contact_id: editForm.contact_id || undefined,
      }),
    onSuccess: () => {
      invalidateInvoices();
      setShowEdit(false);
      setSelectedInvoice(null);
      toast({ title: "Factura actualizada" });
    },
    onError: (err) => toast({ title: "Error", description: getErrorMessage(err), variant: "destructive" }),
  });

  const openEditModal = (invoice: any) => {
    setSelectedInvoice(invoice);
    setEditForm({
      number: invoice.number ?? "",
      amount: String(Number(invoice.amount ?? 0)),
      currency: invoice.currency ?? "CRC",
      due_date: invoice.due_date ? invoice.due_date.slice(0, 10) : "",
      issue_date: invoice.issue_date ? invoice.issue_date.slice(0, 10) : new Date().toISOString().slice(0, 10),
      description: invoice.description ?? "",
      issuance_mode: invoice.issuance_mode ?? "MANUAL_ONLY",
      document_type: invoice.document_type ?? "FACTURA_ELECTRONICA",
      sale_condition: invoice.sale_condition ?? "01",
      payment_method: invoice.payment_method ?? "01",
      activity_code: invoice.activity_code ?? "",
      contact_id: invoice.contact?.id ?? "",
    });
    setShowEdit(true);
  };

  const openReminderModal = (invoice: any) => {
    setSelectedInvoice(invoice);
    setReminderDraft(invoice.reminders?.[0]?.draft_text ?? "");
    setShowReminder(true);
    generateReminderMutation.mutate(invoice);
  };

  const openPaymentModal = (invoice: any) => {
    setSelectedInvoice(invoice);
    setPaymentForm({
      amount: String(Number(invoice.balance_due ?? 0).toFixed(2)),
      paid_at: new Date().toISOString().slice(0, 10),
      method: "",
      reference: "",
      notes: "",
    });
    setShowPayment(true);
  };

  return (
    <div>
      <PageHeader title="Facturas" description="Controla cuentas por cobrar, abonos y recordatorios de pago">
        <Button
          variant="outline"
          size="sm"
          className="h-8 text-xs hidden md:inline-flex"
          onClick={() => detectMutation.mutate()}
          disabled={detectMutation.isPending}
        >
          {detectMutation.isPending ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : <Search className="w-3.5 h-3.5 mr-1.5" />}
          Detectar deudas
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="h-8 text-xs hidden md:inline-flex"
          onClick={() => setShowGuide(true)}
        >
          <BookOpen className="w-3.5 h-3.5 mr-1.5" /> Guía Hacienda
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="h-8 text-xs"
          onClick={() => setImportOpen(true)}
        >
          <Upload className="w-3.5 h-3.5 mr-1.5" /> Import CSV
        </Button>
        <Button
          size="sm"
          className="h-8 text-xs"
          onClick={() => setShowCreate(true)}
        >
          <Plus className="w-3.5 h-3.5 mr-1.5" /> Nueva factura
        </Button>
      </PageHeader>

      <div className="px-6 pb-2">
        <DiagnosticButton module="invoices" />
      </div>

      <div className="px-4 md:px-6 py-4 space-y-4">
        {(totalOverdue > 0 || overdueAmount > 0) && (
          <div className="flex items-center justify-between rounded-lg border border-amber-500/20 bg-amber-500/10 px-4 py-3">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-400" />
              <div>
                <div className="text-sm font-medium text-foreground">
                  {totalOverdue} factura{totalOverdue === 1 ? "" : "s"} vencida{totalOverdue === 1 ? "" : "s"}
                </div>
                <div className="text-xs text-muted-foreground/60">
                  {formatMoney(overdueAmount, "USD")} pendientes de cobro
                </div>
              </div>
            </div>
          </div>
        )}

        <div className="rounded-lg border border-sky-500/20 bg-sky-500/10 px-4 py-3">
          <div className="flex items-start gap-3">
            <BookOpen className="mt-0.5 h-4 w-4 text-sky-400" />
            <div className="space-y-1">
              <div className="text-sm font-medium text-foreground">Ayuda para PYMES</div>
              <p className="text-xs leading-5 text-muted-foreground/60">
                Facturación ya muestra ayuda por campo con el ícono <span className="font-medium text-foreground">?</span>.
                Si usas modo <span className="font-medium text-foreground">HACIENDA</span>, conviene tener configurado
                el emisor, credenciales, certificado, callback y catálogos fiscales antes de emitir.
              </p>
            </div>
          </div>
        </div>
        {!isHaciendaWorkspaceReady && (
          <div className="rounded-lg border border-amber-500/20 bg-amber-500/10 px-4 py-3">
            <div className="flex items-start gap-3">
              <AlertTriangle className="mt-0.5 h-4 w-4 text-amber-400" />
              <div className="space-y-1">
                <div className="text-sm font-medium text-foreground">Hacienda aún no está lista para emitir</div>
                <p className="text-xs leading-5 text-muted-foreground/60">
                  Antes de usar <span className="font-medium text-foreground">Enviar MH</span>, completa en Configuración estos datos:
                  {" "}{haciendaReadinessIssues.join(", ")}.
                </p>
              </div>
            </div>
          </div>
        )}

        <div className="flex items-center gap-2 flex-wrap">
          <div className="relative flex-1 w-full sm:min-w-[200px] sm:max-w-[320px]">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground/60" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar factura o contacto..."
              className="h-8 text-xs bg-card border-border pl-8"
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[170px] h-8 text-xs bg-card border-border">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {STATUS_OPTIONS.map((status) => (
                <SelectItem key={status} value={status}>
                  {status === "ALL" ? "Todo estado" : status}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={fiscalFilter} onValueChange={setFiscalFilter}>
            <SelectTrigger className="w-[170px] h-8 text-xs bg-card border-border">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {HACIENDA_STATUS_OPTIONS.map((status) => (
                <SelectItem key={status} value={status}>
                  {status === "ALL" ? "Todo Hacienda" : status}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={contactFilter} onValueChange={setContactFilter}>
            <SelectTrigger className="w-[180px] h-8 text-xs bg-card border-border">
              <SelectValue placeholder="Contacto" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">Todo contacto</SelectItem>
              {contacts.map((contact: any) => (
                <SelectItem key={contact.id} value={contact.id}>
                  {contact.full_name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {isLoading ? (
          <PageLoader />
        ) : filteredInvoices.length === 0 ? (
          <EmptyState icon={Receipt} title="Sin facturas" description="Crea tu primera factura para empezar." />
        ) : (
          <div className="rounded-lg border border-border overflow-x-auto bg-card">
            <Table>
              <TableHeader>
                <TableRow className="border-border hover:bg-transparent">
            <TableHead className="text-[11px] text-muted-foreground/60 font-medium"># Factura</TableHead>
            <TableHead className="text-[11px] text-muted-foreground/60 font-medium">Contacto</TableHead>
            <TableHead className="text-[11px] text-muted-foreground/60 font-medium">Subtotal</TableHead>
            <TableHead className="text-[11px] text-muted-foreground/60 font-medium">IVA</TableHead>
            <TableHead className="text-[11px] text-muted-foreground/60 font-medium">Total</TableHead>
                  <TableHead className="text-[11px] text-muted-foreground/60 font-medium">Pagado</TableHead>
                  <TableHead className="text-[11px] text-muted-foreground/60 font-medium">Saldo</TableHead>
                  <TableHead className="text-[11px] text-muted-foreground/60 font-medium">Vencimiento</TableHead>
                  <TableHead className="text-[11px] text-muted-foreground/60 font-medium">Cobro / Hacienda</TableHead>
                  <TableHead className="text-[11px] text-muted-foreground/60 font-medium text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredInvoices.map((invoice: any) => {
                  const overdueDays = invoice.status === "OVERDUE"
                    ? Math.max(0, differenceInCalendarDays(new Date(), new Date(invoice.due_date)))
                    : 0;

                  return (
                    <TableRow
                      key={invoice.id}
                      className={cn(
                        "border-border hover:bg-foreground/[0.015]",
                        (invoice.status === "OVERDUE" || highlightedIds.includes(invoice.id)) && "bg-amber-500/5",
                      )}
                    >
                      <TableCell className="text-sm font-medium text-foreground">{invoice.number}</TableCell>
                      <TableCell>
                        <div className="text-sm text-foreground">{invoice.contact?.full_name ?? "—"}</div>
                        <div className="text-[11px] text-muted-foreground/60">{invoice.contact?.email || invoice.contact?.phone || "Sin dato de contacto"}</div>
                        {invoice.conversation?.subject && (
                          <div className="text-[11px] text-muted-foreground/60 truncate">{invoice.conversation.subject}</div>
                        )}
                      </TableCell>
                      <TableCell className="text-sm text-foreground">
                        {invoice.subtotal != null ? formatMoney(invoice.subtotal, invoice.currency) : "—"}
                      </TableCell>
                      <TableCell className="text-sm text-foreground">
                        {invoice.tax_rate != null ? `${invoice.tax_rate}%` : "—"}
                      </TableCell>
                      <TableCell className="text-sm text-foreground">
                        {formatMoney(invoice.amount, invoice.currency)}
                      </TableCell>
                      <TableCell className="text-sm text-foreground">
                        {formatMoney(invoice.amount_paid, invoice.currency)}
                      </TableCell>
                      <TableCell className="text-sm text-foreground">
                        <div>{formatMoney(invoice.balance_due, invoice.currency)}</div>
                        {invoice.status === "OVERDUE" && (
                          <div className="text-[11px] text-amber-400">{overdueDays}d vencida</div>
                        )}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground/60">
                        {format(new Date(invoice.due_date), "d MMM yyyy", { locale: es })}
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col gap-1">
                          <StatusBadge status={invoice.status} type="invoice" />
                          <StatusBadge status={invoice.hacienda_status} type="invoice" />
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-8 text-xs"
                            onClick={() => { setSelectedInvoice(invoice); setShowDetail(true); }}
                          >
                            <Eye className="w-3.5 h-3.5 mr-1.5" />
                            Ver
                          </Button>
                          {invoice.status !== "PAID" && invoice.status !== "CANCELLED" && (
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-8 text-xs"
                              onClick={() => openEditModal(invoice)}
                            >
                              <Pencil className="w-3.5 h-3.5 mr-1.5" />
                              Editar
                            </Button>
                          )}
                          {invoice.issuance_mode === "HACIENDA" && (
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-8 text-xs"
                              onClick={() => submitHaciendaMutation.mutate(invoice.id)}
                              disabled={
                                submitHaciendaMutation.isPending ||
                                !isHaciendaWorkspaceReady ||
                                ["SUBMITTED", "RECIBIDO", "PROCESANDO", "ACEPTADO"].includes(invoice.hacienda_status)
                              }
                              title={
                                !isHaciendaWorkspaceReady
                                  ? `Configura Hacienda antes de emitir: ${haciendaReadinessIssues.join(", ")}`
                                  : undefined
                              }
                            >
                              {submitHaciendaMutation.isPending && selectedInvoice?.id === invoice.id
                                ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                                : <FileUp className="w-3.5 h-3.5 mr-1.5" />}
                              Enviar MH
                            </Button>
                          )}
                          {invoice.issuance_mode === "HACIENDA" && invoice.clave && (
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-8 text-xs"
                              onClick={() => syncHaciendaMutation.mutate(invoice.id)}
                              disabled={syncHaciendaMutation.isPending}
                            >
                              <RefreshCw className={cn("w-3.5 h-3.5 mr-1.5", syncHaciendaMutation.isPending && "animate-spin")} />
                              Estado MH
                            </Button>
                          )}
                          {invoice.issuance_mode === "HACIENDA" && (
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-8 text-xs text-green-400 hover:text-green-300"
                              onClick={() => validateHaciendaMutation.mutate(invoice.id)}
                              disabled={validateHaciendaMutation.isPending}
                            >
                              {validateHaciendaMutation.isPending ? <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5 mr-1" />}
                              Validar MH
                            </Button>
                          )}
                          {invoice.hacienda_status === "RECHAZADO" && invoice.hacienda_last_error && (
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-8 text-xs text-amber-400 hover:text-amber-300"
                              onClick={() => explainErrorMutation.mutate(invoice.id)}
                              disabled={explainErrorMutation.isPending}
                            >
                              {explainErrorMutation.isPending ? <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" /> : <Info className="w-3.5 h-3.5 mr-1" />}
                              Error MH
                            </Button>
                          )}
                          {invoice.issuance_mode === "HACIENDA" && (
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-8 text-xs"
                              onClick={() => xmlPreviewMutation.mutate(invoice.id)}
                              disabled={xmlPreviewMutation.isPending}
                            >
                              {xmlPreviewMutation.isPending ? <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" /> : <Code2 className="w-3.5 h-3.5 mr-1" />}
                              XML
                            </Button>
                          )}
                          {invoice.status === "OVERDUE" && (
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-8 text-xs"
                              onClick={() => openReminderModal(invoice)}
                              disabled={generateReminderMutation.isPending && selectedInvoice?.id === invoice.id}
                            >
                              {generateReminderMutation.isPending && selectedInvoice?.id === invoice.id
                                ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                                : <Pencil className="w-3.5 h-3.5 mr-1.5" />}
                              Redactar
                            </Button>
                          )}
                          {!["PAID", "CANCELLED"].includes(invoice.status) && (
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-8 text-xs"
                              onClick={() => openPaymentModal(invoice)}
                            >
                              <Coins className="w-3.5 h-3.5 mr-1.5" />
                              Registrar pago
                            </Button>
                          )}
                          {!["PAID", "CANCELLED"].includes(invoice.status) && (
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-8 text-xs"
                              onClick={() => markPaidMutation.mutate(invoice.id)}
                            >
                              <CheckCircle2 className="w-3.5 h-3.5 mr-1.5" />
                              Saldar
                            </Button>
                          )}
                          {invoice.status !== "CANCELLED" &&
                           !(invoice.issuance_mode === "HACIENDA" && ["SUBMITTED", "RECIBIDO", "PROCESANDO", "ACEPTADO"].includes(invoice.hacienda_status)) && (
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-8 text-xs text-amber-400 hover:text-amber-300"
                              disabled={cancelMutation.isPending}
                              onClick={() => {
                                if (window.confirm(`¿Cancelar factura ${invoice.number}? Esta acción no se puede deshacer.`)) {
                                  cancelMutation.mutate(invoice.id);
                                }
                              }}
                            >
                              Cancelar
                            </Button>
                          )}
                          {invoice.issuance_mode === "HACIENDA" && invoice.hacienda_status === "ACEPTADO" && (
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-8 text-xs"
                              disabled={creditNoteMutation.isPending}
                              onClick={() => {
                                if (window.confirm(`¿Crear nota de crédito para ${invoice.number}? Se generará un comprobante de anulación.`)) {
                                  creditNoteMutation.mutate(invoice);
                                }
                              }}
                            >
                              Nota crédito
                            </Button>
                          )}
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-8 text-xs text-destructive hover:text-destructive"
                            onClick={() => deleteMutation.mutate(invoice.id)}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      <InvoiceSheet
        open={showCreate}
        onOpenChange={setShowCreate}
        contacts={contacts}
        isContactsLoading={isContactsLoading}
        hasContactsError={hasContactsError}
        initialData={createForm}
        onChange={(updates) => setCreateForm((prev) => ({ ...prev, ...updates }))}
        onSave={() => createMutation.mutate()}
        isSaving={createMutation.isPending}
      />

      <Dialog open={showDetail} onOpenChange={(open) => { setShowDetail(open); if (!open) setSelectedInvoice(null); }}>
        <DialogContent className="bg-card border-border sm:max-w-[640px]">
          <DialogHeader>
            <DialogTitle className="text-sm">Detalle de factura</DialogTitle>
          </DialogHeader>
          {selectedInvoice && (
            <div className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div><span className="text-muted-foreground/60">Número</span><div className="text-foreground font-medium mt-0.5">{selectedInvoice.number}</div></div>
                <div><span className="text-muted-foreground/60">Estado</span><div className="mt-0.5"><StatusBadge status={selectedInvoice.status} type="invoice" /></div></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><span className="text-muted-foreground/60">Contacto</span><div className="text-foreground mt-0.5">{selectedInvoice.contact?.full_name ?? "—"}</div></div>
                <div><span className="text-muted-foreground/60">Empresa</span><div className="text-foreground mt-0.5">{selectedInvoice.contact?.company_name ?? "—"}</div></div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div><span className="text-muted-foreground/60">Total</span><div className="text-foreground font-medium mt-0.5">{formatMoney(selectedInvoice.amount, selectedInvoice.currency)}</div></div>
                <div><span className="text-muted-foreground/60">Pagado</span><div className="text-green-400 font-medium mt-0.5">{formatMoney(selectedInvoice.amount_paid, selectedInvoice.currency)}</div></div>
                <div><span className="text-muted-foreground/60">Saldo</span><div className="text-foreground font-medium mt-0.5">{formatMoney(selectedInvoice.balance_due, selectedInvoice.currency)}</div></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><span className="text-muted-foreground/60">Subtotal</span><div className="text-foreground mt-0.5">{selectedInvoice.subtotal != null ? formatMoney(selectedInvoice.subtotal, selectedInvoice.currency) : "—"}</div></div>
                <div><span className="text-muted-foreground/60">IVA</span><div className="text-foreground mt-0.5">{selectedInvoice.tax_rate != null ? `${selectedInvoice.tax_rate}%` : "—"}{selectedInvoice.tax_amount != null ? ` (${formatMoney(selectedInvoice.tax_amount, selectedInvoice.currency)})` : ""}</div></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><span className="text-muted-foreground/60">Emisión</span><div className="text-foreground mt-0.5">{selectedInvoice.issue_date ? format(new Date(selectedInvoice.issue_date), "d MMM yyyy", { locale: es }) : "—"}</div></div>
                <div><span className="text-muted-foreground/60">Vencimiento</span><div className="text-foreground mt-0.5">{selectedInvoice.due_date ? format(new Date(selectedInvoice.due_date), "d MMM yyyy", { locale: es }) : "—"}</div></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><span className="text-muted-foreground/60">Modo</span><div className="text-foreground mt-0.5">{selectedInvoice.issuance_mode}</div></div>
                <div><span className="text-muted-foreground/60">Hacienda</span><div className="mt-0.5"><StatusBadge status={selectedInvoice.hacienda_status} type="invoice" /></div></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><span className="text-muted-foreground/60">Moneda</span><div className="text-foreground mt-0.5">{selectedInvoice.currency}</div></div>
                <div><span className="text-muted-foreground/60">Tipo documento</span><div className="text-foreground mt-0.5">{selectedInvoice.document_type}</div></div>
              </div>
              {selectedInvoice.description && (
                <div><span className="text-muted-foreground/60">Descripción</span><div className="text-foreground mt-0.5 whitespace-pre-wrap">{selectedInvoice.description}</div></div>
              )}
              {selectedInvoice.lines?.length > 0 && (
                <div>
                  <span className="text-muted-foreground/60">Líneas ({selectedInvoice.lines.length})</span>
                  <div className="mt-1.5 rounded-lg border border-border overflow-hidden">
                    <table className="w-full text-[10px]">
                      <thead className="bg-muted/50">
                        <tr>
                          <th className="text-left px-2 py-1.5 text-muted-foreground font-medium">#</th>
                          <th className="text-left px-2 py-1.5 text-muted-foreground font-medium">Descripción</th>
                          <th className="text-right px-2 py-1.5 text-muted-foreground font-medium">Cant</th>
                          <th className="text-right px-2 py-1.5 text-muted-foreground font-medium">Precio</th>
                          <th className="text-right px-2 py-1.5 text-muted-foreground font-medium">IVA</th>
                          <th className="text-right px-2 py-1.5 text-muted-foreground font-medium">Total</th>
                        </tr>
                      </thead>
                      <tbody>
                        {selectedInvoice.lines.map((line: any) => (
                          <tr key={line.id} className="border-t border-border/50 hover:bg-muted/30 transition-colors">
                            <td className="px-2 py-1.5 text-muted-foreground">{line.line_number}</td>
                            <td className="px-2 py-1.5 text-foreground">
                              <span>{line.description}</span>
                              {line.product?.name && <span className="text-muted-foreground/60 ml-1">({line.product.name})</span>}
                            </td>
                            <td className="px-2 py-1.5 text-right text-foreground">{Number(line.quantity)}</td>
                            <td className="px-2 py-1.5 text-right text-foreground">{formatMoney(line.unit_price, selectedInvoice.currency)}</td>
                            <td className="px-2 py-1.5 text-right text-muted-foreground">{line.tax_rate != null ? `${line.tax_rate}%` : "—"}</td>
                            <td className="px-2 py-1.5 text-right text-foreground font-medium">{formatMoney(line.total_line_amount, selectedInvoice.currency)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
              {selectedInvoice.payments?.length > 0 && (
                <div>
                  <span className="text-muted-foreground/60">Pagos registrados</span>
                  <div className="mt-1 space-y-1">
                    {selectedInvoice.payments.map((p: any) => (
                      <div key={p.id} className="flex justify-between rounded border border-border bg-background px-2 py-1">
                        <span className="text-foreground">{formatMoney(p.amount, selectedInvoice.currency)}</span>
                        <span className="text-muted-foreground/60">{p.paid_at ? format(new Date(p.paid_at), "d MMM yyyy", { locale: es }) : "—"}</span>
                        <span className="text-muted-foreground/60">{p.method ?? "—"}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" size="sm" className="h-8 text-xs" onClick={() => setShowDetail(false)}>Cerrar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showEdit} onOpenChange={(open) => { setShowEdit(open); if (!open) setSelectedInvoice(null); }}>
        <DialogContent className="bg-card border-border sm:max-w-[460px]">
          <DialogHeader>
            <DialogTitle className="text-sm">Editar factura</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground/60">Modo</Label>
                <Select value={editForm.issuance_mode} onValueChange={(v) => setEditForm(f => ({ ...f, issuance_mode: v }))}>
                  <SelectTrigger className="h-8 text-xs bg-background border-border"><SelectValue /></SelectTrigger>
                  <SelectContent>{ISSUANCE_MODES.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground/60">Documento</Label>
                <Select value={editForm.document_type} onValueChange={(v) => setEditForm(f => ({ ...f, document_type: v }))}>
                  <SelectTrigger className="h-8 text-xs bg-background border-border"><SelectValue /></SelectTrigger>
                  <SelectContent>{DOCUMENT_TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground/60">Contacto</Label>
              <select
                value={editForm.contact_id}
                onChange={(e) => setEditForm(f => ({ ...f, contact_id: e.target.value }))}
                className="flex h-8 w-full rounded-md border border-border bg-background px-3 py-2 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
              >
                <option value="">Sin contacto</option>
                {contacts.map((c: any) => (
                  <option key={c.id} value={c.id}>{c.full_name}{c.company_name ? ` · ${c.company_name}` : ""}</option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground/60">Número</Label>
                <Input value={editForm.number} onChange={(e) => setEditForm(f => ({ ...f, number: e.target.value }))} className="h-8 text-xs bg-background border-border" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground/60">Moneda</Label>
                <Input value={editForm.currency} onChange={(e) => setEditForm(f => ({ ...f, currency: e.target.value.toUpperCase() }))} className="h-8 text-xs bg-background border-border" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground/60">Monto total</Label>
                <Input type="number" step="0.01" value={editForm.amount} onChange={(e) => setEditForm(f => ({ ...f, amount: e.target.value }))} className="h-8 text-xs bg-background border-border" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground/60">Vencimiento</Label>
                <Input type="date" value={editForm.due_date} onChange={(e) => setEditForm(f => ({ ...f, due_date: e.target.value }))} className="h-8 text-xs bg-background border-border" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground/60">Fecha emisión</Label>
                <Input type="date" value={editForm.issue_date} onChange={(e) => setEditForm(f => ({ ...f, issue_date: e.target.value }))} className="h-8 text-xs bg-background border-border" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground/60">Actividad</Label>
                <Input value={editForm.activity_code} onChange={(e) => setEditForm(f => ({ ...f, activity_code: e.target.value }))} className="h-8 text-xs bg-background border-border" placeholder="Código" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground/60">Condición venta</Label>
                <Input value={editForm.sale_condition} onChange={(e) => setEditForm(f => ({ ...f, sale_condition: e.target.value }))} className="h-8 text-xs bg-background border-border" placeholder="01" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground/60">Medio pago</Label>
                <Input value={editForm.payment_method} onChange={(e) => setEditForm(f => ({ ...f, payment_method: e.target.value }))} className="h-8 text-xs bg-background border-border" placeholder="01" />
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground/60">Descripción</Label>
              <Textarea value={editForm.description} onChange={(e) => setEditForm(f => ({ ...f, description: e.target.value }))} className="min-h-[80px] text-xs bg-background border-border" placeholder="Detalles opcionales" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" className="h-8 text-xs" onClick={() => setShowEdit(false)}>Cancelar</Button>
            <Button
              size="sm"
              className="h-8 text-xs"
              onClick={() => updateMutation.mutate()}
              disabled={updateMutation.isPending || !editForm.number.trim() || !editForm.amount || !editForm.due_date}
            >
              {updateMutation.isPending && <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />}
              Guardar cambios
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showGuide} onOpenChange={setShowGuide}>
        <DialogContent className="bg-card border-border sm:max-w-[720px]">
          <DialogHeader>
            <DialogTitle className="text-sm">Guía de conceptos de facturación y Hacienda</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="rounded-lg border border-border bg-background px-4 py-3">
              <div className="text-sm font-medium text-foreground">Qué necesita una factura rigurosa para Hacienda</div>
              <p className="mt-1 text-xs leading-5 text-muted-foreground/60">
                No basta con monto y cliente. Para que el sistema sea sólido se necesitan datos correctos del emisor,
                datos fiscales del receptor, líneas con CABYS e impuesto, catálogos tributarios, XML, firma, token,
                envío, callback o consulta de estado, y trazabilidad de aceptación o rechazo.
              </p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              {HACIENDA_GUIDE.map((item) => (
                <div key={item.title} className="rounded-lg border border-border bg-background px-4 py-3">
                  <div className="text-sm font-medium text-foreground">{item.title}</div>
                  <p className="mt-1 text-xs leading-5 text-muted-foreground/60">{item.meaning}</p>
                  <div className="mt-2 rounded-md border border-border bg-card px-2.5 py-2 text-xs leading-5 text-foreground">
                    {item.example}
                  </div>
                </div>
              ))}
            </div>
            <div className="rounded-lg border border-amber-500/20 bg-amber-500/10 px-4 py-3">
              <div className="text-sm font-medium text-foreground">Pendiente importante</div>
              <p className="mt-1 text-xs leading-5 text-muted-foreground/60">
                El flujo ya contempla la estructura de Hacienda, pero para operar en serio aún debes tener configurados
                el certificado real, la firma real, credenciales válidas, callback accesible y catálogos tributarios correctos.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" className="h-8 text-xs" onClick={() => setShowGuide(false)}>
              Cerrar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={showPayment}
        onOpenChange={(open) => {
          setShowPayment(open);
          if (!open) {
            setSelectedInvoice(null);
            setPaymentForm({
              amount: "",
              paid_at: "",
              method: "",
              reference: "",
              notes: "",
            });
          }
        }}
      >
        <DialogContent className="bg-card border-border sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle className="text-sm">Registrar pago</DialogTitle>
          </DialogHeader>
          {!selectedInvoice ? null : (
            <div className="space-y-3">
              <div className="rounded-md border border-border bg-background px-3 py-2 space-y-1">
                <div className="text-xs text-muted-foreground/60">
                  {selectedInvoice.number} · {selectedInvoice.contact?.full_name}
                </div>
                <div className="grid grid-cols-3 gap-3 text-xs">
                  <div>
                    <div className="text-muted-foreground/60">Total</div>
                    <div className="text-foreground">{formatMoney(selectedInvoice.amount, selectedInvoice.currency)}</div>
                  </div>
                  <div>
                    <div className="text-muted-foreground/60">Pagado</div>
                    <div className="text-foreground">{formatMoney(selectedInvoice.amount_paid, selectedInvoice.currency)}</div>
                  </div>
                  <div>
                    <div className="text-muted-foreground/60">Saldo</div>
                    <div className="text-foreground">{formatMoney(selectedInvoice.balance_due, selectedInvoice.currency)}</div>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground/60">Monto abonado</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={paymentForm.amount}
                    onChange={(e) => setPaymentForm((prev) => ({ ...prev, amount: e.target.value }))}
                    className="h-8 text-xs bg-background border-border"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground/60">Fecha de pago</Label>
                  <Input
                    type="date"
                    value={paymentForm.paid_at}
                    onChange={(e) => setPaymentForm((prev) => ({ ...prev, paid_at: e.target.value }))}
                    className="h-8 text-xs bg-background border-border"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground/60">Método</Label>
                  <Input
                    value={paymentForm.method}
                    onChange={(e) => setPaymentForm((prev) => ({ ...prev, method: e.target.value }))}
                    className="h-8 text-xs bg-background border-border"
                    placeholder="Pago móvil, transferencia..."
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground/60">Referencia</Label>
                  <Input
                    value={paymentForm.reference}
                    onChange={(e) => setPaymentForm((prev) => ({ ...prev, reference: e.target.value }))}
                    className="h-8 text-xs bg-background border-border"
                    placeholder="Comprobante"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground/60">Notas</Label>
                <Textarea
                  value={paymentForm.notes}
                  onChange={(e) => setPaymentForm((prev) => ({ ...prev, notes: e.target.value }))}
                  className="min-h-[90px] text-xs bg-background border-border"
                  placeholder="Detalle opcional del pago"
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" size="sm" className="h-8 text-xs" onClick={() => setShowPayment(false)}>
              Cancelar
            </Button>
            <Button
              size="sm"
              className="h-8 text-xs"
              onClick={() => registerPaymentMutation.mutate()}
              disabled={!selectedInvoice || !paymentForm.amount || registerPaymentMutation.isPending}
            >
              {registerPaymentMutation.isPending ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : <Coins className="w-3.5 h-3.5 mr-1.5" />}
              Guardar pago
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={showReminder}
        onOpenChange={(open) => {
          setShowReminder(open);
          if (!open) {
            setSelectedInvoice(null);
            setReminderDraft("");
          }
        }}
      >
        <DialogContent className="bg-card border-border sm:max-w-[560px]">
          <DialogHeader>
            <DialogTitle className="text-sm">Recordatorio de pago</DialogTitle>
          </DialogHeader>
          {!selectedInvoice || (generateReminderMutation.isPending && !reminderDraft.trim()) ? (
            <div className="py-6 flex items-center justify-center text-sm text-muted-foreground/60">
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Cargando borrador...
            </div>
          ) : (
            <div className="space-y-3">
              <div className="rounded-md border border-border bg-background px-3 py-2">
                <div className="text-xs text-muted-foreground/60">
                  {selectedInvoice.number} · {selectedInvoice.contact?.full_name}
                </div>
                <div className="text-sm text-foreground mt-1">
                  {formatMoney(selectedInvoice.balance_due, selectedInvoice.currency)} pendientes
                </div>
              </div>

              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground/60">Borrador</Label>
                <Textarea
                  value={reminderDraft}
                  onChange={(e) => setReminderDraft(e.target.value)}
                  className="min-h-[160px] text-sm bg-background border-border"
                  placeholder="El borrador generado aparecerá aquí"
                />
              </div>

              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground/60">Canal</Label>
                <Select value={selectedChannelId} onValueChange={setSelectedChannelId}>
                  <SelectTrigger className="h-8 text-xs bg-background border-border">
                    <SelectValue placeholder="Selecciona un canal" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableChannels.map((channel: any) => (
                      <SelectItem key={channel.id} value={channel.id}>
                        {channel.name} · {channel.type}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" size="sm" className="h-8 text-xs" onClick={() => setShowReminder(false)}>
              Cancelar
            </Button>
            <Button
              size="sm"
              className="h-8 text-xs"
              onClick={() => sendReminderMutation.mutate()}
              disabled={!selectedInvoice || !reminderDraft.trim() || !selectedChannelId || sendReminderMutation.isPending}
            >
              {sendReminderMutation.isPending ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : <Send className="w-3.5 h-3.5 mr-1.5" />}
              Enviar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <CsvImportModal open={importOpen} onClose={() => setImportOpen(false)} entityType="invoices" />

      <Dialog open={showValidation} onOpenChange={setShowValidation}>
        <DialogContent className="bg-card border-border sm:max-w-[520px]">
          <DialogHeader>
            <DialogTitle className="text-sm flex items-center gap-2">
              {validationResult?.valid ? <CheckCircle2 className="w-4 h-4 text-green-400" /> : <AlertTriangle className="w-4 h-4 text-amber-400" />}
              Validación Hacienda — {validationResult?.valid ? "Listo para enviar" : "Requiere correcciones"}
            </DialogTitle>
          </DialogHeader>
          {validationResult && (
            <div className="space-y-3 text-xs max-h-[50vh] overflow-y-auto">
              {validationResult.issues?.length > 0 && (
                <div className="space-y-2">
                  {validationResult.issues.map((issue: Record<string, any>, i: number) => (
                    <div key={i} className={cn(
                      "rounded-md border px-3 py-2",
                      issue.severity === "error" ? "border-red-500/20 bg-red-500/5" : "border-amber-500/20 bg-amber-500/5",
                    )}>
                      <span className={issue.severity === "error" ? "text-red-400" : "text-amber-400"}>{issue.field}</span>
                      <p className="text-muted-foreground mt-0.5">{issue.message}</p>
                    </div>
                  ))}
                </div>
              )}
              {validationResult.ai_review && (
                <div className="rounded-md border border-blue-500/20 bg-blue-500/5 px-3 py-2">
                  <span className="text-blue-400 font-medium">Revisión IA</span>
                  <p className="text-muted-foreground mt-0.5 whitespace-pre-wrap">{validationResult.ai_review}</p>
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" size="sm" className="h-8 text-xs" onClick={() => setShowValidation(false)}>Cerrar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showErrorExplain} onOpenChange={setShowErrorExplain}>
        <DialogContent className="bg-card border-border sm:max-w-[480px]">
          <DialogHeader>
            <DialogTitle className="text-sm flex items-center gap-2">
              <Info className="w-4 h-4 text-amber-400" />
              Error de Hacienda explicado
            </DialogTitle>
          </DialogHeader>
          {errorExplainData && (
            <div className="space-y-3 text-xs">
              <div className="rounded-md border border-red-500/20 bg-red-500/5 px-3 py-2">
                <span className="text-red-400 font-medium">Mensaje técnico</span>
                <p className="text-muted-foreground mt-0.5 whitespace-pre-wrap">{errorExplainData.technical_message?.slice(0, 500)}</p>
              </div>
              <div className="rounded-md border border-border/60 bg-background px-3 py-2">
                <span className="text-foreground font-medium">Explicación</span>
                <p className="text-muted-foreground mt-0.5 whitespace-pre-wrap">{errorExplainData.plain_explanation}</p>
              </div>
              {errorExplainData.suggested_fix && (
                <div className="rounded-md border border-green-500/20 bg-green-500/5 px-3 py-2">
                  <span className="text-green-400 font-medium">Sugerencia para corregir</span>
                  <p className="text-muted-foreground mt-0.5 whitespace-pre-wrap">{errorExplainData.suggested_fix}</p>
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" size="sm" className="h-8 text-xs" onClick={() => setShowErrorExplain(false)}>Cerrar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showXmlPreview} onOpenChange={setShowXmlPreview}>
        <DialogContent className="bg-card border-border sm:max-w-[680px] max-h-[80vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="text-sm flex items-center gap-2">
              <Code2 className="w-4 h-4 text-blue-400" />
              Vista previa XML — Factura Electrónica
            </DialogTitle>
          </DialogHeader>
          {xmlPreview && (
            <div className="flex-1 overflow-y-auto space-y-3 text-xs">
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 text-[10px]"
                  onClick={() => navigator.clipboard.writeText(xmlPreview.xml)}
                >
                  Copiar XML
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 text-[10px]"
                  onClick={() => {
                    const blob = new Blob([xmlPreview.xml], { type: "application/xml" });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement("a");
                    a.href = url;
                    a.download = "factura-electronica.xml";
                    a.click();
                    URL.revokeObjectURL(url);
                  }}
                >
                  Descargar XML
                </Button>
              </div>
              <pre className="rounded-md border border-border/60 bg-background p-3 text-[10px] text-muted-foreground whitespace-pre-wrap max-h-[300px] overflow-y-auto leading-relaxed">
                {xmlPreview.xml}
              </pre>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" size="sm" className="h-8 text-xs" onClick={() => setShowXmlPreview(false)}>Cerrar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
