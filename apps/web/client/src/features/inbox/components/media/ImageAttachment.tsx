import { useState } from "react";
import { useMediaBlobUrl } from "@/hooks/use-media-blob-url";
import { getMediaProxyUrl, safeFileName } from "@/features/inbox/media-utils";
import { cn } from "@/lib/utils";
import { Download, Loader2, AlertCircle, Search } from "lucide-react";
import { SensitiveText } from "@/components/shared/sensitive-text";

interface ImageAttachmentProps {
  messageId: string;
  caption?: string | null;
  mimeType?: string | null;
  className?: string;
}

export function ImageAttachment({ messageId, caption, mimeType, className }: ImageAttachmentProps) {
  const mediaUrl = getMediaProxyUrl(messageId);
  const { blobUrl, error, loading: hookLoading } = useMediaBlobUrl(mediaUrl);
  const [imgError, setImgError] = useState(false);

  if (hookLoading && !blobUrl) {
    return (
      <div className={cn("relative flex items-center justify-center h-40 w-full max-w-64 rounded-lg bg-muted/50", className)}>
        <Loader2 className="absolute inset-0 m-auto h-4 w-4 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (imgError || error || !blobUrl) {
    return (
      <div className={cn("flex items-center gap-2 rounded-lg border border-border/50 bg-card/50 px-3 py-2.5 text-sm text-muted-foreground", className)} role="alert">
        <AlertCircle className="h-4 w-4" />
        <span>No se pudo cargar la imagen</span>
      </div>
    );
  }

  return (
    <div className={cn("flex flex-col", className)}>
      <div className="relative group cursor-pointer" onClick={() => blobUrl && window.open(blobUrl, "_blank")}>
        <img
          src={blobUrl}
          alt={caption ?? "Imagen adjunta"}
          role="img"
          className="max-h-64 max-w-full rounded-lg object-contain"
          onError={() => setImgError(true)}
        />
        <div className="absolute inset-0 bg-black/30 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-3">
          <Search className="w-6 h-6 text-white" />
          <a
            href={blobUrl}
            download={safeFileName(mimeType ?? "image")}
            aria-label={`Descargar imagen: ${safeFileName(mimeType ?? "image")}`}
            className="p-2 rounded-full bg-white/20 hover:bg-white/30 text-white transition-colors"
            onClick={(e) => e.stopPropagation()}
          >
            <Download className="w-5 h-5" />
          </a>
        </div>
      </div>
      {caption && (
        <p className="mt-1.5 text-[11px] text-muted-foreground/80">
          <SensitiveText text={caption} />
        </p>
      )}
    </div>
  );
}
