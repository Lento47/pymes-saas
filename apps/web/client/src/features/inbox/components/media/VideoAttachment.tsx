import { useState } from "react";
import { useMediaBlobUrl } from "@/hooks/use-media-blob-url";
import { getMediaProxyUrl, safeFileName } from "@/features/inbox/media-utils";
import { cn } from "@/lib/utils";
import { Loader2, AlertCircle, Film } from "lucide-react";
import { SensitiveText } from "@/components/shared/sensitive-text";

interface VideoAttachmentProps {
  messageId: string;
  caption?: string | null;
  mimeType?: string | null;
  className?: string;
}

export function VideoAttachment({ messageId, caption, mimeType, className }: VideoAttachmentProps) {
  const mediaUrl = getMediaProxyUrl(messageId);
  const { blobUrl, error, loading: hookLoading } = useMediaBlobUrl(mediaUrl);
  const [videoError, setVideoError] = useState(false);

  if (hookLoading && !blobUrl && !videoError) {
    return (
      <div className={cn("relative flex items-center justify-center h-40 w-full max-w-64 rounded-lg bg-muted/50", className)}>
        <Loader2 className="absolute inset-0 m-auto h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (videoError || error || !blobUrl) {
    return (
      <div className={cn("flex items-center gap-2 rounded-lg border border-border/50 bg-card/50 px-3 py-2.5 text-sm text-muted-foreground", className)} role="alert">
        <Film className="h-4 w-4" />
        <span>No se pudo cargar el video</span>
      </div>
    );
  }

  return (
    <div className={cn("flex flex-col", className)}>
      <video
        src={blobUrl}
        controls
        playsInline
        preload="metadata"
        className="max-h-64 max-w-full rounded-lg"
        onError={() => setVideoError(true)}
      />
      {caption && (
        <p className="mt-1.5 text-[11px] text-muted-foreground/80">
          <SensitiveText text={caption} />
        </p>
      )}
      <a
        href={blobUrl}
        download={safeFileName(mimeType ?? "video")}
        aria-label="Descargar video"
        className="mt-1 text-[11px] text-primary hover:text-primary/80 transition-colors"
      >
        Descargar
      </a>
    </div>
  );
}
