import { useRef, useState, useEffect } from "react";
import { useMediaBlobUrl } from "@/hooks/use-media-blob-url";
import { getMediaProxyUrl } from "@/features/inbox/media-utils";
import { cn } from "@/lib/utils";
import { Play, Pause, Loader2, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

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
  const audioRef = useRef<HTMLAudioElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const onPlay = () => setIsPlaying(true);
    const onPause = () => setIsPlaying(false);
    const onEnded = () => setIsPlaying(false);

    audio.addEventListener("play", onPlay);
    audio.addEventListener("pause", onPause);
    audio.addEventListener("ended", onEnded);

    return () => {
      audio.removeEventListener("play", onPlay);
      audio.removeEventListener("pause", onPause);
      audio.removeEventListener("ended", onEnded);
    };
  }, []);

  const togglePlay = () => {
    const audio = audioRef.current;
    if (!audio) return;
    if (isPlaying) {
      audio.pause();
    } else {
      audio.play();
    }
  };

  if (!blobUrl && !error) {
    return (
      <div className={cn("flex flex-col items-center gap-2", className)}>
        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error || !blobUrl) {
    return (
      <div className={cn("flex items-center gap-2 rounded-lg border border-border/50 bg-card/50 px-3 py-2.5 text-sm text-muted-foreground", className)}>
        <AlertCircle className="h-4 w-4" />
        <span>No se pudo cargar el audio</span>
      </div>
    );
  }

  return (
    <div className={cn("flex flex-col", className)}>
      {caption && (
        <p className="mb-1.5 text-[11px] text-muted-foreground/80">{caption}</p>
      )}
      <div className="flex items-center gap-2 rounded-lg bg-black/20 px-3 py-2">
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 shrink-0"
          onClick={togglePlay}
        >
          {isPlaying ? (
            <Pause className="h-3.5 w-3.5" />
          ) : (
            <Play className="h-3.5 w-3.5" />
          )}
        </Button>
        <audio
          ref={audioRef}
          src={blobUrl}
          className="h-8 w-full max-w-[280px]"
          controls
          onLoadedData={() => setLoading(false)}
          onError={() => {
            setError(true);
            setLoading(false);
          }}
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
