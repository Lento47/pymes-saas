import { useState, useRef, useEffect, useCallback } from "react";
import { useMediaBlobUrl } from "@/hooks/use-media-blob-url";
import { getMediaProxyUrl } from "@/features/inbox/media-utils";
import { cn } from "@/lib/utils";
import { Loader2, AlertCircle, Play, Pause } from "lucide-react";
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
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [audioDuration, setAudioDuration] = useState(durationMs ? durationMs / 1000 : 0);
  const audioRef = useRef<HTMLAudioElement>(null);
  const progressRef = useRef<HTMLDivElement>(null);

  const togglePlay = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;
    if (audio.paused) {
      audio.play();
    } else {
      audio.pause();
    }
  }, []);

  const handleTimeUpdate = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;
    setCurrentTime(audio.currentTime);
    if (audio.duration && !audioDuration) {
      setAudioDuration(audio.duration);
    }
  }, [audioDuration]);

  const handleEnded = useCallback(() => {
    setPlaying(false);
    setCurrentTime(0);
  }, []);

  const progress = audioDuration > 0 ? (currentTime / audioDuration) * 100 : 0;
  const displayTime = audioDuration > 0 ? formatDuration((audioDuration - currentTime) * 1000) : durationMs ? formatDuration(durationMs) : "0:00";
  const waveform = [30, 52, 36, 70, 44, 82, 55, 38, 64, 48, 76, 42, 58, 34, 68, 46, 72, 40];

  if (loading && !blobUrl) {
    return (
      <div className={cn("flex min-w-[220px] items-center gap-2", className)}>
        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error || !blobUrl) {
    return (
      <div className={cn("flex items-center gap-2 rounded-full border border-border/50 bg-card/60 px-3 py-2.5 text-sm text-muted-foreground", className)} role="alert">
        <AlertCircle className="h-4 w-4" />
        <span>No se pudo cargar el audio</span>
      </div>
    );
  }

  return (
    <div className={cn("flex flex-col", className)}>
      {caption && (
        <p className="mb-1.5 px-1 text-[11px] leading-snug text-muted-foreground/80">
          <SensitiveText text={caption} />
        </p>
      )}
      <div className="inline-flex min-w-[220px] max-w-[320px] items-center gap-3">
        <button
          onClick={togglePlay}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-sm transition-all hover:bg-primary/90 active:scale-95"
          aria-label={playing ? "Pausar" : "Reproducir"}
        >
          {playing ? (
            <Pause className="w-4 h-4" />
          ) : (
            <Play className="w-4 h-4 ml-0.5" />
          )}
        </button>
        <div className="flex-1 min-w-0">
          <div
            ref={progressRef}
            className="group relative h-8 cursor-pointer overflow-hidden rounded-full"
            onClick={(e) => {
              const rect = e.currentTarget.getBoundingClientRect();
              const ratio = (e.clientX - rect.left) / rect.width;
              const audio = audioRef.current;
              if (audio && audioDuration > 0) {
                audio.currentTime = ratio * audioDuration;
              }
            }}
          >
            <div className="absolute inset-x-0 top-1/2 flex -translate-y-1/2 items-center gap-0.5">
              {waveform.map((height, index) => (
                <span
                  key={index}
                  className="w-1 flex-1 rounded-full bg-muted-foreground/25"
                  style={{ height: `${height}%` }}
                />
              ))}
            </div>
            <div className="absolute inset-y-0 left-0 overflow-hidden transition-[width] duration-100" style={{ width: `${progress}%` }}>
              <div className="flex h-full w-full min-w-[220px] items-center gap-0.5">
                {waveform.map((height, index) => (
                  <span
                    key={index}
                    className="w-1 flex-1 rounded-full bg-primary/80"
                    style={{ height: `${height}%` }}
                  />
                ))}
              </div>
            </div>
          </div>
          <div className="mt-0.5 flex items-center justify-between">
            <span className="select-none text-[10px] tabular-nums text-muted-foreground/70">
              {playing ? displayTime : durationMs ? formatDuration(durationMs) : displayTime}
            </span>
          </div>
        </div>
      </div>
      <audio
        ref={audioRef}
        src={blobUrl}
        preload="metadata"
        className="hidden"
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={handleEnded}
        onTimeUpdate={handleTimeUpdate}
      />
    </div>
  );
}
