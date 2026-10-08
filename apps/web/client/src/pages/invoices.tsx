import { useEffect, useRef, useState } from "react";
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
  MessageSquare,
  MoreHorizontal,
  Pencil,
  Plus,
  RefreshCw,
  Receipt,
  Search,
  Trash2,
  Upload,
  XCircle,
} from "lucide-react";
import { api } from "@/lib/api";
import { apiErrorDescription } from "@/lib/api-error";
import { queryClient } from "@/lib/queryClient";
import CsvImportModal from "@/components/import/csv-import-modal";
import { useAuth, useRequireAuth } from "@/hooks/use-auth";
import { useLocation, useSearch } from "wouter";
import { hasPermission, Permission } from "@/lib/permissions";
import { useToast } from "@/hooks/use-toast";
import { DiagnosticButton } from "@/components/shared/diagnostic-button";
import { EmptyState } from "@/components/shared/empty-state";
import { PageLoader } from "@/components/shared/loading-spinner";
import { StatusBadge } from "@/components/shared/status-badge";
import { HaciendaChecklist, type ChecklistItem } from "@/components/shared/hacienda-checklist";
import { InvoiceReminderSheet } from "@/components/invoices/InvoiceReminderSheet";
import { InvoiceSheet } from "@/components/invoices/InvoiceSheet";
import { InvoiceContactPicker } from "@/components/invoices/InvoiceContactPicker";
import { useIsMobile } from "@/hooks/use-mobile";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetFooter } from "@/components/ui/sheet";
import { InvoiceActionDialog, type InvoiceAction } from "@/components/invoices/InvoiceActionDialog";
import { FieldHelp } from "@/components/invoices/FieldHelp";
import { HACIENDA_GUIDE } from "@/data/hacienda-guide";
import { STATUS_OPTIONS, HACIENDA_STATUS_OPTIONS, DOCUMENT_TYPES, ISSUANCE_MODES } from "@/data/invoice-filters";
import { Button } from "@/components/arc/button/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
const collectionLabels: Record<string, string> = { DRAFT: "Borrador", SENT: "Enviada", PENDING_APPROVAL: "Pendiente de aprobación", PARTIALLY_PAID: "Abonada", PAID: "Pagada", OVERDUE: "Vencida", CANCELLED: "Cancelada" };

