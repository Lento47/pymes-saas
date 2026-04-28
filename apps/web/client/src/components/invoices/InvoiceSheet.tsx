import { useState } from "react";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Loader2, HelpCircle } from "lucide-react";
import { useI18n } from "@/components/providers/i18n-provider";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

const DOCUMENT_TYPES = ["FACTURA_ELECTRONICA", "TIQUETE_ELECTRONICO", "NOTA_CREDITO", "NOTA_DEBITO", "MENSAJE_RECEPTOR"];
const ISSUANCE_MODES = ["MANUAL_ONLY", "HACIENDA"];

function FieldHelp({ meaning }: { meaning: string }) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button type="button" className="inline-flex items-center justify-center w-4 h-4 rounded-full hover:bg-accent/50 transition-colors">
          <HelpCircle className="w-3 h-3 text-muted-foreground/60" />
        </button>
      </PopoverTrigger>
      <PopoverContent side="top" className="w-64 text-[11px] leading-relaxed text-muted-foreground bg-card border-border">
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
}

interface InvoiceSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contacts: any[];
  isContactsLoading: boolean;
  hasContactsError: boolean;
  initialData: InvoiceFormData;
  onSave: () => void;
  isSaving: boolean;
  onChange: (updates: Partial<InvoiceFormData>) => void;
}

