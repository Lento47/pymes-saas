import { useMediaBlobUrl } from "@/hooks/use-media-blob-url";
import { getMediaProxyUrl, safeFileName, formatFileSize } from "@/features/inbox/media-utils";
import { cn } from "@/lib/utils";
import { FileText, Download, Loader2, AlertCircle } from "lucide-react";

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
  const blobUrl = useMediaBlobUrl(mediaUrl);

  const displayName = safeFileName(fileName);
  const ext = extractExtension(mimeType);

  if (!blobUrl) {
    return (
      <div className={cn("flex items-center gap-2 rounded-lg border border-border/50 bg-card/50 px-3 py-2.5", className)}>
        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
        <span className="text-sm text-muted-foreground">Cargando…</span>
      </div>
    );
  }

  return (
    <div className={cn("flex items-center gap-3 rounded-lg border border-border/50 bg-card/50 px-3 py-2.5", className)}>
      <FileText className="h-6 w-6 shrink-0 text-muted-foreground" />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{displayName}</p>
        <div className="flex items-center gap-2 text-[11px] text-muted-foreground/70">
          {ext && <span>{ext}</span>}
          {sizeBytes != null && <span>{formatFileSize(sizeBytes)}</span>}
        </div>
        {caption && (
          <p className="mt-0.5 text-[11px] text-muted-foreground/80">{caption}</p>
        )}
      </div>
      <a
        href={blobUrl}
        download={displayName}
        className="shrink-0 rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
        title="Descargar"
      >
        <Download className="h-4 w-4" />
      </a>
    </div>
  );
}
