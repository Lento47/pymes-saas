import { useState, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { apiErrorDescription } from "@/lib/api-error";
import { queryClient } from "@/lib/queryClient";
import { useRequireAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { PageHeader } from "@/components/shared/page-header";
import { DiagnosticButton } from "@/components/shared/diagnostic-button";
import { HelpButton } from "@/components/shared/help-button";
import { StatusBadge } from "@/components/shared/status-badge";
import { PageLoader } from "@/components/shared/loading-spinner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { FileText, FileImage, FileSpreadsheet, Upload, Search, Loader2, MoreHorizontal, Trash, Download, CloudUpload } from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";
import { cn } from "@/lib/utils";

const STATUS_OPTIONS = ["ALL", "UPLOADED", "PROCESSING", "PROCESSED", "FAILED"];

const STATUS_LABELS: Record<string, string> = {
  ALL: "Todo estado",
  UPLOADED: "Subido",
  PROCESSING: "Procesando",
  PROCESSED: "Procesado",
  FAILED: "Error",
};

function getFileIcon(mimeType?: string) {
  if (!mimeType) return <FileText className="w-4 h-4 text-muted-foreground/60" />;
  if (mimeType.includes("image")) return <FileImage className="w-4 h-4 text-blue-400" />;
  if (mimeType.includes("pdf")) return <FileText className="w-4 h-4 text-red-400" />;
  if (mimeType.includes("sheet") || mimeType.includes("excel") || mimeType.includes("csv"))
    return <FileSpreadsheet className="w-4 h-4 text-emerald-400" />;
  if (mimeType.includes("word") || mimeType.includes("document"))
    return <FileText className="w-4 h-4 text-blue-400" />;
  return <FileText className="w-4 h-4 text-muted-foreground/60" />;
}

function getMimeLabel(mimeType?: string) {
  if (!mimeType) return "—";
  if (mimeType.includes("pdf")) return "PDF";
  if (mimeType.includes("image/png")) return "PNG";
  if (mimeType.includes("image/jpeg")) return "JPG";
  if (mimeType.includes("image/")) return "Imagen";
  if (mimeType.includes("sheet") || mimeType.includes("excel")) return "Excel";
  if (mimeType.includes("csv")) return "CSV";
  if (mimeType.includes("word") || mimeType.includes("document")) return "Word";
  return mimeType.split("/")[1]?.toUpperCase() || "—";
}

function formatBytes(bytes?: number) {
  if (!bytes) return null;
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function DocumentsPage() {
  useRequireAuth();
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const params: Record<string, string> = {};
  if (search) params.search = search;
  if (statusFilter !== "ALL") params.status = statusFilter;

  const { data, isLoading } = useQuery({
    queryKey: ["/api/documents", statusFilter, search],
    queryFn: () => api.getDocuments(Object.keys(params).length ? params : undefined),
  });

  const uploadMutation = useMutation({
    mutationFn: (file: File) => {
      const formData = new FormData();
      formData.append("file", file);
      return api.uploadDocument(formData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/documents"] });
      toast({ title: "Archivo subido correctamente" });
    },
    onError: (err) => {
      toast({ title: "Error al subir", description: apiErrorDescription(err), variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.deleteDocument(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/documents"] });
      toast({ title: "Archivo eliminado" });
    },
    onError: (err) => {
      toast({ title: "Error al eliminar", description: apiErrorDescription(err), variant: "destructive" });
    },
  });

  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  const handleDownload = async (doc: Record<string, any>) => {
    try {
      setDownloadingId(doc.id);
      const full = await api.getDocument(doc.id);
      if (full?.download_url) {
        const a = document.createElement("a");
        a.href = full.download_url;
        a.download = doc.file_name || doc.filename || doc.name || "archivo";
        a.target = "_blank";
        a.rel = "noopener noreferrer";
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
      } else {
        toast({ title: "No se pudo obtener la URL de descarga", variant: "destructive" });
      }
    } catch (err: unknown) {
      toast({ title: "Error al descargar", description: apiErrorDescription(err), variant: "destructive" });
    } finally {
      setDownloadingId(null);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) { uploadMutation.mutate(file); e.target.value = ""; }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) uploadMutation.mutate(file);
  };

  const docList = Array.isArray(data) ? data : data?.data || [];

  return (
    <div>
      <PageHeader title="Archivos" description="Sube y gestiona documentos del workspace">
        <Button
          size="sm"
          className="h-8 text-xs"
          onClick={() => fileInputRef.current?.click()}
          disabled={uploadMutation.isPending}
          data-testid="button-upload-document"
        >
          {uploadMutation.isPending
            ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
            : <Upload className="w-3.5 h-3.5 mr-1.5" />}
          Subir archivo
        </Button>
        <input
          ref={fileInputRef}
          type="file"
          className="hidden"
          accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png,.csv"
          onChange={handleFileChange}
          data-testid="input-file-upload"
        />
      </PageHeader>

      <div className="px-6 pb-2">
        <DiagnosticButton module="documents" />
      </div>

      <div className="px-4 md:px-6 py-4 space-y-4">
      {/* Drag & drop zone — only shown when no docs or uploading */}
      {(docList.length === 0 && !isLoading) && (
        <div
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className={cn(
            "mb-4 border-2 border-dashed rounded-xl p-10 flex flex-col items-center gap-3 cursor-pointer transition-colors",
            dragOver ? "border-primary/60 bg-primary/5" : "border-border hover:border-border/80 hover:bg-foreground/[0.015]"
          )}
        >
          <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center">
            {uploadMutation.isPending
              ? <Loader2 className="w-5 h-5 animate-spin text-muted-foreground/60" />
              : <CloudUpload className="w-5 h-5 text-muted-foreground/60" />}
          </div>
          <div className="text-center">
            <p className="text-sm font-medium text-foreground">
              {uploadMutation.isPending ? "Subiendo archivo..." : "Arrastra un archivo aquí"}
            </p>
            <p className="text-xs text-muted-foreground/60 mt-0.5">o haz clic para seleccionar — PDF, Word, Excel, imágenes</p>
          </div>
        </div>
      )}

      {/* Filters */}
      {docList.length > 0 && (
        <div className="flex items-center gap-2 mb-4 flex-wrap">
          <div className="relative flex-1 min-w-[180px] max-w-[280px]">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground/60" />
            <Input
              placeholder="Buscar archivos..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8 h-8 text-xs bg-card border-border"
              data-testid="input-search-documents"
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[140px] h-8 text-xs bg-card border-border" data-testid="select-doc-status">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {STATUS_OPTIONS.map((s) => (
                <SelectItem key={s} value={s}>{STATUS_LABELS[s]}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          {(statusFilter !== "ALL" || search) && (
            <Button
              variant="ghost"
              size="sm"
              className="h-8 text-xs text-muted-foreground/60"
              onClick={() => { setStatusFilter("ALL"); setSearch(""); }}
            >
              Limpiar
            </Button>
          )}
          <div className="ml-auto">
            <Button
              size="sm"
              variant="outline"
              className="h-8 text-xs"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploadMutation.isPending}
            >
              {uploadMutation.isPending
                ? <Loader2 className="w-3 h-3 mr-1.5 animate-spin" />
                : <Upload className="w-3 h-3 mr-1.5" />}
              Subir
            </Button>
          </div>
        </div>
      )}

      {isLoading ? (
        <PageLoader />
      ) : docList.length === 0 && (search || statusFilter !== "ALL") ? (
        <div className="text-center py-12 text-muted-foreground/60 text-sm">
          No se encontraron archivos con ese filtro.
        </div>
      ) : docList.length > 0 ? (
        <div className="rounded-lg border border-border overflow-x-auto bg-card">
          <Table>
            <TableHeader>
              <TableRow className="border-border hover:bg-transparent">
                <TableHead className="text-[11px] text-muted-foreground/60 font-medium">Archivo</TableHead>
                <TableHead className="text-[11px] text-muted-foreground/60 font-medium">Tipo</TableHead>
                <TableHead className="text-[11px] text-muted-foreground/60 font-medium">Estado</TableHead>
                <TableHead className="text-[11px] text-muted-foreground/60 font-medium">Subido por</TableHead>
                <TableHead className="text-[11px] text-muted-foreground/60 font-medium">Fecha</TableHead>
                <TableHead className="w-12" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {docList.map((doc: any) => {
                const mime = doc.mimeType || doc.mime_type;
                const dateStr = doc.createdAt || doc.created_at;
                const uploaderName = doc.uploadedBy?.firstName || doc.uploaded_by?.firstName;
                const fileSize = formatBytes(doc.file_size || doc.fileSize);

                return (
                  <TableRow key={doc.id} className="border-border hover:bg-foreground/[0.015]" data-testid={`doc-row-${doc.id}`}>
                    <TableCell>
                      <div className="flex items-center gap-2.5">
                        {getFileIcon(mime)}
                        <div>
                          <button
                            className="text-sm text-foreground hover:text-primary hover:underline text-left leading-tight"
                            onClick={() => handleDownload(doc)}
                          >
                            {doc.file_name || doc.filename || doc.name || "Sin nombre"}
                          </button>
                          {fileSize && <div className="text-[10px] text-muted-foreground/60">{fileSize}</div>}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className="text-xs text-muted-foreground/60">{getMimeLabel(mime)}</span>
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={doc.status} type="document" />
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground/60">
                      {uploaderName || "—"}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground/60">
                      {dateStr ? (
                        <span title={format(new Date(dateStr), "dd/MM/yyyy HH:mm")}>
                          {formatDistanceToNow(new Date(dateStr), { addSuffix: true, locale: es })}
                        </span>
                      ) : "—"}
                    </TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" className="h-8 w-8 p-0" data-testid={`button-document-options-${doc.id}`}>
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => handleDownload(doc)} disabled={downloadingId === doc.id}>
                            {downloadingId === doc.id
                              ? <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                              : <Download className="w-4 h-4 mr-2" />}
                            Descargar
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            className="text-destructive focus:text-destructive"
                            onClick={() => deleteMutation.mutate(doc.id)}
                          >
                            <Trash className="w-4 h-4 mr-2" />
                            Eliminar
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      ) : null}
      </div>{/* end px-4 content wrapper */}
      <HelpButton page="Documentos" />
    </div>
  );
}
