import { Loader2, Mic, Paperclip, Send, Smile, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
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
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); onSend(); }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      onAttach(file);
      e.target.value = "";
    }
  };

  const canSend = !(!value.trim() && !attachment) && !isPending && !uploading;

  return (
    <div className={className}>
      <ComposerAttachmentPreview
        attachment={attachment}
        uploading={uploading}
        onRemove={onRemoveAttachment}
      />
      <div className="flex items-end gap-0 rounded-xl border border-border bg-background overflow-hidden focus-within:border-primary/40 transition-colors">
        <label className="cursor-pointer flex items-center justify-center p-2.5 text-muted-foreground hover:text-foreground transition-colors shrink-0">
          <Paperclip className="w-4 h-4" />
          <input
            type="file"
            className="hidden"
            accept="image/*,video/mp4,video/quicktime,audio/mpeg,audio/ogg,audio/wav,.pdf,.docx,.xlsx"
            onChange={handleFileChange}
          />
        </label>
        <Tooltip>
          <TooltipTrigger asChild>
            <button type="button" className="p-2.5 text-muted-foreground/40 hover:text-muted-foreground/60 shrink-0">
              <Smile className="w-4 h-4" />
            </button>
          </TooltipTrigger>
          <TooltipContent>Emojis (próximamente)</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <button type="button" className="p-2.5 text-muted-foreground/40 hover:text-muted-foreground/60 shrink-0">
              <Sparkles className="w-4 h-4" />
            </button>
          </TooltipTrigger>
          <TooltipContent>Plantillas (próximamente)</TooltipContent>
        </Tooltip>
        <Textarea
          className="flex-1 border-0 bg-transparent min-h-[40px] max-h-[100px] py-2.5 px-0 text-sm resize-none shadow-none focus-visible:ring-0 focus-visible:ring-offset-0"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Escribe un mensaje..."
          rows={1}
          disabled={disabled}
        />
        <Tooltip>
          <TooltipTrigger asChild>
            <button type="button" className="p-2.5 text-muted-foreground/40 hover:text-muted-foreground/60 shrink-0">
              <Mic className="w-4 h-4" />
            </button>
          </TooltipTrigger>
          <TooltipContent>Nota de voz (próximamente)</TooltipContent>
        </Tooltip>
        <Button
          type="button"
          size="sm"
          className="m-1.5 h-8 w-8 p-0 rounded-lg shrink-0"
          onClick={onSend}
          disabled={!canSend}
        >
          {isPending ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Send className="w-4 h-4" />
          )}
        </Button>
      </div>
      <p className="text-[10px] text-muted-foreground/40 mt-1.5 ml-1">
        {channelLabel && `Enviando por ${channelLabel} · `}
        ↑ Enter para enviar · Shift+Enter nueva línea
      </p>
    </div>
  );
}
