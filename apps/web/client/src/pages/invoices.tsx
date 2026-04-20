import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { differenceInCalendarDays, format } from "date-fns";
import { es } from "date-fns/locale";
import {
  AlertTriangle,
  CheckCircle2,
  Loader2,
  Plus,
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

const STATUS_OPTIONS = ["ALL", "DRAFT", "SENT", "PAID", "OVERDUE", "CANCELLED"];

function formatMoney(amount: unknown, currency = "USD") {
  const value = Number(amount ?? 0);
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

export default function InvoicesPage() {
  useRequireAuth();
  const { toast } = useToast();

  const [statusFilter, setStatusFilter] = useState("ALL");
  const [contactFilter, setContactFilter] = useState("ALL");
  const [search, setSearch] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [showReminder, setShowReminder] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState<any>(null);
  const [highlightedIds, setHighlightedIds] = useState<string[]>([]);
  const [createForm, setCreateForm] = useState({
    contact_id: "",
    number: "",
    amount: "",
    currency: "USD",
    due_date: "",
    description: "",
  });
  const [reminderDraft, setReminderDraft] = useState("");
  const [selectedChannelId, setSelectedChannelId] = useState("");

  const invoiceParams: Record<string, string> = {};
  if (statusFilter !== "ALL") invoiceParams.status = statusFilter;
  if (contactFilter !== "ALL") invoiceParams.contact_id = contactFilter;

  const { data, isLoading } = useQuery({
    queryKey: ["/api/invoices", statusFilter, contactFilter],
    queryFn: () => api.getInvoices(Object.keys(invoiceParams).length ? invoiceParams : undefined),
  });

  const { data: contactsData } = useQuery({
    queryKey: ["/api/contacts", "invoice-form"],
    queryFn: () => api.getContacts({ limit: "200" }),
  });

  const { data: channelsData } = useQuery({
    queryKey: ["/api/channels", "invoice-reminders"],
    queryFn: api.getChannels,
  });

  const contacts = Array.isArray(contactsData) ? contactsData : contactsData?.data ?? [];
  const invoices = Array.isArray(data) ? data : data?.data ?? [];
  const totalOverdue = useMemo(
    () => invoices.filter((invoice: any) => invoice.status === "OVERDUE").length,
    [invoices],
  );
  const overdueAmount = useMemo(
    () =>
      invoices
        .filter((invoice: any) => invoice.status === "OVERDUE")
        .reduce((sum: number, invoice: any) => sum + Number(invoice.amount ?? 0), 0),
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

  const invalidateInvoices = () => {
    queryClient.invalidateQueries({ queryKey: ["/api/invoices"] });
    queryClient.invalidateQueries({ queryKey: ["/api/invoices", "overdue-widget"] });
  };

  const createMutation = useMutation({
    mutationFn: () =>
      api.createInvoice({
        ...createForm,
        amount: Number(createForm.amount),
        notes: [],
      }),
    onSuccess: () => {
      invalidateInvoices();
      setShowCreate(false);
      setCreateForm({
        contact_id: "",
        number: "",
        amount: "",
        currency: "USD",
        due_date: "",
        description: "",
      });
      toast({ title: "Factura creada" });
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
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
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const markPaidMutation = useMutation({
    mutationFn: (id: string) => api.markInvoicePaid(id),
    onSuccess: () => {
      invalidateInvoices();
      toast({ title: "Factura marcada como pagada" });
    },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.deleteInvoice(id),
    onSuccess: () => {
      invalidateInvoices();
      toast({ title: "Factura eliminada" });
    },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const generateReminderMutation = useMutation({
    mutationFn: (invoice: any) => api.generateInvoiceReminder(invoice.id),
    onSuccess: (reminder: any, invoice: any) => {
      setSelectedInvoice(invoice);
      setReminderDraft(reminder?.draft_text ?? "");
    },
    onError: (err: any) => {
      setShowReminder(false);
      toast({ title: "Error al redactar", description: err.message, variant: "destructive" });
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
      toast({ title: "Error al enviar", description: err.message, variant: "destructive" });
    },
  });

  const openReminderModal = (invoice: any) => {
    setSelectedInvoice(invoice);
    setReminderDraft(invoice.reminders?.[0]?.draft_text ?? "");
    setShowReminder(true);
    generateReminderMutation.mutate(invoice);
  };

  return (
    <div>
      <PageHeader title="Facturas" description="Controla cuentas por cobrar y recordatorios de pago">
        <Button
          variant="outline"
          size="sm"
          className="h-8 text-xs"
          onClick={() => detectMutation.mutate()}
          disabled={detectMutation.isPending}
        >
          {detectMutation.isPending ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : <Search className="w-3.5 h-3.5 mr-1.5" />}
          Detectar deudas
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

        <div className="flex items-center gap-2 flex-wrap">
          <div className="relative flex-1 min-w-[200px] max-w-[320px]">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar factura o cliente..."
              className="h-8 text-xs bg-card border-border pl-8"
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[150px] h-8 text-xs bg-card border-border">
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
          <Select value={contactFilter} onValueChange={setContactFilter}>
            <SelectTrigger className="w-[180px] h-8 text-xs bg-card border-border">
              <SelectValue placeholder="Cliente" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">Todo cliente</SelectItem>
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
                  <TableHead className="text-[11px] text-muted-foreground font-medium">Cliente</TableHead>
                  <TableHead className="text-[11px] text-muted-foreground font-medium">Monto</TableHead>
                  <TableHead className="text-[11px] text-muted-foreground font-medium">Vencimiento</TableHead>
                  <TableHead className="text-[11px] text-muted-foreground font-medium">Días</TableHead>
                  <TableHead className="text-[11px] text-muted-foreground font-medium">Estado</TableHead>
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
                      </TableCell>
                      <TableCell className="text-sm text-foreground">
                        {formatMoney(invoice.amount, invoice.currency)}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {format(new Date(invoice.due_date), "d MMM yyyy", { locale: es })}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {invoice.status === "OVERDUE" ? `${overdueDays}d` : "—"}
                      </TableCell>
                      <TableCell>
                        <StatusBadge status={invoice.status} type="invoice" />
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
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
                          {invoice.status !== "PAID" && invoice.status !== "CANCELLED" && (
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-8 text-xs"
                              onClick={() => markPaidMutation.mutate(invoice.id)}
                            >
                              <CheckCircle2 className="w-3.5 h-3.5 mr-1.5" />
                              Pagada
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
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Cliente</Label>
              <Select value={createForm.contact_id} onValueChange={(value) => setCreateForm((prev) => ({ ...prev, contact_id: value }))}>
                <SelectTrigger className="h-8 text-xs bg-background border-border">
                  <SelectValue placeholder="Selecciona un cliente" />
                </SelectTrigger>
                <SelectContent>
                  {contacts.map((contact: any) => (
                    <SelectItem key={contact.id} value={contact.id}>
                      {contact.full_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Número</Label>
                <Input
                  value={createForm.number}
                  onChange={(e) => setCreateForm((prev) => ({ ...prev, number: e.target.value }))}
                  className="h-8 text-xs bg-background border-border"
                  placeholder="FAC-001"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Moneda</Label>
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
                <Label className="text-xs text-muted-foreground">Monto</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={createForm.amount}
                  onChange={(e) => setCreateForm((prev) => ({ ...prev, amount: e.target.value }))}
                  className="h-8 text-xs bg-background border-border"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Vencimiento</Label>
                <Input
                  type="date"
                  value={createForm.due_date}
                  onChange={(e) => setCreateForm((prev) => ({ ...prev, due_date: e.target.value }))}
                  className="h-8 text-xs bg-background border-border"
                />
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Descripción</Label>
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
                  {formatMoney(selectedInvoice.amount, selectedInvoice.currency)} vencidos
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
