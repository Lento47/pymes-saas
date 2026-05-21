import { useState } from "react";
import { useMediaBlobUrl } from "@/hooks/use-media-blob-url";
import { getMediaProxyUrl } from "@/features/inbox/media-utils";
import { cn } from "@/lib/utils";
import { Loader2, ImageIcon } from "lucide-react";
import { SensitiveText } from "@/components/shared/sensitive-text";

interface StickerAttachmentProps {
  messageId: string;
  caption?: string | null;
  className?: string;
}

export function StickerAttachment({ messageId, caption, className }: StickerAttachmentProps) {
  const mediaUrl = getMediaProxyUrl(messageId);
  const { blobUrl, error, loading } = useMediaBlobUrl(mediaUrl);
  const [imgError, setImgError] = useState(false);

  if (loading && !blobUrl) {
    return (
      <div className={cn("flex h-24 w-24 items-center justify-center sm:h-28 sm:w-28", className)}>
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (imgError || error || !blobUrl) {
    return (
      <div className={cn("flex h-24 w-24 items-center justify-center opacity-50 sm:h-28 sm:w-28", className)}>
        <ImageIcon className="h-6 w-6 text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="inline-flex flex-col items-start">
      <img
        src={blobUrl}
        alt={caption || ""}
        className={cn("h-24 w-24 object-contain drop-shadow-md transition-transform duration-150 hover:scale-[1.03] sm:h-28 sm:w-28", className)}
        onError={() => setImgError(true)}
      />
      {caption && (
        <p className="mt-1 max-w-[160px] text-[11px] leading-snug text-muted-foreground/70">
          <SensitiveText text={caption} />
        </p>
      )}
    </div>
  );
}
