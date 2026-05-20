import { useState } from "react";
import { useMediaBlobUrl } from "@/hooks/use-media-blob-url";
import { getMediaProxyUrl, safeFileName, formatFileSize } from "@/features/inbox/media-utils";
import { cn } from "@/lib/utils";
import { FileText, Download, Loader2, AlertCircle } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

interface ImageAttachmentProps {
  messageId: string;
  caption?: string | null;
  mimeType?: string | null;
  className?: string;
}

export function ImageAttachment({ messageId, caption, mimeType, className }: ImageAttachmentProps) {
  const mediaUrl = getMediaProxyUrl(messageId);
  const blobUrl = useMediaBlobUrl(mediaUrl);
  const [imgError, setImgError] = useState(false);
  const [loading, setLoading] = useState(true);

  if (!blobUrl && !imgError) {
    return (
      <div className={cn("flex flex-col items-center gap-2", className)}>
        <Skeleton className="h-40 w-64 rounded-lg" />
        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (imgError || !blobUrl) {
    return (
      <div className={cn("flex items-center gap-2 rounded-lg border border-border/50 bg-card/50 px-3 py-2.5 text-sm text-muted-foreground", className)}>
        <AlertCircle className="h-4 w-4" />
        <span>No se pudo cargar la imagen</span>
      </div>
    );
  }

  return (
    <div className={cn("flex flex-col", className)}>
      <img
        src={blobUrl}
        alt={caption ?? safeFileName(mimeType ?? "image")}
        className="max-h-64 max-w-full rounded-lg object-contain"
        onLoad={() => setLoading(false)}
        onError={() => {
          setImgError(true);
          setLoading(false);
        }}
      />
      {loading && (
        <div className="flex justify-center py-2">
          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
        </div>
      )}
      {caption && (
        <p className="mt-1.5 text-[11px] text-muted-foreground/80">{caption}</p>
      )}
      <a
        href={blobUrl}
        download={safeFileName(mimeType ?? "image")}
        className="mt-1 text-[11px] text-blue-400 hover:text-blue-300"
      >
        Descargar
      </a>
    </div>
  );
}
