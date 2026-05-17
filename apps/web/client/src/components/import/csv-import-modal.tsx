import { useState, useRef, useCallback } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { api, getAuthToken } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Upload, Loader2, Check, AlertTriangle, ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  open: boolean;
  onClose: () => void;
  entityType: "contacts" | "invoices" | "pipeline" | "products";
}

const CONTACT_FIELDS: { key: string; label: string }[] = [
  { key: "full_name", label: "Nombre completo" },
  { key: "email", label: "Email" },
  { key: "phone", label: "Teléfono" },
  { key: "company_name", label: "Empresa" },
  { key: "tags", label: "Etiquetas" },
];

const PRODUCT_FIELDS: { key: string; label: string }[] = [
  { key: "name", label: "Nombre" },
  { key: "sku", label: "SKU" },
  { key: "unit_price", label: "Precio Unitario" },
  { key: "cost_price", label: "Costo" },
  { key: "current_stock", label: "Stock Actual" },
  { key: "min_stock", label: "Stock Mínimo" },
  { key: "category", label: "Categoría" },
  { key: "unit_of_measure", label: "Unidad de Medida" },
  { key: "description", label: "Descripción" },
];

export default function CsvImportModal({ open, onClose, entityType }: Props) {
  const { user } = useAuth();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [step, setStep] = useState<"upload" | "map" | "preview" | "done">("upload");
  const [file, setFile] = useState<File | null>(null);
  const [headers, setHeaders] = useState<string[]>([]);
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [previewRows, setPreviewRows] = useState<Record<string, string>[]>([]);
  const [allRows, setAllRows] = useState<Record<string, string>[]>([]);
  const [result, setResult] = useState<{ imported: number; skipped: number; \1: Record<string, any>[] } | null>(null);
  const workspaceId = user?.workspace?.id ?? "";
  const entityLabel = entityType === "products" ? "Productos" : entityType === "invoices" ? "Facturas" : entityType === "pipeline" ? "Pipeline" : "Contactos";
  const fields = entityType === "products" ? PRODUCT_FIELDS : CONTACT_FIELDS;

  const parseMutation = useMutation({
    mutationFn: async (f: File) => {
      const form = new FormData();
      form.append("file", f);
      const token = getAuthToken();
      const res = await fetch(`/api/import/${entityType}/parse/${workspaceId}`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: form,
      });
      if (!res.ok) throw new Error("Error al analizar CSV");
      return res.json();
    },
    onSuccess: (data) => {
      setHeaders(data.headers);
      setPreviewRows(data.rows);
      setAllRows(data.rows);
      setMapping(data.suggestedMapping ?? {});
      setStep("map");
    },
    onError: () => toast({ title: "Error", description: "No se pudo analizar el CSV", variant: "destructive" }),
  });

  const confirmMutation = useMutation({
    mutationFn: async () => {
      const token = getAuthToken();
      const res = await fetch(`/api/import/${entityType}/confirm/${workspaceId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ mapping, rows: allRows }),
      });
      if (!res.ok) throw new Error("Error al importar");
      return res.json();
    },
    onSuccess: (data) => {
      setResult(data);
      setStep("done");
      toast({ title: `${data.imported} ${entityType === "products" ? "productos" : "contactos"} importados` });
    },
    onError: () => toast({ title: "Error", description: "Fallo la importación", variant: "destructive" }),
  });

  const handleFileDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const f = e.dataTransfer.files[0];
    if (f?.name.endsWith(".csv")) { setFile(f); parseMutation.mutate(f); }
  }, [parseMutation]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) { setFile(f); parseMutation.mutate(f); }
  };

  const reset = () => {
    setStep("upload"); setFile(null); setHeaders([]); setMapping({}); setPreviewRows([]); setAllRows([]); setResult(null);
  };

  const availableFields = fields.filter((f) => !Object.values(mapping).includes(headers.find((h) => h) ?? ""));

  return (
    <Dialog open={open} onOpenChange={() => { onClose(); reset(); }}>
      <DialogContent className="bg-card border-border max-w-2xl">
        <DialogHeader><DialogTitle className="text-foreground">Importar {entityLabel} desde CSV</DialogTitle></DialogHeader>

        {/* Step 1: Upload */}
        {step === "upload" && (
          <div
            onDragOver={(e) => e.preventDefault()}
            onDrop={handleFileDrop}
            onClick={() => fileInputRef.current?.click()}
            className="flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed border-border p-10 cursor-pointer hover:border-primary/50 transition-colors"
          >
            <Upload className="w-8 h-8 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">Arrastra un archivo CSV o haz clic para seleccionar</p>
            <input ref={fileInputRef} type="file" accept=".csv" onChange={handleFileSelect} className="hidden" />
            {parseMutation.isPending && <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />}
          </div>
        )}

        {/* Step 2: Column Mapping */}
        {step === "map" && (
          <div className="space-y-4">
            <p className="text-xs text-muted-foreground">Asigna las columnas del CSV a los campos de PymesHub:</p>
            <div className="grid gap-2">
              {fields.map((field) => (
                <div key={field.key} className="flex items-center gap-3">
                  <span className="text-xs text-muted-foreground w-32">{field.label}</span>
                  <span className="text-xs text-foreground">←</span>
                  <Select
                    value={mapping[field.key] ?? ""}
                    onValueChange={(v) => setMapping((prev) => ({ ...prev, [field.key]: v === "__none__" ? undefined! : v }))}
                  >
                    <SelectTrigger className="w-48 h-8 text-xs bg-[hsl(var(--elevated))] border-border">
                      <SelectValue placeholder="Seleccionar columna" />
                    </SelectTrigger>
                    <SelectContent className="bg-card border-border">
                      <SelectItem value="__none__" className="text-xs text-muted-foreground">— Ignorar —</SelectItem>
                      {headers.map((h) => (
                        <SelectItem key={h} value={h} className="text-xs">{h}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ))}
            </div>
            <Button onClick={() => setStep("preview")} size="sm" className="gap-1.5">
              Continuar <ArrowRight className="w-3.5 h-3.5" />
            </Button>
          </div>
        )}

        {/* Step 3: Preview */}
        {step === "preview" && (
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="text-[9px]">{previewRows.length} filas (vista previa)</Badge>
              <Badge variant="outline" className="text-[9px]">{allRows.length} total</Badge>
            </div>
            <div className="rounded-lg border border-border overflow-hidden max-h-48 overflow-y-auto">
              <table className="w-full text-xs">
                <thead className="bg-[hsl(var(--elevated))] sticky top-0">
                  <tr>{fields.filter((f) => mapping[f.key]).map((f) => (
                    <th key={f.key} className="text-left px-3 py-2 text-muted-foreground">{f.label}</th>
                  ))}</tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {previewRows.map((row, i) => (
                    <tr key={i}>
                      {fields.filter((f) => mapping[f.key]).map((f) => (
                        <td key={f.key} className="px-3 py-1.5 text-foreground truncate max-w-[200px]">{row[mapping[f.key]] ?? "—"}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => setStep("map")}>Volver</Button>
              <Button onClick={() => confirmMutation.mutate()} disabled={confirmMutation.isPending} size="sm" className="gap-1.5">
                {confirmMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
                Importar {allRows.length} {entityType === "products" ? "productos" : entityType === "invoices" ? "facturas" : "contactos"}
              </Button>
            </div>
          </div>
        )}

        {/* Step 4: Done */}
        {step === "done" && result && (
          <div className="space-y-3 text-center py-4">
            <Check className="w-8 h-8 text-emerald-400 mx-auto" />
            <p className="text-sm text-foreground">
              <span className="font-semibold text-emerald-400">{result.imported}</span> importados,{" "}
              <span className="text-amber-400">{result.skipped}</span> omitidos
            </p>
            {result.errors.length > 0 && (
              <div className="text-left rounded-lg border border-border p-3 max-h-32 overflow-y-auto">
                {result.errors.map((e: Record<string, any>, i: number) => (
                  <div key={i} className="flex items-start gap-1.5 text-[11px] text-muted-foreground">
                    <AlertTriangle className="w-3 h-3 text-amber-400 flex-shrink-0 mt-0.5" />
                    Fila {e.row}: {e.reason}
                  </div>
                ))}
              </div>
            )}
            <Button variant="outline" size="sm" onClick={() => { onClose(); reset(); }}>Cerrar</Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
