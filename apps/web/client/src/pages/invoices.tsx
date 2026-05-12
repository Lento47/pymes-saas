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
  Loader2,
  Pencil,
  Plus,
  RefreshCw,
  Receipt,
  Search,
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
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn, formatMoney, getErrorMessage } from "@/lib/utils";
import { InvoiceSheet } from "@/components/invoices/InvoiceSheet";
import { STATUS_OPTIONS, HACIENDA_STATUS_OPTIONS } from "@/data/invoices.data";
import { InvoiceDetailDialog } from "@/components/invoices/InvoiceDetailDialog";
import { InvoiceEditDialog } from "@/components/invoices/InvoiceEditDialog";
import { InvoiceGuideDialog } from "@/components/invoices/InvoiceGuideDialog";
import { InvoicePaymentDialog } from "@/components/invoices/InvoicePaymentDialog";
import { InvoiceReminderDialog } from "@/components/invoices/InvoiceReminderDialog";

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
      amount: Math.round(Number(invoice.amount) * 100) / 100,
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

      <div className="px-4 md:px-6 py-4 space-y-4">
        {(totalOverdue > 0 || overdueAmount > 0) && (
          <div className="flex items-center justify-between rounded-lg border border-amber-500/20 bg-amber-500/10 px-4 py-3">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-400" />
              <div>
                <div className="text-sm font-medium text-foreground">
                  {totalOverdue} factura{totalOverdue === 1 ? "" : "s"} vencida{totalOverdue === 1 ? "" : "s"}
                </div>
                <div className="text-xs text-white/40">
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
              <p className="text-xs leading-5 text-white/40">
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
                <p className="text-xs leading-5 text-white/40">
                  Antes de usar <span className="font-medium text-foreground">Enviar MH</span>, completa en Configuración estos datos:
                  {" "}{haciendaReadinessIssues.join(", ")}.
                </p>
              </div>
            </div>
          </div>
        )}

        <div className="flex items-center gap-2 flex-wrap">
          <div className="relative flex-1 min-w-[200px] max-w-[320px]">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/40" />
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
                  <TableHead className="text-[11px] text-white/40 font-medium"># Factura</TableHead>
                  <TableHead className="text-[11px] text-white/40 font-medium">Contacto</TableHead>
                  <TableHead className="text-[11px] text-white/40 font-medium">Total</TableHead>
                  <TableHead className="text-[11px] text-white/40 font-medium">Pagado</TableHead>
                  <TableHead className="text-[11px] text-white/40 font-medium">Saldo</TableHead>
                  <TableHead className="text-[11px] text-white/40 font-medium">Vencimiento</TableHead>
                  <TableHead className="text-[11px] text-white/40 font-medium">Cobro / Hacienda</TableHead>
                  <TableHead className="text-[11px] text-white/40 font-medium text-right">Acciones</TableHead>
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
                        <div className="text-[11px] text-white/40">{invoice.contact?.email || invoice.contact?.phone || "Sin dato de contacto"}</div>
                        {invoice.conversation?.subject && (
                          <div className="text-[11px] text-white/40 truncate">{invoice.conversation.subject}</div>
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
                      <TableCell className="text-xs text-white/40">
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

      <InvoiceDetailDialog
        open={showDetail}
        onOpenChange={(open) => { setShowDetail(open); if (!open) setSelectedInvoice(null); }}
        invoice={selectedInvoice}
      />

      <InvoiceEditDialog
        open={showEdit}
        onOpenChange={(open) => { setShowEdit(open); if (!open) setSelectedInvoice(null); }}
        editForm={editForm}
        setEditForm={setEditForm}
        contacts={contacts}
        updateMutation={updateMutation}
      />

      <InvoiceGuideDialog open={showGuide} onOpenChange={setShowGuide} />

      <InvoicePaymentDialog
        open={showPayment}
        onOpenChange={(open) => {
          setShowPayment(open);
          if (!open) {
            setSelectedInvoice(null);
            setPaymentForm({ amount: "", paid_at: "", method: "", reference: "", notes: "" });
          }
        }}
        invoice={selectedInvoice}
        paymentForm={paymentForm}
        setPaymentForm={setPaymentForm}
        saveMutation={registerPaymentMutation}
      />

      <InvoiceReminderDialog
        open={showReminder}
        onOpenChange={(open) => {
          setShowReminder(open);
          if (!open) { setSelectedInvoice(null); setReminderDraft(""); }
        }}
        invoice={selectedInvoice}
        reminderDraft={reminderDraft}
        setReminderDraft={setReminderDraft}
        selectedChannelId={selectedChannelId}
        onChannelChange={setSelectedChannelId}
        availableChannels={availableChannels}
        isLoadingDraft={generateReminderMutation.isPending}
        sendMutation={sendReminderMutation}
      />
    </div>
  );
}
