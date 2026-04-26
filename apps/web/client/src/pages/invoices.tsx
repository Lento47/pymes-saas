import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { differenceInCalendarDays, format } from "date-fns";
import { es } from "date-fns/locale";
import {
  AlertTriangle,
  BookOpen,
  CheckCircle2,
  Coins,
  Eye,
  FileUp,
  HelpCircle,
  Loader2,
  Pencil,
  Plus,
  RefreshCw,
  Receipt,
  Search,
  Send,
  Sparkles,
  Trash2,
} from "lucide-react";
import { api } from "@/lib/api";
import { queryClient } from "@/lib/queryClient";
import { useRequireAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { PageLoader } from "@/components/shared/loading-spinner";
import { StatusBadge } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

const STATUS_OPTIONS = ["ALL", "DRAFT", "SENT", "PARTIALLY_PAID", "PAID", "OVERDUE", "CANCELLED"];
const HACIENDA_STATUS_OPTIONS = ["ALL", "DRAFT", "PENDING_SUBMISSION", "SUBMITTED", "RECIBIDO", "PROCESANDO", "ACEPTADO", "RECHAZADO", "ERROR"];
const DOCUMENT_TYPES = ["FACTURA_ELECTRONICA", "TIQUETE_ELECTRONICO", "NOTA_CREDITO", "NOTA_DEBITO", "MENSAJE_RECEPTOR"];
const ISSUANCE_MODES = ["MANUAL_ONLY", "HACIENDA"];

const HACIENDA_GUIDE = [
  {
    title: "Modo",
    meaning: "Define si la factura será solo comercial o si también debe convertirse en comprobante electrónico oficial ante Hacienda.",
    example: "`MANUAL_ONLY`: cobro interno sin envío oficial. `HACIENDA`: genera XML, firma, envío y seguimiento.",
  },
  {
    title: "Documento",
    meaning: "Es el tipo de comprobante fiscal que vas a emitir.",
    example: "`FACTURA_ELECTRONICA` para ventas normales, `TIQUETE_ELECTRONICO` para venta simplificada, `NOTA_CREDITO` para rebajos o anulaciones parciales.",
  },
  {
    title: "Condición de venta",
    meaning: "Describe cómo se pactó el pago de la operación.",
    example: "`01` contado, `02` crédito. Si la venta se paga después, normalmente corresponde crédito.",
  },
  {
    title: "Medio de pago",
    meaning: "Indica cómo el cliente pagó o pagará la operación.",
    example: "`01` efectivo, `02` tarjeta, `03` transferencia, según el catálogo tributario aplicable.",
  },
  {
    title: "Actividad",
    meaning: "Código de actividad económica del emisor que respalda esa venta.",
    example: "Si la empresa tiene varias actividades registradas, aquí se indica cuál aplica para esta factura.",
  },
  {
    title: "CABYS",
    meaning: "Código del catálogo CABYS para el producto o servicio facturado. Hacienda lo usa para clasificar lo vendido.",
    example: "Un servicio profesional y un producto físico usan códigos distintos; no conviene inventarlo, hay que buscar el correcto.",
  },
  {
    title: "Impuesto %",
    meaning: "Porcentaje del impuesto aplicado a la línea.",
    example: "`13` para IVA general, `0` si el concepto no lleva impuesto o está exento según corresponda.",
  },
  {
    title: "Clave y consecutivo",
    meaning: "Identificadores oficiales del comprobante. El sistema los genera y luego se usan para consultar estado, notas y mensajes del receptor.",
    example: "Después del envío a Hacienda, la clave identifica de forma única el comprobante aceptado o rechazado.",
  },
];

function FieldHelp({
  title,
  meaning,
  example,
}: {
  title: string;
  meaning: string;
  example: string;
}) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="inline-flex h-4 w-4 items-center justify-center rounded-full text-muted-foreground transition-colors hover:text-foreground"
          aria-label={`Ayuda sobre ${title}`}
        >
          <HelpCircle className="h-3.5 w-3.5" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-80 border-border bg-card p-3">
        <div className="space-y-2">
          <div className="text-sm font-medium text-foreground">{title}</div>
          <p className="text-xs leading-5 text-muted-foreground">{meaning}</p>
          <div className="rounded-md border border-border bg-background px-2.5 py-2 text-xs leading-5 text-foreground">
            {example}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}

