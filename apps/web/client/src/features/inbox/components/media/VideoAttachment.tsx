import { useState } from "react";
import { useMediaBlobUrl } from "@/hooks/use-media-blob-url";
import { getMediaProxyUrl, safeFileName } from "@/features/inbox/media-utils";
import { cn } from "@/lib/utils";
import { Loader2, AlertCircle, Film } from "lucide-react";

interface VideoAttachmentProps {
  messageId: string;
  caption?: string | null;
  className?: string;
}

export function VideoAttachment({ messageId, caption, className }: VideoAttachmentProps) {
  const mediaUrl = getMediaProxyUrl(messageId);
  const blobUrl = useMediaBlobUrl(mediaUrl);
  const [videoError, setVideoError] = useState(false);
  const [loading, setLoading] = useState(true);

  if (!blobUrl && !videoError) {
    return (
      <div className={cn("flex flex-col items-center gap-2", className)}>
        <div className="flex h-40 w-64 items-center justify-center rounded-lg bg-muted">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      </div>
    );
  }

  if (videoError || !blobUrl) {
    return (
      <div className={cn("flex items-center gap-2 rounded-lg border border-border/50 bg-card/50 px-3 py-2.5 text-sm text-muted-foreground", className)}>
        <Film className="h-4 w-4" />
        <span>Archivo de video</span>
      </div>
    );
  }

  return (
    <div className={cn("flex flex-col", className)}>
      <video
        src={blobUrl}
        controls
        className="max-h-64 max-w-full rounded-lg"
        onLoadedData={() => setLoading(false)}
        onError={() => {
          setVideoError(true);
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
        download={safeFileName("video")}
        className="mt-1 text-[11px] text-blue-400 hover:text-blue-300"
      >
        Descargar
      </a>
    </div>
  );
}