function formatMoney(amount: unknown, currency = "USD") {
  const value = Number(amount ?? 0);
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    currencyDisplay: "code",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

// Replaced by `apiErrorDescription` from "@/lib/api-error" so the toast can
// surface the auto-opened support ticket as a clickable link, not just text.
const getErrorMessage = (err: unknown) => apiErrorDescription(err, "Ocurrió un error inesperado");

export default function InvoicesPage() {
  useRequireAuth();
  const { user } = useAuth();
  if (!hasPermission(user?.role ?? "", Permission.INVOICES_MANAGE, !!user?.is_platform_admin)) {
    return <div className="p-6"><h1 className="text-2xl font-semibold">Facturas</h1><p className="mt-3">Tu rol no tiene acceso a facturación.</p></div>;
  }
  return <InvoiceWorkspace key={user!.workspace.id} />;
}

function InvoiceWorkspace() {
  const mobile = useIsMobile();
  const { user } = useAuth();
  const [, navigate] = useLocation();
  const params = new URLSearchParams(useSearch());
  const statusFilter = params.get("status") ?? "ALL";
  const fiscalFilter = params.get("hacienda_status") ?? "ALL";
  const contactFilter = params.get("contact_id") ?? "ALL";
  const query = params.get("q") ?? "";
  const requestedPage = Number(params.get("page"));
  const page = Number.isSafeInteger(requestedPage) && requestedPage > 0 ? requestedPage : 1;
  const returnFocus = useRef<HTMLElement | null>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const fiscalTitle = useRef<HTMLHeadingElement>(null);
  const [action, setAction] = useState<InvoiceAction | null>(null);
  const adminActions = ["OWNER", "ADMIN"].includes(user?.role ?? "");
  function filters(changes: Record<string, string>) {
    const next = new URLSearchParams(params);
    next.delete("page");
    for (const [key, value] of Object.entries(changes)) {
      if (value && value !== "ALL") next.set(key, value); else next.delete(key);
    }
    navigate("/invoices" + (next.size ? "?" + next.toString() : ""));
  }
  const { toast } = useToast();

  const [search, setSearch] = useState(query);
  useEffect(() => setSearch(query), [query]);
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

  const editBaseline = useRef<typeof editForm | null>(null);
  const editTitle = useRef<HTMLHeadingElement>(null);
  const keepEditing = useRef<HTMLButtonElement>(null);
  const [discardEdit, setDiscardEdit] = useState(false);
  const editDirty = showEdit && JSON.stringify(editBaseline.current) !== JSON.stringify(editForm);
  useEffect(() => {
    if (!editDirty) return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ""; };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [editDirty]);
  useEffect(() => {
    if (discardEdit) { keepEditing.current?.scrollIntoView({ block: "center", behavior: "instant" }); keepEditing.current?.focus(); }
  }, [discardEdit]);
  function closeEdit(open: boolean) {
    if (updateMutation.isPending) return;
    if (!open && editDirty) { setDiscardEdit(true); return; }
    setShowEdit(open);
    if (!open) setSelectedInvoice(null);
  }

  const invoiceParams: Record<string, string> = { page: String(page), limit: "20" };
  if (query) invoiceParams.q = query;
  if (statusFilter !== "ALL") invoiceParams.status = statusFilter;
  if (fiscalFilter !== "ALL") invoiceParams.hacienda_status = fiscalFilter;
  if (contactFilter !== "ALL") invoiceParams.contact_id = contactFilter;

  const { data, isLoading, isError, refetch, isFetching } = useQuery({
    queryKey: ["/api/invoices", user?.workspace.id, invoiceParams],
    queryFn: () => api.getInvoices(Object.keys(invoiceParams).length ? invoiceParams : undefined),
  });
  const { data: workspaceData } = useQuery({
    queryKey: ["/api/workspaces/current", user?.workspace.id, "invoice-hacienda-readiness"],
    queryFn: () => api.getWorkspace(),
  });

  const { data: contactsData } = useQuery({
    queryKey: ["/api/contacts", user?.workspace.id, "invoice-form"],
    enabled: hasPermission(user?.role ?? "", Permission.CONTACTS_READ, !!user?.is_platform_admin),
    queryFn: () => api.getContacts({ limit: "100" }),
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
  const filteredInvoices = invoices;
  const total = data?.meta?.total ?? invoices.length;
  const pages = data?.meta?.pages ?? 1;

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

  const registerPaymentMutation = useMutation({
    mutationFn: () =>
      api.registerInvoicePayment(selectedInvoice.id, {
        amount: Math.round(Number(paymentForm.amount) * 100) / 100,
        currency: selectedInvoice.currency,
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
  const [copyStatus, setCopyStatus] = useState("");
  const [xmlPreview, setXmlPreview] = useState<{ xml: string } | null>(null);
  const xmlPreviewMutation = useMutation({
    mutationFn: (id: string) => api.getInvoiceXmlPreview(id),
    onSuccess: (data) => {
      setCopyStatus("");
      setXmlPreview(data as { xml: string });
      setShowXmlPreview(true);
    },
    onError: (err) => toast({ title: "Error", description: getErrorMessage(err), variant: "destructive" }),
  });

  const updateMutation = useMutation({
    mutationFn: () => {
      const payload: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(editForm)) {
        if (value === editBaseline.current?.[key as keyof typeof editForm]) continue;
        payload[key] = key === "amount" ? Math.round(Number(value) * 100) / 100
          : ["issue_date", "sale_condition", "payment_method", "activity_code"].includes(key) ? value || null
          : key === "number" ? value.trim() : value;
      }
      return api.updateInvoice(selectedInvoice.id, payload);
    },
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
    updateMutation.reset();
    setDiscardEdit(false);
    const form = {
      number: invoice.number ?? "",
      amount: String(Number(invoice.amount ?? 0)),
      currency: invoice.currency ?? "CRC",
      due_date: invoice.due_date ? invoice.due_date.slice(0, 10) : "",
      issue_date: invoice.issue_date ? invoice.issue_date.slice(0, 10) : "",
      description: invoice.description ?? "",
      issuance_mode: invoice.issuance_mode ?? "MANUAL_ONLY",
      document_type: invoice.document_type ?? "FACTURA_ELECTRONICA",
      sale_condition: invoice.sale_condition ?? "",
      payment_method: invoice.payment_method ?? "",
      activity_code: invoice.activity_code ?? "",
      contact_id: invoice.contact_id ?? invoice.contact?.id ?? "",
    };
    editBaseline.current = form;
    setEditForm(form);
    setShowEdit(true);
  };

  const openReminderModal = (invoice: any) => {
    setSelectedInvoice(invoice);
    setShowReminder(true);
  };

  const openPaymentModal = (invoice: any) => {
    registerPaymentMutation.reset();
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

  const renderActions = (invoice: any) => (
    <div className="flex items-center justify-end gap-2">
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-11 text-sm"
                            onClick={(event) => { returnFocus.current = event.currentTarget; setSelectedInvoice(invoice); setShowDetail(true); }}
                          >
                            <Eye className="w-3.5 h-3.5 mr-1.5" />
                            Ver
                          </Button>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button size="sm" variant="ghost" className="h-11 w-11 p-0 text-muted-foreground" aria-label={`Acciones de ${invoice.number}`} onPointerDown={event => { returnFocus.current = event.currentTarget; }} onKeyDown={event => { returnFocus.current = event.currentTarget; }}>
                                <MoreHorizontal className="w-4 h-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="app-overlay invoice-menu w-64 max-h-[70dvh] overflow-y-auto [&_[role=menuitem]]:min-h-11">
                              {!["PAID", "CANCELLED"].includes(invoice.status) && !(invoice.issuance_mode === "HACIENDA" && ["PENDING_SUBMISSION", "SUBMITTED", "RECIBIDO", "PROCESANDO", "ACEPTADO"].includes(invoice.hacienda_status)) && (
                                <DropdownMenuItem onClick={() => openEditModal(invoice)}>
                                  <Pencil className="w-3.5 h-3.5 mr-2" />
                                  Editar
                                </DropdownMenuItem>
                              )}
                              {invoice.conversation_id && (
                                <DropdownMenuItem onClick={() => navigate(`/inbox/${invoice.conversation_id}`)}>
                                  <MessageSquare className="w-3.5 h-3.5 mr-2" />
                                  Ver conversación
                                </DropdownMenuItem>
                              )}

                              {adminActions && invoice.status === "PENDING_APPROVAL" && <DropdownMenuSeparator />}
                              {adminActions && invoice.status === "PENDING_APPROVAL" && (
                                <DropdownMenuItem onSelect={() => setAction({ kind: "approve", invoice })}>
                                  <CheckCircle2 className="w-3.5 h-3.5 mr-2" />
                                  Aprobar
                                </DropdownMenuItem>
                              )}
                              {adminActions && invoice.status === "PENDING_APPROVAL" && (
                                <DropdownMenuItem onSelect={() => setAction({ kind: "reject", invoice })} className="text-destructive focus:text-destructive">
                                  <XCircle className="w-3.5 h-3.5 mr-2" />
                                  Descartar
                                </DropdownMenuItem>
                              )}

                              {invoice.issuance_mode === "HACIENDA" && <DropdownMenuSeparator />}
                              {invoice.issuance_mode === "HACIENDA" && (
                                <DropdownMenuItem onSelect={() => setAction({ kind: "submit", invoice })} disabled={ !isHaciendaWorkspaceReady || ["SUBMITTED", "RECIBIDO", "PROCESANDO", "ACEPTADO"].includes(invoice.hacienda_status)}>
                                  <FileUp className="w-3.5 h-3.5 mr-2" />
                                  Enviar MH
                                </DropdownMenuItem>
                              )}
                              {invoice.issuance_mode === "HACIENDA" && invoice.clave && (
                                <DropdownMenuItem onClick={() => syncHaciendaMutation.mutate(invoice.id)} disabled={syncHaciendaMutation.isPending}>
                                  <RefreshCw className="w-3.5 h-3.5 mr-2" />
                                  Estado MH
                                </DropdownMenuItem>
                              )}
                              {invoice.issuance_mode === "HACIENDA" && (
                                <DropdownMenuItem onClick={() => validateHaciendaMutation.mutate(invoice.id)} disabled={validateHaciendaMutation.isPending}>
                                  <CheckCircle2 className="w-3.5 h-3.5 mr-2" />
                                  Validar MH
                                </DropdownMenuItem>
                              )}
                              {invoice.hacienda_status === "RECHAZADO" && invoice.hacienda_last_error && (
                                <DropdownMenuItem onClick={() => explainErrorMutation.mutate(invoice.id)} disabled={explainErrorMutation.isPending}>
                                  <Info className="w-3.5 h-3.5 mr-2" />
                                  Error MH
                                </DropdownMenuItem>
                              )}
                              {invoice.issuance_mode === "HACIENDA" && (
                                <DropdownMenuItem onClick={() => xmlPreviewMutation.mutate(invoice.id)} disabled={xmlPreviewMutation.isPending}>
                                  <Code2 className="w-3.5 h-3.5 mr-2" />
                                  XML
                                </DropdownMenuItem>
                              )}

                              {![ "PAID", "CANCELLED"].includes(invoice.status) && <DropdownMenuSeparator />}
                              {adminActions && invoice.status === "OVERDUE" && (
                                <DropdownMenuItem onClick={() => openReminderModal(invoice)}>
                                  <Pencil className="w-3.5 h-3.5 mr-2" />
                                  Redactar cobro
                                </DropdownMenuItem>
                              )}
                              {![ "PAID", "CANCELLED"].includes(invoice.status) && (
                                <DropdownMenuItem onClick={() => openPaymentModal(invoice)}>
                                  <Coins className="w-3.5 h-3.5 mr-2" />
                                  Registrar pago
                                </DropdownMenuItem>
                              )}
                              {![ "PAID", "CANCELLED"].includes(invoice.status) && (
                                <DropdownMenuItem onClick={() => openPaymentModal(invoice)}>
                                  <CheckCircle2 className="w-3.5 h-3.5 mr-2" />
                                  Saldar
                                </DropdownMenuItem>
                              )}

                              <DropdownMenuSeparator />
                              {!["PAID", "CANCELLED", "PENDING_APPROVAL"].includes(invoice.status) && !(invoice.issuance_mode === "HACIENDA" && ["PENDING_SUBMISSION", "SUBMITTED", "RECIBIDO", "PROCESANDO", "ACEPTADO"].includes(invoice.hacienda_status)) && (
                                <DropdownMenuItem onSelect={() => setAction({ kind: "cancel", invoice })} className="text-destructive focus:text-destructive"><XCircle className="mr-2 h-4 w-4" />Cancelar factura</DropdownMenuItem>
                              )}
                              {invoice.issuance_mode === "HACIENDA" && invoice.hacienda_status === "ACEPTADO" && (
                                <DropdownMenuItem onSelect={() => setAction({ kind: "credit", invoice })}><Receipt className="mr-2 h-4 w-4" />Nota de crédito</DropdownMenuItem>
                              )}
                              {!(invoice.issuance_mode === "HACIENDA" && ["PENDING_SUBMISSION", "SUBMITTED", "RECIBIDO", "PROCESANDO", "ACEPTADO"].includes(invoice.hacienda_status)) && (
                                <DropdownMenuItem onSelect={() => setAction({ kind: "delete", invoice })} className="text-destructive focus:text-destructive"><Trash2 className="mr-2 h-4 w-4" />Eliminar</DropdownMenuItem>
                              )}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
  );

  return (
    <div className="invoice-page mx-auto max-w-7xl px-4 py-5 md:px-6">
      <header className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <h1 ref={headingRef} tabIndex={-1} className="text-2xl font-semibold tracking-tight">Facturas</h1>
        <Button aria-label="Nueva factura" className="h-12 rounded-xl" onClick={event => { returnFocus.current = event.currentTarget; createMutation.reset(); setShowCreate(true); }}><Plus className="mr-2 h-5 w-5" />Nueva<span className="hidden sm:inline"> factura</span></Button>
        <p className="w-full text-muted-foreground">Cobros, abonos y comprobantes.</p>
      </header>
      <div className="space-y-4">
        <form role="search" className="flex gap-2" onSubmit={(event) => { event.preventDefault(); filters({ q: search.trim() }); }}>
          <Label htmlFor="invoice-search" className="sr-only">Buscar factura o contacto</Label>
          <Input id="invoice-search" value={search} maxLength={255} onChange={event => setSearch(event.target.value)} placeholder="Factura o contacto" className="h-12 min-w-0 rounded-xl text-base" />
          <Button type="submit" variant="secondary" className="h-12 w-12 shrink-0 rounded-xl p-0" aria-label="Buscar facturas"><Search className="h-5 w-5" /></Button>
        </form>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <label className="space-y-1 text-sm">Estado de cobro
            <select aria-label="Estado de cobro" value={statusFilter} onChange={e => filters({ status: e.target.value })} className="block h-12 w-full rounded-xl border border-border bg-card px-3 text-base">
              {STATUS_OPTIONS.map(status => <option key={status} value={status}>{status === "ALL" ? "Todos los estados" : collectionLabels[status] ?? status}</option>)}
            </select>
          </label>
          <details className="sm:col-span-2">
            <summary className="flex min-h-12 cursor-pointer items-center rounded-xl border border-border px-4 text-sm">Más filtros{fiscalFilter !== "ALL" || contactFilter !== "ALL" ? " · activos" : ""}</summary>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <label className="space-y-1 text-sm">Estado Hacienda
                <select aria-label="Estado Hacienda" value={fiscalFilter} onChange={e => filters({ hacienda_status: e.target.value })} className="block h-12 w-full rounded-xl border border-border bg-card px-3 text-base">
                  {HACIENDA_STATUS_OPTIONS.map(status => <option key={status} value={status}>{status === "ALL" ? "Todos" : status.replaceAll("_", " ")}</option>)}
                </select>
              </label>
              <label className="space-y-1 text-sm">Contacto
                <select aria-label="Contacto" value={contactFilter} onChange={e => filters({ contact_id: e.target.value })} className="block h-12 w-full rounded-xl border border-border bg-card px-3 text-base">
                  <option value="ALL">Todos los contactos</option>
                  {contacts.map((contact: any) => <option key={contact.id} value={contact.id}>{contact.full_name}</option>)}
                </select>
              </label>
            </div>
          </details>
        </div>
        {isError ? (
          <div role="alert" className="rounded-xl border border-border p-5"><p>No se pudieron cargar las facturas.</p><Button className="mt-3 min-h-11" variant="secondary" onClick={() => void refetch()} disabled={isFetching}>Reintentar</Button></div>
        ) : isLoading ? (
          <PageLoader />
        ) : filteredInvoices.length === 0 ? (
          <EmptyState icon={Receipt} title="Sin facturas" description={query || statusFilter !== "ALL" || fiscalFilter !== "ALL" || contactFilter !== "ALL" ? "No hay coincidencias. Prueba con otros filtros." : "Crea tu primera factura para empezar."} />
        ) : (
          <>
          <p role="status" className="text-sm text-muted-foreground">{total} facturas · Página {page} de {Math.max(1, pages)}</p>
          <div className="space-y-3 md:hidden" aria-label="Listado de facturas">
            {filteredInvoices.map((invoice: any) => (
              <article key={invoice.id} aria-label={`Factura ${invoice.number}`} className="rounded-2xl border border-border bg-card p-4">
                <div className="flex flex-wrap items-center justify-between gap-2"><h2 className="min-w-0 break-all font-semibold">{invoice.number}</h2><StatusBadge status={invoice.status} type="invoice" /></div>
                <p className="mt-2 break-words text-muted-foreground">{invoice.contact?.full_name ?? "Sin contacto"}</p>
                <dl className="mt-4 grid grid-cols-2 gap-3">
                  <div className="col-span-2"><dt className="text-sm text-muted-foreground">Saldo pendiente · {invoice.currency}</dt><dd className="break-words text-2xl font-semibold tabular-nums">{formatMoney(invoice.balance_due, invoice.currency)}</dd></div>
                  <div><dt className="text-sm text-muted-foreground">Total · {invoice.currency}</dt><dd className="break-words tabular-nums">{formatMoney(invoice.amount, invoice.currency)}</dd></div>
                  <div><dt className="text-sm text-muted-foreground">Pagado · {invoice.currency}</dt><dd className="break-words tabular-nums">{formatMoney(invoice.amount_paid, invoice.currency)}</dd></div>
                </dl>
                <p className="mt-3 text-sm text-muted-foreground">Vence {format(new Date(invoice.due_date), "d MMM yyyy", { locale: es })}</p>
                {invoice.issuance_mode === "HACIENDA" && <p className="mt-2 text-sm">Hacienda: <StatusBadge status={invoice.hacienda_status} type="invoice" /></p>}
                <div className="mt-3 border-t border-border pt-2">{renderActions(invoice)}</div>
              </article>
            ))}
          </div>
          <div className="hidden rounded-lg border border-border overflow-x-auto bg-card md:block">
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
                      className="border-border hover:bg-muted/50"
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
                          <div className="text-[11px] text-amber-600">{overdueDays}d vencida</div>
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
                        {renderActions(invoice)}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
          </>
        )}
        {!isError && !isLoading && (pages > 1 || page > 1) && <nav aria-label="Páginas de facturas" className="flex flex-wrap justify-between gap-3">
          <Button variant="secondary" className="min-h-12" disabled={page <= 1 || isFetching} onClick={() => filters({ page: String(page - 1) })}>Anterior</Button>
          <Button variant="secondary" className="min-h-12" disabled={page >= pages || isFetching} onClick={() => filters({ page: String(page + 1) })}>Siguiente</Button>
        </nav>}
        <details className="rounded-xl border border-border">
          <summary className="flex min-h-12 cursor-pointer items-center px-4 text-sm">Herramientas y ayuda fiscal</summary>
          <div className="space-y-3 border-t border-border p-4">
            <div className="flex flex-wrap gap-2">
              <Button variant="secondary" className="min-h-11" onClick={() => detectMutation.mutate()} disabled={detectMutation.isPending}>Detectar deudas</Button>
              <Button variant="secondary" className="min-h-11" onClick={event => { returnFocus.current = event.currentTarget; setShowGuide(true); }}>Guía Hacienda</Button>
              <Button variant="secondary" className="min-h-11" onClick={() => setImportOpen(true)}>Importar CSV</Button>
              <DiagnosticButton module="invoices" />
            </div>
            {workspaceData && !isHaciendaWorkspaceReady && <p className="text-sm text-muted-foreground">Para emitir con Hacienda, completa en Configuración: {haciendaReadinessIssues.join(", ")}.</p>}
          </div>
        </details>
      </div>

      {action && <InvoiceActionDialog action={action} onClose={() => setAction(null)} onSuccess={message => { invalidateInvoices(); toast({ title: message }); }} restoreFocus={deleted => { if (deleted || !returnFocus.current?.isConnected) headingRef.current?.focus(); else returnFocus.current.focus(); }} />}
      <InvoiceSheet
        open={showCreate}
        onOpenChange={setShowCreate}
        error={createMutation.isError ? "No se pudo crear la factura. Revisa los datos y vuelve a intentar." : undefined}
        onRestoreFocus={() => returnFocus.current?.focus()}
        initialData={createForm}
        onChange={(updates) => setCreateForm((prev) => ({ ...prev, ...updates }))}
        onSave={() => createMutation.mutate()}
        isSaving={createMutation.isPending}
      />

      <Dialog open={showDetail} onOpenChange={(open) => { setShowDetail(open); if (!open) setSelectedInvoice(null); }}>
        <DialogContent onCloseAutoFocus={event => { event.preventDefault(); returnFocus.current?.focus(); }} aria-describedby={undefined} className="app-overlay invoice-detail max-h-[90dvh] w-[calc(100%-2rem)] overflow-y-auto bg-card border-border sm:max-w-[640px]">
          <DialogHeader>
            <DialogTitle className="pr-8 text-lg">Detalle de factura</DialogTitle>
          </DialogHeader>
          {selectedInvoice && (
            <div className="space-y-4 break-words text-sm">
              <div className="grid grid-cols-2 gap-3">
                <div><span className="text-muted-foreground/60">Número</span><div className="text-foreground font-medium mt-0.5">{selectedInvoice.number}</div></div>
                <div><span className="text-muted-foreground/60">Estado</span><div className="mt-0.5"><StatusBadge status={selectedInvoice.status} type="invoice" /></div></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><span className="text-muted-foreground/60">Contacto</span><div className="text-foreground mt-0.5">{selectedInvoice.contact?.full_name ?? "—"}</div></div>
                <div><span className="text-muted-foreground/60">Empresa</span><div className="text-foreground mt-0.5">{selectedInvoice.contact?.company_name ?? "—"}</div></div>
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <div><span className="text-muted-foreground/60">Total</span><div className="text-foreground font-medium mt-0.5">{formatMoney(selectedInvoice.amount, selectedInvoice.currency)}</div></div>
                <div><span className="text-muted-foreground/60">Pagado</span><div className="text-foreground font-medium mt-0.5">{formatMoney(selectedInvoice.amount_paid, selectedInvoice.currency)}</div></div>
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
                    <Table>
                      <TableHeader>
                        <TableRow className="border-border hover:bg-transparent">
                          <TableHead className="text-[10px] h-7 px-2">#</TableHead>
                          <TableHead className="text-[10px] h-7 px-2">Descripción</TableHead>
                          <TableHead className="text-[10px] h-7 px-2 text-right">Cant</TableHead>
                          <TableHead className="text-[10px] h-7 px-2 text-right">Precio</TableHead>
                          <TableHead className="text-[10px] h-7 px-2 text-right">IVA</TableHead>
                          <TableHead className="text-[10px] h-7 px-2 text-right">Total</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {selectedInvoice.lines.map((line: any) => (
                          <TableRow key={line.id} className="border-border/50 hover:bg-muted/30">
                            <TableCell className="px-2 py-1.5 text-[10px] text-muted-foreground">{line.line_number}</TableCell>
                            <TableCell className="px-2 py-1.5 text-[10px]">
                              <span className="text-foreground">{line.description}</span>
                              {line.product?.name && <span className="text-muted-foreground/60 ml-1">({line.product.name})</span>}
                            </TableCell>
                            <TableCell className="px-2 py-1.5 text-[10px] text-right text-foreground">{Number(line.quantity)}</TableCell>
                            <TableCell className="px-2 py-1.5 text-[10px] text-right text-foreground">{formatMoney(line.unit_price, selectedInvoice.currency)}</TableCell>
                            <TableCell className="px-2 py-1.5 text-[10px] text-right text-muted-foreground">{line.tax_rate != null ? `${line.tax_rate}%` : "—"}</TableCell>
                            <TableCell className="px-2 py-1.5 text-[10px] text-right text-foreground font-medium">{formatMoney(line.total_line_amount, selectedInvoice.currency)}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              )}
              {selectedInvoice.payments?.length > 0 && (
                <div>
                  <span className="text-muted-foreground/60">Pagos registrados</span>
                  <div className="mt-1 space-y-1">
                    {selectedInvoice.payments.map((p: any) => (
                      <div key={p.id} className="grid gap-1 break-words rounded border border-border bg-background px-3 py-2 sm:grid-cols-3">
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
            <Button variant="secondary" size="sm" className="h-12 text-base" onClick={() => setShowDetail(false)}>Cerrar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Sheet open={showEdit} onOpenChange={closeEdit}>
        <SheetContent side={mobile ? "bottom" : "right"} closeLabel="Cerrar" closeDisabled={updateMutation.isPending}
          onOpenAutoFocus={event => { event.preventDefault(); editTitle.current?.focus(); }}
          onCloseAutoFocus={event => { event.preventDefault(); returnFocus.current?.focus(); }}
          className="app-overlay invoice-editor flex h-[92dvh] w-full flex-col gap-0 rounded-t-3xl p-0 md:h-full md:w-[560px] md:max-w-[560px] md:rounded-none">
          <SheetHeader className="shrink-0 border-b border-border px-5 py-4 pr-16 text-left">
            <SheetTitle ref={editTitle} tabIndex={-1} className="text-xl">Editar factura</SheetTitle>
            <SheetDescription>{selectedInvoice?.number} · Los cambios se guardan al confirmar.</SheetDescription>
          </SheetHeader>
          <form className="flex min-h-0 flex-1 flex-col" onSubmit={event => { event.preventDefault(); if (!updateMutation.isPending && editDirty) updateMutation.mutate(); }}>
          <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
          <fieldset disabled={updateMutation.isPending} className="min-w-0 space-y-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-1">
                <Label htmlFor="edit-issuance_mode" className="text-sm text-muted-foreground">Modo</Label>
                <Select value={editForm.issuance_mode} onValueChange={(v) => setEditForm(f => ({ ...f, issuance_mode: v }))}>
                  <SelectTrigger id="edit-issuance_mode" className="h-12 text-base bg-background border-border"><SelectValue /></SelectTrigger>
                  <SelectContent className="app-overlay">{ISSUANCE_MODES.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label htmlFor="edit-document_type" className="text-sm text-muted-foreground">Documento</Label>
                <Select value={editForm.document_type} onValueChange={(v) => setEditForm(f => ({ ...f, document_type: v }))}>
                  <SelectTrigger id="edit-document_type" className="h-12 text-base bg-background border-border"><SelectValue /></SelectTrigger>
                  <SelectContent className="app-overlay">{DOCUMENT_TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            {showEdit && <InvoiceContactPicker key={selectedInvoice?.id} value={editForm.contact_id} initialName={selectedInvoice?.contact?.full_name} onChange={id => setEditForm(form => ({ ...form, contact_id: id }))} />}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-1">
                <Label htmlFor="edit-number" className="text-sm text-muted-foreground">Número</Label>
                <Input id="edit-number" required maxLength={50} pattern={".*\\S.*"} value={editForm.number} onChange={(e) => setEditForm(f => ({ ...f, number: e.target.value }))} className="h-12 text-base bg-background border-border" />
              </div>
              <div className="space-y-1">
                <Label htmlFor="edit-currency" className="text-sm text-muted-foreground">Moneda</Label>
                <Input id="edit-currency" required disabled={Number(selectedInvoice?.amount_paid) > 0} pattern="[A-Z]{3}" minLength={3} maxLength={3} value={editForm.currency} onChange={(e) => setEditForm(f => ({ ...f, currency: e.target.value.toUpperCase() }))} className="h-12 text-base bg-background border-border" />
              </div>
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-1">
                <Label htmlFor="edit-amount" className="text-sm text-muted-foreground">Monto total</Label>
                <Input type="number" step="0.01" id="edit-amount" required min={Math.max(0.01, Number(selectedInvoice?.amount_paid ?? 0))} inputMode="decimal" value={editForm.amount} onChange={(e) => setEditForm(f => ({ ...f, amount: e.target.value }))} className="h-12 text-base bg-background border-border" />
              </div>
              <div className="space-y-1">
                <Label htmlFor="edit-due_date" className="text-sm text-muted-foreground">Vencimiento</Label>
                <Input type="date" id="edit-due_date" required value={editForm.due_date} onChange={(e) => setEditForm(f => ({ ...f, due_date: e.target.value }))} className="h-12 text-base bg-background border-border" />
              </div>
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-1">
                <Label htmlFor="edit-issue_date" className="text-sm text-muted-foreground">Fecha emisión</Label>
                <Input type="date" id="edit-issue_date" value={editForm.issue_date} onChange={(e) => setEditForm(f => ({ ...f, issue_date: e.target.value }))} className="h-12 text-base bg-background border-border" />
              </div>
              <div className="space-y-1">
                <Label htmlFor="edit-activity_code" className="text-sm text-muted-foreground">Actividad</Label>
                <Input id="edit-activity_code" maxLength={20} value={editForm.activity_code} onChange={(e) => setEditForm(f => ({ ...f, activity_code: e.target.value }))} className="h-12 text-base bg-background border-border" placeholder="Código" />
              </div>
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-1">
                <Label htmlFor="edit-sale_condition" className="text-sm text-muted-foreground">Condición venta</Label>
                <Input id="edit-sale_condition" maxLength={20} value={editForm.sale_condition} onChange={(e) => setEditForm(f => ({ ...f, sale_condition: e.target.value }))} className="h-12 text-base bg-background border-border" placeholder="01" />
              </div>
              <div className="space-y-1">
                <Label htmlFor="edit-payment_method" className="text-sm text-muted-foreground">Medio pago</Label>
                <Input id="edit-payment_method" maxLength={20} value={editForm.payment_method} onChange={(e) => setEditForm(f => ({ ...f, payment_method: e.target.value }))} className="h-12 text-base bg-background border-border" placeholder="01" />
              </div>
            </div>
            <div className="space-y-1">
              <Label htmlFor="edit-description" className="text-sm text-muted-foreground">Descripción</Label>
              <Textarea id="edit-description" value={editForm.description} onChange={(e) => setEditForm(f => ({ ...f, description: e.target.value }))} className="min-h-[96px] text-base bg-background border-border" placeholder="Detalles opcionales" />
            </div>
          </fieldset>
          {Number(selectedInvoice?.amount_paid) > 0 && <p className="mt-3 text-sm text-muted-foreground">La moneda se mantiene porque ya hay pagos registrados. El total no puede ser menor que lo pagado.</p>}
          {updateMutation.isError && <div role="alert" className="mt-3 text-sm text-destructive">{getErrorMessage(updateMutation.error)}</div>}
          {discardEdit && <div role="alert" className="mt-4 space-y-3 rounded-xl border border-border p-4"><p>Hay cambios sin guardar.</p><div className="flex flex-wrap gap-2">
            <Button ref={keepEditing} type="button" className="min-h-12" onClick={() => setDiscardEdit(false)}>Seguir editando</Button>
            <Button type="button" variant="secondary" className="min-h-12" onClick={() => { setShowEdit(false); setSelectedInvoice(null); setDiscardEdit(false); }}>Descartar cambios</Button>
          </div></div>}
          </div>
          <SheetFooter className="shrink-0 flex-row justify-between gap-2 border-t border-border px-5 pt-3 pb-[max(12px,env(safe-area-inset-bottom))]">
            <Button type="button" variant="secondary" size="sm" className="h-12 text-base" disabled={updateMutation.isPending} onClick={() => closeEdit(false)}>Cancelar</Button>
            <Button
              size="sm"
              className="h-12 text-base"
              type="submit"
              disabled={updateMutation.isPending || discardEdit || !editDirty || !editForm.contact_id || !editForm.number.trim() || !editForm.amount || !editForm.due_date}
            >
              {updateMutation.isPending && <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />}
              Guardar cambios
            </Button>
          </SheetFooter>
          </form>
        </SheetContent>
      </Sheet>

      <Dialog open={showGuide} onOpenChange={setShowGuide}>
        <DialogContent closeLabel="Cerrar ventana" onOpenAutoFocus={event => { event.preventDefault(); fiscalTitle.current?.focus(); }} aria-describedby={undefined} onCloseAutoFocus={event => { event.preventDefault(); returnFocus.current?.focus(); }} className="app-overlay invoice-detail w-[calc(100%-2rem)] max-h-[90dvh] overflow-y-auto rounded-2xl [overflow-wrap:anywhere] [&>*]:min-w-0 bg-card border-border sm:max-w-[720px]">
          <DialogHeader>
            <DialogTitle ref={fiscalTitle} tabIndex={-1} className="pr-8 text-lg leading-snug text-left">Guía de conceptos de facturación y Hacienda</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="rounded-lg border border-border bg-background px-4 py-3">
              <div className="text-sm font-medium text-foreground">Qué necesita una factura rigurosa para Hacienda</div>
              <p className="mt-1 text-sm leading-5 text-muted-foreground/60">
                No basta con monto y cliente. Para que el sistema sea sólido se necesitan datos correctos del emisor,
                datos fiscales del receptor, líneas con CABYS e impuesto, catálogos tributarios, XML, firma, token,
                envío, callback o consulta de estado, y trazabilidad de aceptación o rechazo.
              </p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              {HACIENDA_GUIDE.map((item) => (
                <div key={item.title} className="rounded-lg border border-border bg-background px-4 py-3">
                  <div className="text-sm font-medium text-foreground">{item.title}</div>
                  <p className="mt-1 text-sm leading-5 text-muted-foreground/60">{item.meaning}</p>
                  <div className="mt-2 rounded-md border border-border bg-card px-2.5 py-2 text-sm leading-5 text-foreground">
                    {item.example}
                  </div>
                </div>
              ))}
            </div>
            <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-4 py-3">
              <div className="text-sm font-medium text-foreground">Pendiente importante</div>
              <p className="mt-1 text-sm leading-5 text-muted-foreground/60">
                El flujo ya contempla la estructura de Hacienda, pero para operar en serio aún debes tener configurados
                el certificado real, la firma real, credenciales válidas, callback accesible y catálogos tributarios correctos.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="secondary" size="sm" className="min-h-12 text-sm" onClick={() => setShowGuide(false)}>
              Cerrar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={showPayment}
        onOpenChange={(open) => {
          if (registerPaymentMutation.isPending) return;
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
        <DialogContent aria-describedby={undefined} onCloseAutoFocus={event => { event.preventDefault(); returnFocus.current?.focus(); }} className="app-overlay invoice-detail max-h-[90dvh] w-[calc(100%-2rem)] overflow-y-auto bg-card border-border sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle className="pr-8 text-lg">Registrar pago</DialogTitle>
          </DialogHeader>
          <form onSubmit={event => { event.preventDefault(); if (!registerPaymentMutation.isPending) registerPaymentMutation.mutate(); }}>
          {!selectedInvoice ? null : (
            <div className="space-y-3">
              <div className="rounded-md border border-border bg-background px-3 py-2 space-y-1">
                <div className="text-xs text-muted-foreground">
                  {selectedInvoice.number} · {selectedInvoice.contact?.full_name}
                </div>
                <div className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-3">
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

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="space-y-1">
                  <Label htmlFor="payment-amount" className="text-sm text-muted-foreground">Monto abonado · {selectedInvoice.currency}</Label>
                  <Input
                    type="number"
                    step="0.01"
                    id="payment-amount" required min="0.01" max={Number(selectedInvoice.balance_due)} inputMode="decimal" value={paymentForm.amount}
                    onChange={(e) => setPaymentForm((prev) => ({ ...prev, amount: e.target.value }))}
                    className="h-12 text-base bg-background border-border"
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="payment-paid_at" className="text-sm text-muted-foreground">Fecha de pago</Label>
                  <Input
                    type="date"
                    id="payment-paid_at" value={paymentForm.paid_at}
                    onChange={(e) => setPaymentForm((prev) => ({ ...prev, paid_at: e.target.value }))}
                    className="h-12 text-base bg-background border-border"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="space-y-1">
                  <Label htmlFor="payment-method" className="text-sm text-muted-foreground">Método</Label>
                  <Input
                    id="payment-method" maxLength={50} value={paymentForm.method}
                    onChange={(e) => setPaymentForm((prev) => ({ ...prev, method: e.target.value }))}
                    className="h-12 text-base bg-background border-border"
                    placeholder="Pago móvil, transferencia..."
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="payment-reference" className="text-sm text-muted-foreground">Referencia</Label>
                  <Input
                    id="payment-reference" maxLength={120} value={paymentForm.reference}
                    onChange={(e) => setPaymentForm((prev) => ({ ...prev, reference: e.target.value }))}
                    className="h-12 text-base bg-background border-border"
                    placeholder="Comprobante"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <Label htmlFor="payment-notes" className="text-sm text-muted-foreground">Notas</Label>
                <Textarea
                  id="payment-notes" value={paymentForm.notes}
                  onChange={(e) => setPaymentForm((prev) => ({ ...prev, notes: e.target.value }))}
                  className="min-h-[90px] text-xs bg-background border-border"
                  placeholder="Detalle opcional del pago"
                />
              </div>
            </div>
          )}
          {registerPaymentMutation.isError && <p role="alert" className="my-3 text-sm text-destructive">No se pudo registrar el pago. Revisa los datos y vuelve a intentar.</p>}
          <DialogFooter className="mt-4 gap-2">
            <Button type="button" variant="secondary" size="sm" className="h-12 text-base" disabled={registerPaymentMutation.isPending} onClick={() => setShowPayment(false)}>
              Cancelar
            </Button>
            <Button
              size="sm"
              className="h-12 text-base"
              type="submit"
              disabled={!selectedInvoice || !paymentForm.amount || registerPaymentMutation.isPending}
            >
              {registerPaymentMutation.isPending ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : <Coins className="w-3.5 h-3.5 mr-1.5" />}
              Guardar pago
            </Button>
          </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {showReminder && selectedInvoice && <InvoiceReminderSheet invoice={selectedInvoice}
        onClose={() => { setShowReminder(false); setSelectedInvoice(null); }}
        onSent={() => { invalidateInvoices(); toast({ title: "Recordatorio enviado" }); }}
        restoreFocus={() => returnFocus.current?.focus()} />}
      <CsvImportModal open={importOpen} onClose={() => setImportOpen(false)} entityType="invoices" />

      <Dialog open={showValidation} onOpenChange={setShowValidation}>
        <DialogContent closeLabel="Cerrar ventana" onOpenAutoFocus={event => { event.preventDefault(); fiscalTitle.current?.focus(); }} aria-describedby={undefined} onCloseAutoFocus={event => { event.preventDefault(); returnFocus.current?.focus(); }} className="app-overlay invoice-detail w-[calc(100%-2rem)] max-h-[90dvh] overflow-y-auto rounded-2xl [overflow-wrap:anywhere] [&>*]:min-w-0 bg-card border-border sm:max-w-[520px]">
          <DialogHeader>
            <DialogTitle ref={fiscalTitle} tabIndex={-1} className="pr-8 text-lg leading-snug text-left flex items-start gap-2 [&>svg]:shrink-0">
              {validationResult?.valid ? <CheckCircle2 className="w-4 h-4 text-green-600" /> : <AlertTriangle className="w-4 h-4 text-amber-600" />}
              Validación Hacienda — {validationResult?.valid ? "Listo para enviar" : "Requiere correcciones"}
            </DialogTitle>
          </DialogHeader>
          {validationResult && (
            <div className="space-y-3 text-sm">
              {validationResult.issues?.length > 0 && (
                <div className="space-y-2">
                  {validationResult.issues.map((issue: Record<string, any>, i: number) => (
                    <div key={i} className={cn(
                      "rounded-md border px-3 py-2",
                      issue.severity === "error" ? "border-destructive/40 bg-destructive/10" : "border-amber-500/40 bg-amber-500/10",
                    )}>
                      <span className={issue.severity === "error" ? "text-destructive" : "text-foreground"}>{issue.field}</span>
                      <p className="text-muted-foreground mt-0.5">{issue.message}</p>
                    </div>
                  ))}
                </div>
              )}
              {validationResult.ai_review && (
                <div className="rounded-md border border-border bg-muted/30 px-3 py-2">
                  <span className="text-foreground font-medium">Revisión IA</span>
                  <p className="text-muted-foreground mt-0.5 whitespace-pre-wrap">{validationResult.ai_review}</p>
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="secondary" size="sm" className="min-h-12 text-sm" onClick={() => setShowValidation(false)}>Cerrar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showErrorExplain} onOpenChange={setShowErrorExplain}>
        <DialogContent closeLabel="Cerrar ventana" onOpenAutoFocus={event => { event.preventDefault(); fiscalTitle.current?.focus(); }} aria-describedby={undefined} onCloseAutoFocus={event => { event.preventDefault(); returnFocus.current?.focus(); }} className="app-overlay invoice-detail w-[calc(100%-2rem)] max-h-[90dvh] overflow-y-auto rounded-2xl [overflow-wrap:anywhere] [&>*]:min-w-0 bg-card border-border sm:max-w-[480px]">
          <DialogHeader>
            <DialogTitle ref={fiscalTitle} tabIndex={-1} className="pr-8 text-lg leading-snug text-left flex items-start gap-2 [&>svg]:shrink-0">
              <Info className="w-4 h-4 text-gray-500" />
              Error de Hacienda explicado
            </DialogTitle>
          </DialogHeader>
          {errorExplainData && (
            <div className="space-y-3 text-sm">
              <div className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2">
                <span className="text-destructive font-medium">Mensaje técnico</span>
                <p className="text-muted-foreground mt-0.5 whitespace-pre-wrap">{errorExplainData.technical_message}</p>
              </div>
              <div className="rounded-md border border-border/60 bg-background px-3 py-2">
                <span className="text-foreground font-medium">Explicación</span>
                <p className="text-muted-foreground mt-0.5 whitespace-pre-wrap">{errorExplainData.plain_explanation}</p>
              </div>
              {errorExplainData.suggested_fix && (
                <div className="rounded-md border border-border bg-muted/30 px-3 py-2">
                  <span className="text-foreground font-medium">Sugerencia para corregir</span>
                  <p className="text-muted-foreground mt-0.5 whitespace-pre-wrap">{errorExplainData.suggested_fix}</p>
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="secondary" size="sm" className="min-h-12 text-sm" onClick={() => setShowErrorExplain(false)}>Cerrar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showXmlPreview} onOpenChange={setShowXmlPreview}>
        <DialogContent closeLabel="Cerrar ventana" onOpenAutoFocus={event => { event.preventDefault(); fiscalTitle.current?.focus(); }} aria-describedby={undefined} onCloseAutoFocus={event => { event.preventDefault(); returnFocus.current?.focus(); }} className="app-overlay invoice-detail w-[calc(100%-2rem)] max-h-[90dvh] overflow-y-auto rounded-2xl [overflow-wrap:anywhere] [&>*]:min-w-0 bg-card border-border sm:max-w-[680px]">
          <DialogHeader>
            <DialogTitle ref={fiscalTitle} tabIndex={-1} className="pr-8 text-lg leading-snug text-left flex items-start gap-2 [&>svg]:shrink-0">
              <Code2 className="w-4 h-4 text-gray-500" />
              Vista previa XML — Factura Electrónica
            </DialogTitle>
          </DialogHeader>
          {xmlPreview && (
            <div className="min-w-0 space-y-3 text-sm">
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  variant="secondary"
                  size="sm"
                  className="min-h-12 text-sm"
                  onClick={async () => { try { await navigator.clipboard.writeText(xmlPreview.xml); setCopyStatus("XML copiado."); } catch { setCopyStatus("No se pudo copiar. Puedes seleccionar el XML o descargarlo."); } }}
                >
                  Copiar XML
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  className="min-h-12 text-sm"
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
              <p role="status" className="text-sm text-muted-foreground">{copyStatus}</p>
              <pre tabIndex={0} aria-label="Contenido XML" className="min-w-0 rounded-xl border border-border bg-background p-3 text-sm text-foreground whitespace-pre-wrap [overflow-wrap:anywhere] max-h-[50dvh] overflow-y-auto leading-relaxed">
                {xmlPreview.xml}
              </pre>
            </div>
          )}
          <DialogFooter>
            <Button variant="secondary" size="sm" className="min-h-12 text-sm" onClick={() => setShowXmlPreview(false)}>Cerrar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