function formatMoney(amount: unknown, currency = "USD") {
  const value = Number(amount ?? 0);
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

function getErrorMessage(err: any) {
  return err?.message ?? "Ocurrió un error inesperado";
}

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
        ...invoiceFields
      } = createForm;

      return api.createInvoice({
        ...invoiceFields,
        amount: Number(createForm.amount),
        issue_date: createForm.issue_date,
        lines: createForm.issuance_mode === "HACIENDA"
          ? [{
              description: line_description || createForm.description || `Factura ${createForm.number}`,
              quantity: 1,
              unit_price: Number(createForm.amount),
              cabys_code: cabys_code || undefined,
              unit_of_measure: "Unid",
              tax_code: "01",
              tax_rate: Number(tax_rate || 0),
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
      });
      toast({ title: "Factura creada" });
    },
    onError: (err: any) => {
      toast({ title: "Error", description: getErrorMessage(err), variant: "destructive" });
    },
  });

  const detectMutation = useMutation({
    mutationFn: api.detectOverdueInvoices,
    onSuccess: (result: any) => {
      const rows = Array.isArray(result) ? result : result?.data ?? [];
      setHighlightedIds(rows.map((invoice: any) => invoice.id));
      invalidateInvoices();
      toast({ title: "Deudas detectadas", description: `${rows.length} factura(s) vencida(s)` });
    },
    onError: (err: any) => {
      toast({ title: "Error", description: getErrorMessage(err), variant: "destructive" });
    },
  });

  const markPaidMutation = useMutation({
    mutationFn: (id: string) => api.markInvoicePaid(id),
    onSuccess: () => {
      invalidateInvoices();
      toast({ title: "Factura saldada" });
    },
    onError: (err: any) => toast({ title: "Error", description: getErrorMessage(err), variant: "destructive" }),
  });

  const registerPaymentMutation = useMutation({
    mutationFn: () =>
      api.registerInvoicePayment(selectedInvoice.id, {
        amount: Number(paymentForm.amount),
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
    onError: (err: any) => toast({ title: "Error", description: getErrorMessage(err), variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.deleteInvoice(id),
    onSuccess: () => {
      invalidateInvoices();
      toast({ title: "Factura eliminada" });
    },
    onError: (err: any) => toast({ title: "Error", description: getErrorMessage(err), variant: "destructive" }),
  });

  const cancelMutation = useMutation({
    mutationFn: (id: string) => api.updateInvoice(id, { status: "CANCELLED" }),
    onSuccess: () => {
      invalidateInvoices();
      toast({ title: "Factura cancelada" });
    },
    onError: (err: any) => toast({ title: "Error al cancelar", description: getErrorMessage(err), variant: "destructive" }),
  });

  const creditNoteMutation = useMutation({
    mutationFn: (invoice: any) => api.createCreditNote(invoice.id, {
      number: `NC-${invoice.number}`,
      amount: Number(invoice.amount),
      currency: invoice.currency,
      due_date: new Date().toISOString().slice(0, 10),
    }),
    onSuccess: () => {
      invalidateInvoices();
      toast({ title: "Nota de crédito creada. Revisa y envía a Hacienda." });
    },
    onError: (err: any) => toast({ title: "Error", description: getErrorMessage(err), variant: "destructive" }),
  });

  const submitHaciendaMutation = useMutation({
    mutationFn: (id: string) => api.submitInvoiceToHacienda(id),
    onSuccess: () => {
      invalidateInvoices();
      toast({ title: "Comprobante enviado a Hacienda" });
    },
    onError: (err: any) => toast({ title: "Error Hacienda", description: getErrorMessage(err), variant: "destructive" }),
  });

  const syncHaciendaMutation = useMutation({
    mutationFn: (id: string) => api.syncInvoiceHaciendaStatus(id),
    onSuccess: () => {
      invalidateInvoices();
      toast({ title: "Estado Hacienda actualizado" });
    },
    onError: (err: any) => toast({ title: "Error Hacienda", description: getErrorMessage(err), variant: "destructive" }),
  });

  const generateReminderMutation = useMutation({
    mutationFn: (invoice: any) => api.generateInvoiceReminder(invoice.id),
    onSuccess: (reminder: any, invoice: any) => {
      setSelectedInvoice(invoice);
      setReminderDraft(reminder?.draft_text ?? "");
    },
    onError: (err: any) => {
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
    onError: (err: any) => {
      toast({ title: "Error al enviar", description: getErrorMessage(err), variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: () =>
      api.updateInvoice(selectedInvoice.id, {
        number: editForm.number,
        amount: Number(editForm.amount),
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
    onError: (err: any) => toast({ title: "Error", description: getErrorMessage(err), variant: "destructive" }),
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
          size="sm"
          className="h-8 text-xs"
          onClick={() => setShowCreate(true)}
        >
          <Plus className="w-3.5 h-3.5 mr-1.5" /> Nueva factura
        </Button>
      </PageHeader>

      <div className="px-6 py-6 space-y-4">
        {(totalOverdue > 0 || overdueAmount > 0) && (
          <div className="flex items-center justify-between rounded-lg border border-amber-500/20 bg-amber-500/10 px-4 py-3">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-400" />
              <div>
                <div className="text-sm font-medium text-foreground">
                  {totalOverdue} factura{totalOverdue === 1 ? "" : "s"} vencida{totalOverdue === 1 ? "" : "s"}
                </div>
                <div className="text-xs text-muted-foreground">
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
              <p className="text-xs leading-5 text-muted-foreground">
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
                <p className="text-xs leading-5 text-muted-foreground">
                  Antes de usar <span className="font-medium text-foreground">Enviar MH</span>, completa en Configuración estos datos:
                  {" "}{haciendaReadinessIssues.join(", ")}.
                </p>
              </div>
            </div>
          </div>
        )}

        <div className="flex items-center gap-2 flex-wrap">
          <div className="relative flex-1 min-w-[200px] max-w-[320px]">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
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
          <div className="rounded-lg border border-border overflow-hidden bg-card">
            <Table>
              <TableHeader>
                <TableRow className="border-border hover:bg-transparent">
                  <TableHead className="text-[11px] text-muted-foreground font-medium"># Factura</TableHead>
                  <TableHead className="text-[11px] text-muted-foreground font-medium">Contacto</TableHead>
                  <TableHead className="text-[11px] text-muted-foreground font-medium">Total</TableHead>
                  <TableHead className="text-[11px] text-muted-foreground font-medium">Pagado</TableHead>
                  <TableHead className="text-[11px] text-muted-foreground font-medium">Saldo</TableHead>
                  <TableHead className="text-[11px] text-muted-foreground font-medium">Vencimiento</TableHead>
                  <TableHead className="text-[11px] text-muted-foreground font-medium">Cobro / Hacienda</TableHead>
                  <TableHead className="text-[11px] text-muted-foreground font-medium text-right">Acciones</TableHead>
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
                        "border-border hover:bg-white/[0.02]",
                        (invoice.status === "OVERDUE" || highlightedIds.includes(invoice.id)) && "bg-amber-500/5",
                      )}
                    >
                      <TableCell className="text-sm font-medium text-foreground">{invoice.number}</TableCell>
                      <TableCell>
                        <div className="text-sm text-foreground">{invoice.contact?.full_name ?? "—"}</div>
                        <div className="text-[11px] text-muted-foreground">{invoice.contact?.email || invoice.contact?.phone || "Sin dato de contacto"}</div>
                        {invoice.conversation?.subject && (
                          <div className="text-[11px] text-muted-foreground truncate">{invoice.conversation.subject}</div>
                        )}
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
                      <TableCell className="text-xs text-muted-foreground">
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
                                : <Sparkles className="w-3.5 h-3.5 mr-1.5" />}
                              Redactar IA
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

      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="bg-card border-border sm:max-w-[460px]">
          <DialogHeader>
            <DialogTitle className="text-sm">Nueva factura</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <div className="flex items-center gap-1">
                  <Label className="text-xs text-muted-foreground">Modo</Label>
                  <FieldHelp
                    title="Modo"
                    meaning="Permite decidir si esta factura queda solo para cobranza interna o si además se emite oficialmente ante Hacienda."
                    example="Usa `MANUAL_ONLY` para control comercial y `HACIENDA` cuando debe ser comprobante electrónico oficial."
                  />
                </div>
                <Select value={createForm.issuance_mode} onValueChange={(value) => setCreateForm((prev) => ({ ...prev, issuance_mode: value }))}>
                  <SelectTrigger className="h-8 text-xs bg-background border-border">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ISSUANCE_MODES.map((mode) => (
                      <SelectItem key={mode} value={mode}>{mode}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <div className="flex items-center gap-1">
                  <Label className="text-xs text-muted-foreground">Documento</Label>
                  <FieldHelp
                    title="Documento"
                    meaning="Tipo de comprobante fiscal que se emitirá."
                    example="`FACTURA_ELECTRONICA` para la mayoría de ventas. `NOTA_CREDITO` si debes disminuir o corregir una factura emitida."
                  />
                </div>
                <Select value={createForm.document_type} onValueChange={(value) => setCreateForm((prev) => ({ ...prev, document_type: value }))}>
                  <SelectTrigger className="h-8 text-xs bg-background border-border">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {DOCUMENT_TYPES.map((type) => (
                      <SelectItem key={type} value={type}>{type}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1">
              <div className="flex items-center gap-1">
                <Label className="text-xs text-muted-foreground">Contacto</Label>
                <FieldHelp
                  title="Contacto"
                  meaning="Es la persona o empresa a la que se le emite la factura. Para Hacienda, este registro debe tener datos fiscales correctos."
                  example="Idealmente el contacto debe incluir identificación, correo tributario y dirección si vas a emitir comprobante electrónico."
                />
              </div>
              <select
                value={createForm.contact_id}
                onChange={(e) => setCreateForm((prev) => ({ ...prev, contact_id: e.target.value }))}
                className="flex h-8 w-full rounded-md border border-border bg-background px-3 py-2 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                disabled={isContactsLoading}
              >
                <option value="">
                  {isContactsLoading
                    ? "Cargando contactos..."
                    : hasContactsError
                      ? "No se pudieron cargar los contactos"
                    : contacts.length
                      ? "Selecciona un contacto"
                      : "No hay contactos disponibles"}
                </option>
                {contacts.map((contact: any) => (
                  <option key={contact.id} value={contact.id}>
                    {contact.full_name}
                    {contact.company_name ? ` · ${contact.company_name}` : ""}
                  </option>
                ))}
              </select>
              {hasContactsError && (
                <p className="text-[11px] text-destructive">
                  No pudimos cargar los contactos. Cierra y vuelve a abrir el formulario.
                </p>
              )}
              {!isContactsLoading && !contacts.length && !hasContactsError && (
                <p className="text-[11px] text-muted-foreground">
                  No hay contactos creados todavía. Puedes agregarlos desde Contactos o vinculando uno desde el inbox.
                </p>
              )}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <div className="flex items-center gap-1">
                  <Label className="text-xs text-muted-foreground">Número</Label>
                  <FieldHelp
                    title="Número"
                    meaning="Identificador comercial visible de la factura dentro del sistema."
                    example="Ejemplo: `FAC-00125`. En Hacienda, además existirán clave y consecutivo oficiales."
                  />
                </div>
                <Input
                  value={createForm.number}
                  onChange={(e) => setCreateForm((prev) => ({ ...prev, number: e.target.value }))}
                  className="h-8 text-xs bg-background border-border"
                  placeholder="FAC-001"
                />
              </div>
              <div className="space-y-1">
                <div className="flex items-center gap-1">
                  <Label className="text-xs text-muted-foreground">Moneda</Label>
                  <FieldHelp
                    title="Moneda"
                    meaning="Moneda en la que se emite la operación."
                    example="`CRC` para colones o `USD` para dólares. Si no es CRC, Hacienda requiere tipo de cambio correcto."
                  />
                </div>
                <Input
                  value={createForm.currency}
                  onChange={(e) => setCreateForm((prev) => ({ ...prev, currency: e.target.value.toUpperCase() }))}
                  className="h-8 text-xs bg-background border-border"
                  placeholder="USD"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <div className="flex items-center gap-1">
                  <Label className="text-xs text-muted-foreground">Monto total</Label>
                  <FieldHelp
                    title="Monto total"
                    meaning="Total comercial de la factura. En modo Hacienda se usa para construir la línea y el cálculo fiscal."
                    example="Si vendes un servicio por 10,000 CRC con IVA 13%, la línea debe reflejar base e impuesto de forma consistente."
                  />
                </div>
                <Input
                  type="number"
                  step="0.01"
                  value={createForm.amount}
                  onChange={(e) => setCreateForm((prev) => ({ ...prev, amount: e.target.value }))}
                  className="h-8 text-xs bg-background border-border"
                />
              </div>
              <div className="space-y-1">
                <div className="flex items-center gap-1">
                  <Label className="text-xs text-muted-foreground">Vencimiento</Label>
                  <FieldHelp
                    title="Vencimiento"
                    meaning="Fecha límite de pago para cobranza interna."
                    example="Si vendes a 30 días, la fecha de vencimiento suele ser 30 días después de la emisión."
                  />
                </div>
                <Input
                  type="date"
                  value={createForm.due_date}
                  onChange={(e) => setCreateForm((prev) => ({ ...prev, due_date: e.target.value }))}
                  className="h-8 text-xs bg-background border-border"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <div className="flex items-center gap-1">
                  <Label className="text-xs text-muted-foreground">Fecha emisión</Label>
                  <FieldHelp
                    title="Fecha de emisión"
                    meaning="Fecha oficial del comprobante."
                    example="Normalmente coincide con el día en que se realiza la venta o se genera la factura."
                  />
                </div>
                <Input
                  type="date"
                  value={createForm.issue_date}
                  onChange={(e) => setCreateForm((prev) => ({ ...prev, issue_date: e.target.value }))}
                  className="h-8 text-xs bg-background border-border"
                />
              </div>
              {createForm.issuance_mode === "HACIENDA" && (
                <div className="space-y-1">
                  <div className="flex items-center gap-1">
                    <Label className="text-xs text-muted-foreground">Actividad</Label>
                    <FieldHelp
                      title="Actividad"
                      meaning="Código de actividad económica del emisor ante Hacienda."
                      example="Si la empresa vende servicios de software y también equipo, debe elegir la actividad correcta para esa factura."
                    />
                  </div>
                  <Input
                    value={createForm.activity_code}
                    onChange={(e) => setCreateForm((prev) => ({ ...prev, activity_code: e.target.value }))}
                    className="h-8 text-xs bg-background border-border"
                    placeholder="Código actividad"
                  />
                </div>
              )}
            </div>
            {createForm.issuance_mode === "HACIENDA" && (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <div className="flex items-center gap-1">
                      <Label className="text-xs text-muted-foreground">Condición venta</Label>
                      <FieldHelp
                        title="Condición de venta"
                        meaning="Indica si la venta es de contado, crédito u otra modalidad tributaria."
                        example="`01` contado si se paga al momento, `02` crédito si se paga después."
                      />
                    </div>
                    <Input
                      value={createForm.sale_condition}
                      onChange={(e) => setCreateForm((prev) => ({ ...prev, sale_condition: e.target.value }))}
                      className="h-8 text-xs bg-background border-border"
                      placeholder="01"
                    />
                  </div>
                  <div className="space-y-1">
                    <div className="flex items-center gap-1">
                      <Label className="text-xs text-muted-foreground">Medio pago</Label>
                      <FieldHelp
                        title="Medio de pago"
                        meaning="Forma en que se realiza el pago de la operación."
                        example="`01` efectivo, `02` tarjeta, `03` transferencia. Debe corresponder al catálogo tributario que maneje el sistema."
                      />
                    </div>
                    <Input
                      value={createForm.payment_method}
                      onChange={(e) => setCreateForm((prev) => ({ ...prev, payment_method: e.target.value }))}
                      className="h-8 text-xs bg-background border-border"
                      placeholder="01"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div className="space-y-1 col-span-2">
                    <div className="flex items-center gap-1">
                      <Label className="text-xs text-muted-foreground">Detalle línea</Label>
                      <FieldHelp
                        title="Detalle de línea"
                        meaning="Descripción fiscal del producto o servicio."
                        example="Ejemplo bueno: `Servicio mensual de soporte técnico abril 2026`. Evita descripciones genéricas como `Varios`."
                      />
                    </div>
                    <Input
                      value={createForm.line_description}
                      onChange={(e) => setCreateForm((prev) => ({ ...prev, line_description: e.target.value }))}
                      className="h-8 text-xs bg-background border-border"
                      placeholder="Descripción fiscal"
                    />
                  </div>
                  <div className="space-y-1">
                    <div className="flex items-center gap-1">
                      <Label className="text-xs text-muted-foreground">Impuesto %</Label>
                      <FieldHelp
                        title="Impuesto %"
                        meaning="Porcentaje del impuesto aplicado a la línea."
                        example="Usa `13` si aplica IVA general. Usa `0` solo si realmente no corresponde impuesto o hay exención válida."
                      />
                    </div>
                    <Input
                      type="number"
                      step="0.01"
                      value={createForm.tax_rate}
                      onChange={(e) => setCreateForm((prev) => ({ ...prev, tax_rate: e.target.value }))}
                      className="h-8 text-xs bg-background border-border"
                    />
                  </div>
                </div>
                <div className="space-y-1">
                  <div className="flex items-center gap-1">
                    <Label className="text-xs text-muted-foreground">CABYS</Label>
                    <FieldHelp
                      title="CABYS"
                      meaning="Código oficial que clasifica el bien o servicio facturado."
                      example="Cada producto o servicio tiene un código distinto. Es mejor buscarlo antes de emitir que usar uno aproximado."
                    />
                  </div>
                  <Input
                    value={createForm.cabys_code}
                    onChange={(e) => setCreateForm((prev) => ({ ...prev, cabys_code: e.target.value }))}
                    className="h-8 text-xs bg-background border-border"
                    placeholder="Código CABYS"
                  />
                </div>
              </>
            )}
            <div className="space-y-1">
              <div className="flex items-center gap-1">
                <Label className="text-xs text-muted-foreground">Descripción</Label>
                <FieldHelp
                  title="Descripción"
                  meaning="Texto comercial o interno de apoyo para entender la factura."
                  example="Puedes anotar contexto como período facturado, proyecto o condiciones comerciales."
                />
              </div>
              <Textarea
                value={createForm.description}
                onChange={(e) => setCreateForm((prev) => ({ ...prev, description: e.target.value }))}
                className="min-h-[90px] text-xs bg-background border-border"
                placeholder="Detalles opcionales de la factura"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" className="h-8 text-xs" onClick={() => setShowCreate(false)}>
              Cancelar
            </Button>
            <Button
              size="sm"
              className="h-8 text-xs"
              onClick={() => createMutation.mutate()}
              disabled={
                createMutation.isPending ||
                !createForm.contact_id ||
                !createForm.number.trim() ||
                !createForm.amount ||
                !createForm.due_date
              }
            >
              {createMutation.isPending && <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />}
              Crear factura
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showDetail} onOpenChange={(open) => { setShowDetail(open); if (!open) setSelectedInvoice(null); }}>
        <DialogContent className="bg-card border-border sm:max-w-[480px]">
          <DialogHeader>
            <DialogTitle className="text-sm">Detalle de factura</DialogTitle>
          </DialogHeader>
          {selectedInvoice && (
            <div className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div><span className="text-muted-foreground">Número</span><div className="text-foreground font-medium mt-0.5">{selectedInvoice.number}</div></div>
                <div><span className="text-muted-foreground">Estado</span><div className="mt-0.5"><StatusBadge status={selectedInvoice.status} type="invoice" /></div></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><span className="text-muted-foreground">Contacto</span><div className="text-foreground mt-0.5">{selectedInvoice.contact?.full_name ?? "—"}</div></div>
                <div><span className="text-muted-foreground">Empresa</span><div className="text-foreground mt-0.5">{selectedInvoice.contact?.company_name ?? "—"}</div></div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div><span className="text-muted-foreground">Total</span><div className="text-foreground font-medium mt-0.5">{formatMoney(selectedInvoice.amount, selectedInvoice.currency)}</div></div>
                <div><span className="text-muted-foreground">Pagado</span><div className="text-green-400 font-medium mt-0.5">{formatMoney(selectedInvoice.amount_paid, selectedInvoice.currency)}</div></div>
                <div><span className="text-muted-foreground">Saldo</span><div className="text-foreground font-medium mt-0.5">{formatMoney(selectedInvoice.balance_due, selectedInvoice.currency)}</div></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><span className="text-muted-foreground">Emisión</span><div className="text-foreground mt-0.5">{selectedInvoice.issue_date ? format(new Date(selectedInvoice.issue_date), "d MMM yyyy", { locale: es }) : "—"}</div></div>
                <div><span className="text-muted-foreground">Vencimiento</span><div className="text-foreground mt-0.5">{selectedInvoice.due_date ? format(new Date(selectedInvoice.due_date), "d MMM yyyy", { locale: es }) : "—"}</div></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><span className="text-muted-foreground">Modo</span><div className="text-foreground mt-0.5">{selectedInvoice.issuance_mode}</div></div>
                <div><span className="text-muted-foreground">Hacienda</span><div className="mt-0.5"><StatusBadge status={selectedInvoice.hacienda_status} type="invoice" /></div></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><span className="text-muted-foreground">Moneda</span><div className="text-foreground mt-0.5">{selectedInvoice.currency}</div></div>
                <div><span className="text-muted-foreground">Tipo documento</span><div className="text-foreground mt-0.5">{selectedInvoice.document_type}</div></div>
              </div>
              {selectedInvoice.description && (
                <div><span className="text-muted-foreground">Descripción</span><div className="text-foreground mt-0.5 whitespace-pre-wrap">{selectedInvoice.description}</div></div>
              )}
              {selectedInvoice.payments?.length > 0 && (
                <div>
                  <span className="text-muted-foreground">Pagos registrados</span>
                  <div className="mt-1 space-y-1">
                    {selectedInvoice.payments.map((p: any) => (
                      <div key={p.id} className="flex justify-between rounded border border-border bg-background px-2 py-1">
                        <span className="text-foreground">{formatMoney(p.amount, selectedInvoice.currency)}</span>
                        <span className="text-muted-foreground">{p.paid_at ? format(new Date(p.paid_at), "d MMM yyyy", { locale: es }) : "—"}</span>
                        <span className="text-muted-foreground">{p.method ?? "—"}</span>
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
                <Label className="text-xs text-muted-foreground">Modo</Label>
                <Select value={editForm.issuance_mode} onValueChange={(v) => setEditForm(f => ({ ...f, issuance_mode: v }))}>
                  <SelectTrigger className="h-8 text-xs bg-background border-border"><SelectValue /></SelectTrigger>
                  <SelectContent>{ISSUANCE_MODES.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Documento</Label>
                <Select value={editForm.document_type} onValueChange={(v) => setEditForm(f => ({ ...f, document_type: v }))}>
                  <SelectTrigger className="h-8 text-xs bg-background border-border"><SelectValue /></SelectTrigger>
                  <SelectContent>{DOCUMENT_TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Contacto</Label>
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
                <Label className="text-xs text-muted-foreground">Número</Label>
                <Input value={editForm.number} onChange={(e) => setEditForm(f => ({ ...f, number: e.target.value }))} className="h-8 text-xs bg-background border-border" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Moneda</Label>
                <Input value={editForm.currency} onChange={(e) => setEditForm(f => ({ ...f, currency: e.target.value.toUpperCase() }))} className="h-8 text-xs bg-background border-border" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Monto total</Label>
                <Input type="number" step="0.01" value={editForm.amount} onChange={(e) => setEditForm(f => ({ ...f, amount: e.target.value }))} className="h-8 text-xs bg-background border-border" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Vencimiento</Label>
                <Input type="date" value={editForm.due_date} onChange={(e) => setEditForm(f => ({ ...f, due_date: e.target.value }))} className="h-8 text-xs bg-background border-border" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Fecha emisión</Label>
                <Input type="date" value={editForm.issue_date} onChange={(e) => setEditForm(f => ({ ...f, issue_date: e.target.value }))} className="h-8 text-xs bg-background border-border" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Actividad</Label>
                <Input value={editForm.activity_code} onChange={(e) => setEditForm(f => ({ ...f, activity_code: e.target.value }))} className="h-8 text-xs bg-background border-border" placeholder="Código" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Condición venta</Label>
                <Input value={editForm.sale_condition} onChange={(e) => setEditForm(f => ({ ...f, sale_condition: e.target.value }))} className="h-8 text-xs bg-background border-border" placeholder="01" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Medio pago</Label>
                <Input value={editForm.payment_method} onChange={(e) => setEditForm(f => ({ ...f, payment_method: e.target.value }))} className="h-8 text-xs bg-background border-border" placeholder="01" />
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Descripción</Label>
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
              <p className="mt-1 text-xs leading-5 text-muted-foreground">
                No basta con monto y cliente. Para que el sistema sea sólido se necesitan datos correctos del emisor,
                datos fiscales del receptor, líneas con CABYS e impuesto, catálogos tributarios, XML, firma, token,
                envío, callback o consulta de estado, y trazabilidad de aceptación o rechazo.
              </p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              {HACIENDA_GUIDE.map((item) => (
                <div key={item.title} className="rounded-lg border border-border bg-background px-4 py-3">
                  <div className="text-sm font-medium text-foreground">{item.title}</div>
                  <p className="mt-1 text-xs leading-5 text-muted-foreground">{item.meaning}</p>
                  <div className="mt-2 rounded-md border border-border bg-card px-2.5 py-2 text-xs leading-5 text-foreground">
                    {item.example}
                  </div>
                </div>
              ))}
            </div>
            <div className="rounded-lg border border-amber-500/20 bg-amber-500/10 px-4 py-3">
              <div className="text-sm font-medium text-foreground">Pendiente importante</div>
              <p className="mt-1 text-xs leading-5 text-muted-foreground">
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
                <div className="text-xs text-muted-foreground">
                  {selectedInvoice.number} · {selectedInvoice.contact?.full_name}
                </div>
                <div className="grid grid-cols-3 gap-3 text-xs">
                  <div>
                    <div className="text-muted-foreground">Total</div>
                    <div className="text-foreground">{formatMoney(selectedInvoice.amount, selectedInvoice.currency)}</div>
                  </div>
                  <div>
                    <div className="text-muted-foreground">Pagado</div>
                    <div className="text-foreground">{formatMoney(selectedInvoice.amount_paid, selectedInvoice.currency)}</div>
                  </div>
                  <div>
                    <div className="text-muted-foreground">Saldo</div>
                    <div className="text-foreground">{formatMoney(selectedInvoice.balance_due, selectedInvoice.currency)}</div>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Monto abonado</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={paymentForm.amount}
                    onChange={(e) => setPaymentForm((prev) => ({ ...prev, amount: e.target.value }))}
                    className="h-8 text-xs bg-background border-border"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Fecha de pago</Label>
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
                  <Label className="text-xs text-muted-foreground">Método</Label>
                  <Input
                    value={paymentForm.method}
                    onChange={(e) => setPaymentForm((prev) => ({ ...prev, method: e.target.value }))}
                    className="h-8 text-xs bg-background border-border"
                    placeholder="Pago móvil, transferencia..."
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Referencia</Label>
                  <Input
                    value={paymentForm.reference}
                    onChange={(e) => setPaymentForm((prev) => ({ ...prev, reference: e.target.value }))}
                    className="h-8 text-xs bg-background border-border"
                    placeholder="Comprobante"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Notas</Label>
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
            <div className="py-6 flex items-center justify-center text-sm text-muted-foreground">
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Cargando borrador...
            </div>
          ) : (
            <div className="space-y-3">
              <div className="rounded-md border border-border bg-background px-3 py-2">
                <div className="text-xs text-muted-foreground">
                  {selectedInvoice.number} · {selectedInvoice.contact?.full_name}
                </div>
                <div className="text-sm text-foreground mt-1">
                  {formatMoney(selectedInvoice.balance_due, selectedInvoice.currency)} pendientes
                </div>
              </div>

              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Borrador</Label>
                <Textarea
                  value={reminderDraft}
                  onChange={(e) => setReminderDraft(e.target.value)}
                  className="min-h-[160px] text-sm bg-background border-border"
                  placeholder="El borrador generado aparecerá aquí"
                />
              </div>

              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Canal</Label>
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
    </div>
  );
}
