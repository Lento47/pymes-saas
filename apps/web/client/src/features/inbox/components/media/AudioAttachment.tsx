import { useMediaBlobUrl } from "@/hooks/use-media-blob-url";
import { getMediaProxyUrl } from "@/features/inbox/media-utils";
import { cn } from "@/lib/utils";
import { Loader2, AlertCircle } from "lucide-react";

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
  const blobUrl = useMediaBlobUrl(mediaUrl);

  if (!blobUrl) {
    return (
      <div className={cn("flex flex-col items-center gap-2", className)}>
        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className={cn("flex flex-col", className)}>
      {caption && (
        <p className="mb-1.5 text-[11px] text-muted-foreground/80">{caption}</p>
      )}
      <div className="flex items-center gap-2 rounded-lg bg-black/20 px-3 py-2">
        <audio
          src={blobUrl}
          className="h-8 w-full max-w-[280px]"
          controls
        />
        {durationMs && (
          <span className="shrink-0 text-[11px] text-muted-foreground/70">
            {formatDuration(durationMs)}
          </span>
        )}
      </div>
    </div>
  );
}
