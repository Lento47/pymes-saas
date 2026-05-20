import { useState } from "react";
import { useMediaBlobUrl } from "@/hooks/use-media-blob-url";
import { getMediaProxyUrl } from "@/features/inbox/media-utils";
import { cn } from "@/lib/utils";
import { Loader2, ImageIcon } from "lucide-react";

interface StickerAttachmentProps {
  messageId: string;
  className?: string;
}

export function StickerAttachment({ messageId, className }: StickerAttachmentProps) {
  const mediaUrl = getMediaProxyUrl(messageId);
  const blobUrl = useMediaBlobUrl(mediaUrl);
  const [imgError, setImgError] = useState(false);

  if (!blobUrl && !imgError) {
    return (
      <div className={cn("flex items-center justify-center", className)}>
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (imgError || !blobUrl) {
    return (
      <div className={cn("flex items-center justify-center opacity-50", className)}>
        <ImageIcon className="h-6 w-6 text-muted-foreground" />
      </div>
    );
  }

  return (
    <img
      src={blobUrl}
      alt="Sticker"
      className={cn("h-24 w-24 object-contain sm:h-28 sm:w-28", className)}
      onError={() => setImgError(true)}
    />
  );
}