export function InvoiceSheet({
  open, onOpenChange, contacts, isContactsLoading, hasContactsError,
  initialData, onSave, isSaving, onChange,
}: InvoiceSheetProps) {
  const { messages } = useI18n();
  const t = messages.invoices;
  const isHacienda = initialData.issuance_mode === "HACIENDA";

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-[580px] sm:max-w-[580px] p-0 gap-0 flex flex-col h-full">
        <SheetHeader className="px-6 py-4 border-b border-border/60 space-y-1 shrink-0">
          <SheetTitle className="text-sm font-semibold">Nueva factura</SheetTitle>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
          {/* Mode + Document type */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <div className="flex items-center gap-1">
                <Label className="text-[11px] text-muted-foreground">Modo</Label>
                <FieldHelp meaning={HACIENDA_HELP.issuance_mode} />
              </div>
              <Select value={initialData.issuance_mode} onValueChange={(v) => onChange({ issuance_mode: v })}>
                <SelectTrigger className="h-9 text-xs bg-background border-border">
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
                <Label className="text-[11px] text-muted-foreground">Documento</Label>
                <FieldHelp meaning={HACIENDA_HELP.document_type} />
              </div>
              <Select value={initialData.document_type} onValueChange={(v) => onChange({ document_type: v })}>
                <SelectTrigger className="h-9 text-xs bg-background border-border">
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

          {/* Contact */}
          <div className="space-y-1.5">
            <Label className="text-[11px] text-muted-foreground">Contacto <span className="text-red-400">*</span></Label>
            <Select
              value={initialData.contact_id}
              onValueChange={(v) => onChange({ contact_id: v })}
              disabled={isContactsLoading}
            >
              <SelectTrigger className="h-9 text-xs bg-background border-border">
                <SelectValue placeholder={
                  isContactsLoading ? "Cargando contactos..." :
                  hasContactsError ? "Error al cargar contactos" :
                  contacts.length ? "Seleccionar contacto" : "No hay contactos"
                } />
              </SelectTrigger>
              <SelectContent>
                {contacts.map((c: any) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.full_name}{c.company_name ? ` · ${c.company_name}` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {hasContactsError && (
              <p className="text-[10px] text-destructive">No pudimos cargar los contactos. Cierra y vuelve a abrir.</p>
            )}
            {!isContactsLoading && !contacts.length && !hasContactsError && (
              <p className="text-[10px] text-muted-foreground/60">No hay contactos creados todavía. Agrégalos desde Contactos.</p>
            )}
          </div>

          {/* Number + Currency */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <div className="flex items-center gap-1">
                <Label className="text-[11px] text-muted-foreground">{t.number}</Label>
                <FieldHelp meaning={HACIENDA_HELP.number} />
              </div>
              <Input
                value={initialData.number}
                onChange={(e) => onChange({ number: e.target.value })}
                placeholder="FAC-001"
                className="h-9 text-xs bg-background border-border"
              />
            </div>
            <div className="space-y-1.5">
              <div className="flex items-center gap-1">
                <Label className="text-[11px] text-muted-foreground">Moneda</Label>
                <FieldHelp meaning={HACIENDA_HELP.currency} />
              </div>
              <Input
                value={initialData.currency}
                onChange={(e) => onChange({ currency: e.target.value.toUpperCase() })}
                placeholder="USD"
                className="h-9 text-xs bg-background border-border"
              />
            </div>
          </div>

          {/* Amount + Due Date + Issue Date */}
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label className="text-[11px] text-muted-foreground">{t.amount} <span className="text-red-400">*</span></Label>
              <Input
                type="number"
                value={initialData.amount}
                onChange={(e) => onChange({ amount: e.target.value })}
                placeholder="0.00"
                className="h-9 text-xs bg-background border-border"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-[11px] text-muted-foreground">{t.dueDate} <span className="text-red-400">*</span></Label>
              <Input
                type="date"
                value={initialData.due_date}
                onChange={(e) => onChange({ due_date: e.target.value })}
                className="h-9 text-xs bg-background border-border"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-[11px] text-muted-foreground">Emisión</Label>
              <Input
                type="date"
                value={initialData.issue_date}
                onChange={(e) => onChange({ issue_date: e.target.value })}
                className="h-9 text-xs bg-background border-border"
              />
            </div>
          </div>

          <Separator className="bg-border/60" />

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
              <p className="text-[11px] text-muted-foreground/60 pl-7">
                Seleccioná el modo "Hacienda" para ver los campos fiscales requeridos para facturación electrónica.
              </p>
            ) : (
              <div className="space-y-3 pl-7">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-1">
                      <Label className="text-[11px] text-muted-foreground">Cond. venta</Label>
                      <FieldHelp meaning={HACIENDA_HELP.sale_condition} />
                    </div>
                    <Input value={initialData.sale_condition} onChange={(e) => onChange({ sale_condition: e.target.value })} placeholder="01" className="h-9 text-xs bg-background border-border" />
                  </div>
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-1">
                      <Label className="text-[11px] text-muted-foreground">Medio pago</Label>
                      <FieldHelp meaning={HACIENDA_HELP.payment_method} />
                    </div>
                    <Input value={initialData.payment_method} onChange={(e) => onChange({ payment_method: e.target.value })} placeholder="01" className="h-9 text-xs bg-background border-border" />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <div className="flex items-center gap-1">
                    <Label className="text-[11px] text-muted-foreground">Actividad</Label>
                    <FieldHelp meaning={HACIENDA_HELP.activity_code} />
                  </div>
                  <Input value={initialData.activity_code} onChange={(e) => onChange({ activity_code: e.target.value })} placeholder="Código de actividad" className="h-9 text-xs bg-background border-border" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-1">
                      <Label className="text-[11px] text-muted-foreground">Detalle línea</Label>
                      <FieldHelp meaning={HACIENDA_HELP.line_description} />
                    </div>
                    <Input value={initialData.line_description} onChange={(e) => onChange({ line_description: e.target.value })} placeholder="Descripción del bien o servicio" className="h-9 text-xs bg-background border-border" />
                  </div>
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-1">
                      <Label className="text-[11px] text-muted-foreground">Impuesto %</Label>
                      <FieldHelp meaning={HACIENDA_HELP.tax_rate} />
                    </div>
                    <Input value={initialData.tax_rate} onChange={(e) => onChange({ tax_rate: e.target.value })} placeholder="13" className="h-9 text-xs bg-background border-border" />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <div className="flex items-center gap-1">
                    <Label className="text-[11px] text-muted-foreground">CABYS</Label>
                    <FieldHelp meaning={HACIENDA_HELP.cabys_code} />
                  </div>
                  <Input value={initialData.cabys_code} onChange={(e) => onChange({ cabys_code: e.target.value })} placeholder="Código CABYS" className="h-9 text-xs bg-background border-border" />
                </div>
              </div>
            )}
          </div>

          <Separator className="bg-border/60" />

          {/* Description */}
          <div className="space-y-1.5">
            <Label className="text-[11px] text-muted-foreground">Descripción</Label>
            <Textarea
              value={initialData.description}
              onChange={(e) => onChange({ description: e.target.value })}
              placeholder="Detalles opcionales de la factura"
              className="min-h-[60px] text-xs bg-background border-border resize-none"
            />
          </div>
        </div>

        <SheetFooter className="px-6 py-3 border-t border-border/60 shrink-0 flex-row justify-between sm:justify-between">
          <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)} disabled={isSaving} className="h-8 text-xs">
            Cancelar
          </Button>
          <Button
            size="sm"
            onClick={onSave}
            disabled={isSaving || !initialData.contact_id || !initialData.number || !initialData.amount || !initialData.due_date}
            className="h-8 text-xs gap-1.5"
          >
            {isSaving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            Crear factura
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
