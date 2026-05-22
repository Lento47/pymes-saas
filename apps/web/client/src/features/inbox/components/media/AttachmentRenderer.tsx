import { cn } from "@/lib/utils";
import { ImageAttachment } from "./ImageAttachment";
import { StickerAttachment } from "./StickerAttachment";
import { AudioAttachment } from "./AudioAttachment";
import { VideoAttachment } from "./VideoAttachment";
import { DocumentAttachment } from "./DocumentAttachment";
import { LocationAttachment } from "./LocationAttachment";
import { ContactAttachment } from "./ContactAttachment";

interface AttachmentRendererProps {
  messageId: string;
  mediaType: string | null;
  mimeType?: string | null;
  fileName?: string | null;
  sizeBytes?: number | null;
  caption?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  address?: string | null;
  displayName?: string | null;
  phone?: string | null;
  email?: string | null;
  durationMs?: number | null;
  className?: string;
}

export function AttachmentRenderer({
  messageId,
  mediaType,
  mimeType,
  fileName,
  sizeBytes,
  caption,
  latitude,
  longitude,
  address,
  displayName,
  phone,
  email,
  durationMs,
  className,
}: AttachmentRendererProps) {
  switch (mediaType) {
    case "image":
      return (
        <ImageAttachment
          messageId={messageId}
          caption={caption}
          mimeType={mimeType}
          className={className}
        />
      );
    case "sticker":
      return (
        <StickerAttachment messageId={messageId} className={className} />
      );
    case "audio":
      return (
        <AudioAttachment
          messageId={messageId}
          caption={caption}
          durationMs={durationMs}
          className={className}
        />
      );
    case "video":
      return (
        <VideoAttachment
          messageId={messageId}
          caption={caption}
          className={className}
        />
      );
    case "document":
      return (
        <DocumentAttachment
          messageId={messageId}
          fileName={fileName}
          mimeType={mimeType}
          sizeBytes={sizeBytes}
          caption={caption}
          className={className}
        />
      );
    case "location":
      return (
        <LocationAttachment
          latitude={latitude}
          longitude={longitude}
          address={address}
          className={className}
        />
      );
    case "contact":
      return (
        <ContactAttachment
          displayName={displayName}
          phone={phone}
          email={email}
          className={className}
        />
      );
    default:
      return (
        <DocumentAttachment
          messageId={messageId}
          fileName={fileName ?? "Archivo adjunto"}
          mimeType={mimeType}
          sizeBytes={sizeBytes}
          caption={caption}
          className={className}
        />
      );
  }
}
