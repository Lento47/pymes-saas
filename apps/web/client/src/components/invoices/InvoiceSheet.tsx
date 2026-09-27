import { useState, useEffect, useRef } from "react";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetFooter,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Loader2, HelpCircle, Search, Package } from "lucide-react";
import { useI18n } from "@/components/providers/i18n-provider";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useCabysSearch } from "@/hooks/useCabysSearch";
import { api } from "@/lib/api";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { useIsMobile } from "@/hooks/use-mobile";
import { InvoiceContactPicker } from "./InvoiceContactPicker";

const DOCUMENT_TYPES = ["FACTURA_ELECTRONICA", "TIQUETE_ELECTRONICO", "NOTA_CREDITO", "NOTA_DEBITO", "MENSAJE_RECEPTOR"];
const ISSUANCE_MODES = ["MANUAL_ONLY", "HACIENDA"];

function FieldHelp({ meaning, label }: { meaning: string; label: string }) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button type="button" aria-label={`Ayuda: ${label}`} className="inline-flex items-center justify-center w-11 h-11 shrink-0 rounded-full hover:bg-accent/50 transition-colors">
          <HelpCircle className="w-3 h-3 text-muted-foreground" />
        </button>
      </PopoverTrigger>
      <PopoverContent side="top" className="app-overlay w-64 text-sm leading-relaxed text-muted-foreground bg-card border-border">
        {meaning}
      </PopoverContent>
    </Popover>
  );
}

const HACIENDA_HELP: Record<string, string> = {
  issuance_mode: "Permite decidir si esta factura queda solo para cobranza interna o si además se emite oficialmente ante Hacienda.",
  document_type: "Tipo de comprobante fiscal que se emitirá. FACTURA_ELECTRONICA para ventas normales, NOTA_CREDITO para rebajos o correcciones.",
  sale_condition: "Describe cómo se pactó el pago. 01 = contado, 02 = crédito.",
  payment_method: "Forma de pago. 01 = efectivo, 02 = tarjeta, 03 = transferencia, etc.",
  activity_code: "Código de actividad económica registrado ante Hacienda.",
  line_description: "Descripción del bien o servicio facturado. Requerido para Hacienda.",
  cabys_code: "Código CABYS del producto o servicio según catálogo de Hacienda.",
  tax_rate: "Porcentaje de impuesto de ventas (IVA). Típicamente 13% en Costa Rica.",
  currency: "Moneda en la que se emite la operación. CRC para colones, USD para dólares.",
  number: "Identificador comercial visible de la factura dentro del sistema.",
};

interface InvoiceFormData {
  contact_id: string;
  number: string;
  amount: string;
  currency: string;
  due_date: string;
  issue_date: string;
  description: string;
  issuance_mode: string;
  document_type: string;
  sale_condition: string;
  payment_method: string;
  activity_code: string;
  line_description: string;
  cabys_code: string;
  tax_rate: string;
  product_id: string;
}

interface InvoiceSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  error?: string;
  onRestoreFocus?: () => void;
  initialData: InvoiceFormData;
  onSave: () => void;
  isSaving: boolean;
  onChange: (updates: Partial<InvoiceFormData>) => void;
}

export function InvoiceSheet(props: InvoiceSheetProps) {
  return props.open ? <InvoiceSheetForm {...props} /> : null;
}

