import { Loader2, Paperclip, Sticker, X } from "lucide-react";
import { formatFileSize, safeFileName } from "../../media-utils";

interface ComposerAttachmentPreviewProps {
  attachment: { file: File; url: string; type: string } | null;
  uploading: boolean;
  onRemove: () => void;
  className?: string;
}

export function ComposerAttachmentPreview({
  attachment,
  uploading,
  onRemove,
  className,
}: ComposerAttachmentPreviewProps) {
  if (!attachment) return null;

  return (
    <div className={`mb-2 rounded-lg border border-border/60 bg-muted/30 overflow-hidden ${className ?? ""}`}>
      {uploading && (
        <div className="h-0.5 w-full bg-amber-400/30 animate-pulse" />
      )}
      <div className="flex items-center gap-2 px-3 py-1.5">
        {attachment.type === "sticker" ? (
          <Sticker className="w-3 h-3 text-amber-500 shrink-0" />
        ) : (
          <Paperclip className="w-3 h-3 text-muted-foreground shrink-0" />
        )}
        <span className="flex-1 truncate text-[11px] text-foreground">
          {safeFileName(attachment.file.name)}
        </span>
        <span className="text-[10px] text-muted-foreground/60 shrink-0">
          {formatFileSize(attachment.file.size)}
        </span>
        {uploading && <Loader2 className="w-3 h-3 animate-spin" />}
        <button
          type="button"
          onClick={onRemove}
          className="text-muted-foreground hover:text-foreground transition-colors"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}
