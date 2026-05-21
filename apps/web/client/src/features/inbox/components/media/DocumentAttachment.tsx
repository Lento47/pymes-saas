import { useMediaBlobUrl } from "@/hooks/use-media-blob-url";
import { getMediaProxyUrl, safeFileName, formatFileSize } from "@/features/inbox/media-utils";
import { cn } from "@/lib/utils";
import { FileText, Download, Loader2, AlertCircle } from "lucide-react";
import { SensitiveText } from "@/components/shared/sensitive-text";

interface DocumentAttachmentProps {
  messageId: string;
  fileName?: string | null;
  mimeType?: string | null;
  sizeBytes?: number | null;
  caption?: string | null;
  className?: string;
}

function extractExtension(mimeType: string | null | undefined): string {
  if (!mimeType) return "";
  const parts = mimeType.split("/");
  if (parts.length < 2) return "";
  const sub = parts[1];
  const map: Record<string, string> = {
    pdf: "PDF",
    "msword": "DOC",
    "vnd.openxmlformats-officedocument.wordprocessingml.document": "DOCX",
    "vnd.ms-excel": "XLS",
    "vnd.openxmlformats-officedocument.spreadsheetml.sheet": "XLSX",
    "vnd.ms-powerpoint": "PPT",
    "vnd.openxmlformats-officedocument.presentationml.presentation": "PPTX",
    plain: "TXT",
    csv: "CSV",
    zip: "ZIP",
    "x-rar-compressed": "RAR",
    json: "JSON",
    xml: "XML",
    "x-zip-compressed": "ZIP",
  };
  return map[sub]?.toUpperCase() ?? sub.toUpperCase().slice(0, 6);
}

export function DocumentAttachment({
  messageId,
  fileName,
  mimeType,
  sizeBytes,
  caption,
  className,
}: DocumentAttachmentProps) {
  const mediaUrl = getMediaProxyUrl(messageId);
  const { blobUrl, error, loading } = useMediaBlobUrl(mediaUrl);

  const displayName = safeFileName(fileName);
  const ext = extractExtension(mimeType);

  if (loading && !blobUrl) {
    return (
      <div className={cn("flex items-center gap-2 rounded-xl border border-border/50 bg-card/70 px-3 py-2.5", className)}>
        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
        <span className="text-sm text-muted-foreground">Cargando…</span>
      </div>
    );
  }

  if (error || !blobUrl) {
    return (
      <div className={cn("flex items-center gap-2 rounded-xl border border-border/50 bg-card/70 px-3 py-2.5 text-sm text-muted-foreground", className)} role="alert">
        <AlertCircle className="h-4 w-4" />
        <span>No se pudo cargar el documento</span>
      </div>
    );
  }

  return (
    <div className={cn("group flex min-w-[230px] max-w-[360px] items-center gap-3 rounded-xl border border-border/55 bg-card/80 px-3 py-2.5 shadow-sm transition-all duration-150 hover:border-border/80 hover:bg-card", className)}>
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/[0.08] text-primary">
        <FileText className="h-5 w-5" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium leading-snug group-hover:text-primary/80">
          <SensitiveText text={displayName} />
        </p>
        <div className="flex items-center gap-2 text-[11px] text-muted-foreground/50">
          {ext && <span>{ext}</span>}
          {sizeBytes != null && <span>{formatFileSize(sizeBytes)}</span>}
        </div>
        {caption && (
          <p className="mt-1 line-clamp-2 text-[11px] leading-snug text-muted-foreground/80">
            <SensitiveText text={caption} />
          </p>
        )}
      </div>
      <a
        href={blobUrl}
        download={displayName}
        aria-label={`Descargar ${displayName}`}
        className="shrink-0 rounded-md p-1.5 text-muted-foreground/70 transition-colors hover:bg-accent hover:text-foreground"
      >
        <Download className="h-4 w-4" aria-hidden="true" />
      </a>
    </div>
  );
}
