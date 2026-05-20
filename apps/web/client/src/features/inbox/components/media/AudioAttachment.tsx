import { useMediaBlobUrl } from "@/hooks/use-media-blob-url";
import { getMediaProxyUrl } from "@/features/inbox/media-utils";
import { cn } from "@/lib/utils";
import { Loader2, AlertCircle, Music } from "lucide-react";
import { SensitiveText } from "@/components/shared/sensitive-text";

interface AudioAttachmentProps {
  messageId: string;
  caption?: string | null;
  durationMs?: number | null;
  className?: string;
}

function formatDuration(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

export function AudioAttachment({ messageId, caption, durationMs, className }: AudioAttachmentProps) {
  const mediaUrl = getMediaProxyUrl(messageId);
  const { blobUrl, error, loading } = useMediaBlobUrl(mediaUrl);

  if (loading && !blobUrl) {
    return (
      <div className={cn("flex items-center gap-2", className)}>
        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error || !blobUrl) {
    return (
      <div className={cn("flex items-center gap-2 rounded-lg border border-border/50 bg-card/50 px-3 py-2.5 text-sm text-muted-foreground", className)} role="alert">
        <AlertCircle className="h-4 w-4" />
        <span>No se pudo cargar el audio</span>
      </div>
    );
  }

  return (
    <div className={cn("flex flex-col", className)}>
      {caption && (
        <p className="mb-1.5 text-[11px] text-muted-foreground/80">
          <SensitiveText text={caption} />
        </p>
      )}
      <div className="flex items-center gap-2 max-w-xs">
        <Music className="w-4 h-4 text-muted-foreground shrink-0" />
        <div className="border border-border/50 bg-card/50 rounded-lg px-3 py-2 flex-1">
          <audio
            src={blobUrl}
            className="w-full h-8 rounded"
            controls
          />
        </div>
        {durationMs && (
          <span className="shrink-0 text-[11px] text-muted-foreground/70 tabular-nums">
            {formatDuration(durationMs)}
          </span>
        )}
      </div>
    </div>
  );
}