function InvoiceSheetForm({
  open, onOpenChange, error, onRestoreFocus,
  initialData, onSave, isSaving, onChange,
}: InvoiceSheetProps) {
  const mobile = useIsMobile();
  const { user } = useAuth();
  const titleRef = useRef<HTMLHeadingElement>(null);
  const keepEditing = useRef<HTMLButtonElement>(null);
  const original = useRef(initialData);
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const dirty = JSON.stringify(original.current) !== JSON.stringify(initialData);
  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ""; };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);
  useEffect(() => {
    if (confirmDiscard) { keepEditing.current?.scrollIntoView({ block: "center" }); keepEditing.current?.focus(); }
  }, [confirmDiscard]);
  function close(next: boolean) {
    if (isSaving) return;
    if (!next && dirty) { setConfirmDiscard(true); return; }
    onOpenChange(next);
  }
  const { messages } = useI18n();
  const t = messages.invoices;
  const isHacienda = initialData.issuance_mode === "HACIENDA";

  const [cabysQuery, setCabysQuery] = useState("");
  const [cabysOpen, setCabysOpen] = useState(false);
  const { results: cabysResults, loading: cabysLoading, error: cabysError, retry: retryCabys } = useCabysSearch(cabysQuery);
  const templateQuery = useQuery({
    queryKey: ["/api/invoices/templates", user?.workspace.id],
    queryFn: () => api.getInvoiceTemplates(),
    enabled: isHacienda,
  });
  const templates: any[] = Array.isArray(templateQuery.data) ? templateQuery.data : [];

  const [productQuery, setProductQuery] = useState("");
  const [productLoading, setProductLoading] = useState(false);
  const [productResults, setProductResults] = useState<any[]>([]);
  const [productOpen, setProductOpen] = useState(false);

  const productRequest = useRef(0);
  const [productError, setProductError] = useState(false);

  const handleProductSearch = async (q: string) => {
    const request = ++productRequest.current;
    setProductError(false);
    setProductQuery(q);
    if (q.length < 2) { setProductResults([]); setProductOpen(false); setProductLoading(false); return; }
    setProductLoading(true);
    setProductOpen(true);
    setProductResults([]);
    try {
      const params = new URLSearchParams({ search: q, limit: "8" });
      const res = await api.getProducts(params.toString());
      if (request !== productRequest.current) return;
      setProductResults(res?.data ?? []);
      setProductOpen(true);
    } catch {
      if (request === productRequest.current) { setProductResults([]); setProductError(true); }
    } finally {
      if (request === productRequest.current) setProductLoading(false);
    }
  };

  const selectProduct = (p: Record<string, any>) => {
    onChange({
      product_id: p.id,
      line_description: p.name,
      amount: String(parseFloat(p.unit_price) || 0),
    });
    if (p.cabys_code) onChange({ cabys_code: p.cabys_code });
    setProductOpen(false);
    setProductQuery(p.name);
  };

  return (
    <Sheet open={open} onOpenChange={close}>
      <SheetContent side={mobile ? "bottom" : "right"} closeLabel="Cerrar" closeDisabled={isSaving}
        onOpenAutoFocus={event => { event.preventDefault(); titleRef.current?.focus(); }}
        onCloseAutoFocus={event => { if (onRestoreFocus) { event.preventDefault(); onRestoreFocus(); } }}
        className="app-overlay invoice-editor w-full h-[92dvh] md:h-full md:max-h-none md:w-[580px] md:max-w-[580px] rounded-t-3xl md:rounded-none p-0 gap-0 flex flex-col">
        <SheetHeader className="px-5 pr-16 py-4 border-b border-border/60 space-y-1 shrink-0">
          <SheetTitle ref={titleRef} tabIndex={-1} className="text-xl font-semibold">Nueva factura</SheetTitle>
          <SheetDescription>Elige el cliente y los datos del cobro.</SheetDescription>
        </SheetHeader>

        <form className="flex min-h-0 flex-1 flex-col" onSubmit={event => { event.preventDefault(); if (!isSaving && initialData.contact_id) onSave(); }}>
        <div className="min-h-0 flex-1 overflow-y-auto">
        <fieldset disabled={isSaving} className="min-w-0 px-5 py-4 space-y-5">
          <InvoiceContactPicker value={initialData.contact_id} onChange={id => onChange({ contact_id: id })} />

          {/* Number + Currency */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <div className="flex items-center gap-1">
                <Label htmlFor="invoice-number" className="text-sm text-muted-foreground">{t.number}</Label>
                <FieldHelp label="Número de factura" meaning={HACIENDA_HELP.number} />
              </div>
              <Input
                id="invoice-number" required maxLength={50} pattern={".*\\S.*"} value={initialData.number}
                onChange={(e) => onChange({ number: e.target.value })}
                placeholder="FAC-001"
                className="h-12 text-base bg-background border-border"
              />
            </div>
            <div className="space-y-1.5">
              <div className="flex items-center gap-1">
                <Label htmlFor="invoice-currency" className="text-sm text-muted-foreground">Moneda</Label>
                <FieldHelp label="Moneda" meaning={HACIENDA_HELP.currency} />
              </div>
              <Input
                id="invoice-currency" required maxLength={3} minLength={3} pattern="[A-Z]{3}" value={initialData.currency}
                onChange={(e) => onChange({ currency: e.target.value.toUpperCase() })}
                placeholder="USD"
                className="h-12 text-base bg-background border-border"
              />
            </div>
          </div>

          {/* Amount + Due Date + Issue Date */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="invoice-amount" className="text-sm text-muted-foreground">{t.amount} <span className="text-red-400">*</span></Label>
              <Input
                type="number"
                id="invoice-amount" required step="0.01" min="0.01" inputMode="decimal" value={initialData.amount}
                onChange={(e) => onChange({ amount: e.target.value })}
                placeholder="0.00"
                className="h-12 text-base bg-background border-border"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="invoice-due_date" className="text-sm text-muted-foreground">{t.dueDate} <span className="text-red-400">*</span></Label>
              <Input
                type="date"
                id="invoice-due_date" required value={initialData.due_date}
                onChange={(e) => onChange({ due_date: e.target.value })}
                className="h-12 text-base bg-background border-border"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="invoice-issue_date" className="text-sm text-muted-foreground">Emisión</Label>
              <Input
                type="date"
                id="invoice-issue_date" value={initialData.issue_date}
                onChange={(e) => onChange({ issue_date: e.target.value })}
                className="h-12 text-base bg-background border-border"
              />
            </div>
          </div>

          <Separator className="bg-border/60" />

          {/* Mode + Document type */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <div className="flex items-center gap-1">
                <Label htmlFor="invoice-issuance_mode" className="text-sm text-muted-foreground">Modo</Label>
                <FieldHelp label="Modo" meaning={HACIENDA_HELP.issuance_mode} />
              </div>
              <Select value={initialData.issuance_mode} onValueChange={(v) => onChange({ issuance_mode: v })}>
                <SelectTrigger id="invoice-issuance_mode" className="h-12 text-base bg-background border-border">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ISSUANCE_MODES.map((m) => (
                    <SelectItem key={m} value={m}>{m === "MANUAL_ONLY" ? "Solo manual" : "Hacienda"}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <div className="flex items-center gap-1">
                <Label htmlFor="invoice-document_type" className="text-sm text-muted-foreground">Documento</Label>
                <FieldHelp label="Documento" meaning={HACIENDA_HELP.document_type} />
              </div>
              <Select value={initialData.document_type} onValueChange={(v) => onChange({ document_type: v })}>
                <SelectTrigger id="invoice-document_type" className="h-12 text-base bg-background border-border">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {DOCUMENT_TYPES.map((d) => (
                    <SelectItem key={d} value={d}>{d.replace(/_/g, " ")}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Hacienda section */}
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <div className="w-5 h-5 rounded bg-amber-500/10 border border-amber-500/20 flex items-center justify-center">
                <span className="text-[9px] font-bold text-amber-400">H</span>
              </div>
              <span className="text-xs font-medium text-foreground">
                {isHacienda ? "Datos para Hacienda" : "Datos para Hacienda (solo si seleccionás modo Hacienda)"}
              </span>
            </div>

            {!isHacienda ? (
              <p className="text-sm text-muted-foreground pl-7">
                Seleccioná el modo "Hacienda" para ver los campos fiscales requeridos para facturación electrónica.
              </p>
            ) : (
              <div className="space-y-3">
                {templateQuery.isError && <div role="alert"><p>No se pudieron cargar las plantillas.</p><Button type="button" variant="outline" onClick={() => void templateQuery.refetch()}>Reintentar plantillas</Button></div>}
                {templates.length > 0 && (
                  <div className="space-y-1.5">
                    <Label htmlFor="invoice-template" className="text-sm text-muted-foreground">Usar plantilla</Label>
                    <Select onValueChange={(v) => {
                      const tpl = templates.find((t) => t.industry === v);
                      if (tpl) {
                        onChange({
                          document_type: tpl.document_type,
                          activity_code: tpl.activity_code,
                          sale_condition: tpl.sale_condition,
                          payment_method: tpl.payment_method,
                          tax_rate: tpl.tax_rate,
                          currency: tpl.currency,
                          line_description: tpl.sample_line_description,
                        });
                      }
                    }}>
                      <SelectTrigger id="invoice-template" className="h-12 text-base bg-background border-border">
                        <SelectValue placeholder="Seleccionar plantilla..." />
                      </SelectTrigger>
                      <SelectContent>
                        {templates.map((tpl) => (
                          <SelectItem key={tpl.industry} value={tpl.industry}>{tpl.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-1">
                      <Label htmlFor="invoice-sale_condition" className="text-sm text-muted-foreground">Cond. venta</Label>
                      <FieldHelp label="Condición de venta" meaning={HACIENDA_HELP.sale_condition} />
                    </div>
                    <Input id="invoice-sale_condition" value={initialData.sale_condition} onChange={(e) => onChange({ sale_condition: e.target.value })} placeholder="01" className="h-12 text-base bg-background border-border" />
                  </div>
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-1">
                      <Label htmlFor="invoice-payment_method" className="text-sm text-muted-foreground">Medio pago</Label>
                      <FieldHelp label="Medio de pago" meaning={HACIENDA_HELP.payment_method} />
                    </div>
                    <Input id="invoice-payment_method" value={initialData.payment_method} onChange={(e) => onChange({ payment_method: e.target.value })} placeholder="01" className="h-12 text-base bg-background border-border" />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <div className="flex items-center gap-1">
                    <Label htmlFor="invoice-activity_code" className="text-sm text-muted-foreground">Actividad</Label>
                    <FieldHelp label="Actividad" meaning={HACIENDA_HELP.activity_code} />
                  </div>
                  <Input id="invoice-activity_code" value={initialData.activity_code} onChange={(e) => onChange({ activity_code: e.target.value })} placeholder="Código de actividad" className="h-12 text-base bg-background border-border" />
                </div>
                <div className="space-y-1.5">
                  <div className="flex items-center gap-1">
                    <Label htmlFor="invoice-product" className="text-sm text-muted-foreground">Producto de inventario</Label>
                  </div>
                  <div className="relative">
                    <Input
                      id="invoice-product" value={productQuery}
                      onChange={(e) => handleProductSearch(e.target.value)}
                      onFocus={() => { if (productResults.length > 0) setProductOpen(true); }}
                      placeholder="Buscar por nombre o SKU..."
                      className="h-12 text-base bg-background border-border pr-8"
                    />
                    {productLoading && <Loader2 className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 animate-spin text-muted-foreground" />}
                    {!productLoading && <Search className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground/40" />}
                    {productError && <div role="alert"><p>No se pudieron cargar los productos.</p><Button type="button" variant="outline" className="min-h-11" onClick={() => void handleProductSearch(productQuery)}>Reintentar productos</Button></div>}
                    {productOpen && productResults.length > 0 && (
                      <div className="absolute z-50 w-full mt-1 max-h-44 overflow-y-auto rounded-md border border-border bg-card shadow-lg">
                        {productResults.map((p) => (
                          <button
                            key={p.id}
                            type="button"
                            className="min-h-12 w-full text-left px-3 py-2 text-sm hover:bg-accent/50 transition-colors border-b border-border/40 last:border-0"
                            onClick={() => selectProduct(p)}
                          >
                            <div className="flex flex-wrap items-center gap-2 break-words">
                              <Package className="w-3.5 h-3.5 text-muted-foreground/50 shrink-0" />
                              <span className="font-medium text-foreground">{p.name}</span>
                              <span className="text-muted-foreground font-mono text-sm">{p.sku}</span>
                              <span className="text-muted-foreground text-sm">Precio: {parseFloat(p.unit_price).toLocaleString("es-CR", { minimumFractionDigits: 2 })}</span>
                              {p.track_inventory && p.type === "PRODUCT" && (
                                <span className="text-muted-foreground/50 text-sm">Stock: {p.current_stock}</span>
                              )}
                            </div>
                          </button>
                        ))}
                      </div>
                    )}
                    {productOpen && productQuery.length >= 2 && productResults.length === 0 && !productLoading && !productError && (
                      <div className="absolute z-50 w-full mt-1 rounded-md border border-border bg-card shadow-lg px-3 py-2 text-sm text-muted-foreground">
                        Sin resultados
                      </div>
                    )}
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-1">
                      <Label htmlFor="invoice-line_description" className="text-sm text-muted-foreground">Detalle línea</Label>
                      <FieldHelp label="Detalle de línea" meaning={HACIENDA_HELP.line_description} />
                    </div>
                    <Input id="invoice-line_description" value={initialData.line_description} onChange={(e) => onChange({ line_description: e.target.value })} placeholder="Descripción del bien o servicio" className="h-12 text-base bg-background border-border" />
                  </div>
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-1">
                      <Label htmlFor="invoice-tax_rate" className="text-sm text-muted-foreground">Impuesto %</Label>
                      <FieldHelp label="Impuesto" meaning={HACIENDA_HELP.tax_rate} />
                    </div>
                    <Input id="invoice-tax_rate" type="number" min="0" step="0.01" value={initialData.tax_rate} onChange={(e) => onChange({ tax_rate: e.target.value })} placeholder="13" className="h-12 text-base bg-background border-border" />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <div className="flex items-center gap-1">
                    <Label htmlFor="invoice-cabys_code" className="text-sm text-muted-foreground">CABYS</Label>
                    <FieldHelp label="CABYS" meaning={HACIENDA_HELP.cabys_code} />
                  </div>
                  <div className="relative">
                    <div className="flex items-center gap-1">
                      <Input
                        id="invoice-cabys_code" value={initialData.cabys_code}
                        onChange={(e) => {
                          const v = e.target.value;
                          onChange({ cabys_code: v });
                          setCabysQuery(v);
                          setCabysOpen(v.length >= 2);
                        }}
                        onFocus={() => { if (cabysQuery.length >= 2) setCabysOpen(true); }}
                        placeholder="Buscar código CABYS..."
                        className="h-12 text-base bg-background border-border pr-8"
                      />
                      {cabysLoading && <Loader2 className="absolute right-2.5 w-3.5 h-3.5 animate-spin text-muted-foreground" />}
                      {!cabysLoading && <Search className="absolute right-2.5 w-3.5 h-3.5 text-muted-foreground/40" />}
                    </div>
                    {cabysOpen && cabysError && <div role="alert"><p>No se pudo consultar CABYS.</p><Button type="button" variant="outline" className="min-h-11" onClick={retryCabys}>Reintentar CABYS</Button></div>}
                    {cabysOpen && !cabysError && !cabysLoading && !cabysResults.length && <p role="status">No hay resultados CABYS.</p>}
                    {cabysOpen && cabysResults.length > 0 && (
                      <div className="absolute z-50 w-full mt-1 max-h-44 overflow-y-auto rounded-md border border-border bg-card shadow-lg">
                        {cabysResults.map((r) => (
                          <button
                            key={r.codigo}
                            type="button"
                            className="min-h-12 w-full text-left px-3 py-2 text-sm hover:bg-accent/50 transition-colors border-b border-border/40 last:border-0"
                            onClick={() => {
                              onChange({ cabys_code: r.codigo });
                              setCabysOpen(false);
                            }}
                          >
                            <span className="font-medium text-foreground">{r.codigo}</span>{" "}
                            <span className="text-muted-foreground ml-2">{r.descripcion}</span>
                            {r.impuesto && <span className="text-sm text-muted-foreground ml-1"> ({r.impuesto}%)</span>}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>

          <Separator className="bg-border/60" />

          {/* Description */}
          <div className="space-y-1.5">
            <Label htmlFor="invoice-description" className="text-sm text-muted-foreground">Descripción</Label>
            <Textarea
              id="invoice-description" value={initialData.description}
              onChange={(e) => onChange({ description: e.target.value })}
              placeholder="Detalles opcionales de la factura"
              className="min-h-[96px] text-base bg-background border-border resize-none"
            />
          </div>
          {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
          {confirmDiscard && <div role="alert" className="space-y-3 rounded-xl border border-border p-4">
            <p>Hay cambios sin guardar.</p>
            <div className="flex flex-wrap gap-2">
              <Button ref={keepEditing} type="button" className="min-h-12" onClick={() => setConfirmDiscard(false)}>Seguir editando</Button>
              <Button type="button" variant="outline" className="min-h-12" onClick={() => { onChange(original.current); onOpenChange(false); }}>Descartar cambios</Button>
            </div>
          </div>}
        </fieldset>
        </div>

        <SheetFooter className="px-5 pt-3 pb-[max(12px,env(safe-area-inset-bottom))] border-t border-border shrink-0 flex-row gap-2 justify-between sm:justify-between">
          <Button type="button" variant="ghost" size="sm" onClick={() => close(false)} disabled={isSaving} className="h-12 text-base">
            Cancelar
          </Button>
          <Button
            size="sm"
            type="submit"
            disabled={isSaving || !initialData.contact_id || !initialData.number || !initialData.amount || !initialData.due_date}
            className="h-12 text-base gap-1.5"
          >
            {isSaving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            Crear factura
          </Button>
        </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}
