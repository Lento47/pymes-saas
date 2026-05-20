import { Loader2, Paperclip, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ComposerAttachmentPreview } from "./ComposerAttachmentPreview";

interface MessageComposerProps {
  value: string;
  onChange: (value: string) => void;
  onSend: () => void;
  onAttach: (file: File) => Promise<void>;
  onRemoveAttachment: () => void;
  attachment: { file: File; url: string; type: string } | null;
  uploading: boolean;
  isPending: boolean;
  channelLabel?: string;
  disabled?: boolean;
  className?: string;
}

export function MessageComposer({
  value,
  onChange,
  onSend,
  onAttach,
  onRemoveAttachment,
  attachment,
  uploading,
  isPending,
  channelLabel,
  disabled,
  className,
}: MessageComposerProps) {
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (!canSend) return;
      onSend();
    }
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const items = e.clipboardData?.items;
    if (!items) return;

    for (let i = 0; i < items.length; i++) {
      const file = items[i].getAsFile?.();
      if (file) {
        e.preventDefault();
        onAttach(file);
        return;
      }
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      onAttach(file);
      e.target.value = "";
    }
  };

  const handleInput = (e: React.FormEvent<HTMLTextAreaElement>) => {
    const target = e.currentTarget;
    target.style.height = "auto";
    target.style.height = Math.min(target.scrollHeight, 100) + "px";
  };

  const canSend = !(!value.trim() && !attachment) && !isPending && !uploading;

  return (
    <div className={`shrink-0 border-t border-border bg-background/95 backdrop-blur-sm px-3 py-2 ${className ?? ""}`}>
      <ComposerAttachmentPreview
        attachment={attachment}
        uploading={uploading}
        onRemove={onRemoveAttachment}
      />
      <div className="flex items-end gap-0 rounded-xl border border-border bg-background overflow-hidden focus-within:border-primary/40 focus-within:shadow-sm focus-within:shadow-primary/5 transition-all duration-200">
        <label className="cursor-pointer flex items-center justify-center p-2.5 text-muted-foreground hover:text-foreground hover:bg-accent/50 rounded-lg transition-colors shrink-0" aria-label="Adjuntar archivo">
          <Paperclip className="w-4 h-4" />
          <input
            type="file"
            className="sr-only"
            accept="image/*,video/mp4,video/quicktime,audio/mpeg,audio/ogg,audio/wav,.pdf,.docx,.xlsx"
            onChange={handleFileChange}
          />
        </label>
        <Textarea
          className="flex-1 border-0 bg-transparent min-h-[40px] max-h-[100px] py-2.5 px-0 text-sm resize-none shadow-none focus-visible:ring-0 focus-visible:ring-offset-0"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onInput={handleInput}
          onKeyDown={handleKeyDown}
          onPaste={handlePaste}
          placeholder="Escribe un mensaje..."
          rows={1}
          disabled={disabled}
          aria-label="Escribe un mensaje"
        />
        <Button
          type="button"
          size="sm"
          className={`m-1.5 h-8 w-8 p-0 rounded-lg shrink-0 ${
            canSend
              ? "bg-primary hover:bg-primary/90 hover:shadow-lg hover:shadow-primary/20 transition-all duration-200 scale-100 hover:scale-105 active:scale-95"
              : "bg-muted text-muted-foreground/40 cursor-not-allowed"
          }`}
          onClick={onSend}
          disabled={!canSend}
          aria-label={canSend ? "Enviar mensaje" : "No hay mensaje para enviar"}
        >
          {isPending ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Send className="w-4 h-4" />
          )}
        </Button>
      </div>
      {channelLabel && (
        <p className="text-[10px] text-muted-foreground/50 mt-1.5 ml-1 select-none">
          Enviando por {channelLabel}
        </p>
      )}
    </div>
  );
}
