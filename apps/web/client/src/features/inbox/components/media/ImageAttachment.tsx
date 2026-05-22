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
      <div className={cn("relative flex h-44 w-64 max-w-full items-center justify-center rounded-[14px] bg-muted/45", className)}>
        <Loader2 className="absolute inset-0 m-auto h-4 w-4 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (imgError || error || !blobUrl) {
    return (
      <div className={cn("flex items-center gap-2 rounded-[14px] border border-border/50 bg-card/60 px-3 py-2.5 text-sm text-muted-foreground", className)} role="alert">
        <AlertCircle className="h-4 w-4" />
        <span>No se pudo cargar la imagen</span>
      </div>
    );
  }

  return (
    <div className={cn("flex flex-col", className)}>
      <div className="group relative cursor-pointer overflow-hidden rounded-[14px]" onClick={() => blobUrl && window.open(blobUrl, "_blank")}>
        <img
          src={blobUrl}
          alt={caption ?? "Imagen adjunta"}
          role="img"
          className="max-h-72 max-w-full rounded-[14px] object-contain"
          onError={() => setImgError(true)}
        />
        <div className="absolute inset-0 flex items-center justify-center rounded-[14px] bg-black/20 opacity-0 transition-opacity group-hover:opacity-100">
          <div className="rounded-full bg-black/35 p-2 text-white backdrop-blur-sm">
            <Search className="h-4 w-4" />
          </div>
          <a
            href={blobUrl}
            download={safeFileName(mimeType ?? "image")}
            aria-label={`Descargar imagen: ${safeFileName(mimeType ?? "image")}`}
            className="absolute right-2 top-2 rounded-full bg-black/35 p-1.5 text-white/85 opacity-0 transition-all hover:bg-black/50 hover:text-white group-hover:opacity-100"
            onClick={(e) => e.stopPropagation()}
          >
            <Download className="h-3.5 w-3.5" />
          </a>
        </div>
      </div>
      {caption && (
        <p className="px-1 pt-1.5 text-[11px] leading-snug text-muted-foreground/80">
          <SensitiveText text={caption} />
        </p>
      )}
    </div>
  );
}
