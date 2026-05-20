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
      <div className={cn("flex items-center justify-center", className)}>
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (imgError || error || !blobUrl) {
    return (
      <div className={cn("flex items-center justify-center opacity-50", className)}>
        <ImageIcon className="h-6 w-6 text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="inline-block">
      <img
        src={blobUrl}
        alt={caption || ""}
        className={cn("h-24 w-24 object-contain sm:h-28 sm:w-28 drop-shadow-md transition-transform duration-150 hover:scale-105", className)}
        onError={() => setImgError(true)}
      />
      {caption && (
        <p className="mt-1 text-[11px] text-muted-foreground/70">
          <SensitiveText text={caption} />
        </p>
      )}
    </div>
  );
}
