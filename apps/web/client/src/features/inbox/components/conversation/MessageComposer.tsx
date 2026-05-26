import { useState } from "react";
import { FileText, List, Loader2, MapPin, MessageSquare, Paperclip, Plus, Send, ShoppingBag, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ComposerAttachmentPreview } from "./ComposerAttachmentPreview";
import { InteractiveToolbar, type InteractiveState } from "../composer/InteractiveToolbar";
import { ProductPicker } from "@/components/inventory/ProductPicker";

interface MessageTemplate {
  id: string;
  name: string;
  body: string;
  channel: string;
}

interface MessageComposerProps {
  value: string;
  onChange: (value: string) => void;
  onSend: (interactive?: InteractiveState) => void;
  onAttach: (file: File) => Promise<void>;
  onRemoveAttachment: () => void;
  attachment: { file: File; url: string; type: string } | null;
  uploading: boolean;
  isPending: boolean;
  channelLabel?: string;
  channelType?: string;
  isServiceWindowOpen?: boolean;
  onSelectTemplate?: () => void;
  onAiSuggest?: () => Promise<string>;
  availableTemplates?: MessageTemplate[];
  onInsertTemplate?: (body: string) => void;
  onInsertProduct?: (text: string) => void;
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
  channelType,
  isServiceWindowOpen = true,
  onSelectTemplate,
  onAiSuggest,
  availableTemplates,
  onInsertTemplate,
  onInsertProduct,
  disabled,
  className,
}: MessageComposerProps) {
  const [interactive, setInteractive] = useState<InteractiveState>({ type: null });
  const [isSuggesting, setIsSuggesting] = useState(false);
  const [templatePickerOpen, setTemplatePickerOpen] = useState(false);
  const [productPickerOpen, setProductPickerOpen] = useState(false);
  const [templateSearch, setTemplateSearch] = useState("");

  const isWhatsApp = channelType?.toUpperCase() === "WHATSAPP";
  const windowClosed = isWhatsApp && !isServiceWindowOpen;
  const freeFormDisabled = windowClosed || disabled;

  const handleSend = () => {
    if (isPending || uploading) return;
    if (!value.trim() && !attachment && !interactive.type) return;
    onSend(interactive.type ? interactive : undefined);
    setInteractive({ type: null });
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (!canSend) return;
      handleSend();
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

  const handleAiSuggest = async () => {
    if (!onAiSuggest || isSuggesting) return;
    setIsSuggesting(true);
    try {
      const suggestion = await onAiSuggest();
      if (suggestion) onChange(suggestion);
    } finally {
      setIsSuggesting(false);
    }
  };

  const handleInput = (e: React.FormEvent<HTMLTextAreaElement>) => {
    const target = e.currentTarget;
    target.style.height = "auto";
    target.style.height = Math.min(target.scrollHeight, 100) + "px";
  };

  const canSend = !(
    !value.trim() && !attachment && !interactive.type
  ) && !isPending && !uploading;

  const handleInteractiveType = (type: NonNullable<InteractiveState["type"]>) => {
    if (interactive.type === type) {
      setInteractive({ type: null });
    } else {
      setInteractive({ type, buttons: [{ id: "", title: "" }] });
    }
  };

  const filteredTemplates = templateSearch
    ? (availableTemplates ?? []).filter(t => t.name.toLowerCase().includes(templateSearch.toLowerCase()) || t.body.toLowerCase().includes(templateSearch.toLowerCase()))
    : (availableTemplates ?? []);

  return (
    <div className={`shrink-0 border-t border-border bg-background ${className ?? ""}`}>
      {/* Service window guard */}
      {windowClosed && (
        <div className="px-3 pt-2">
          <div className="flex items-start gap-2.5 bg-amber-500/[0.04] rounded-lg px-3 py-2.5 border border-amber-500/[0.08]">
            <div className="flex-1 min-w-0">
              <p className="text-[11px] font-medium text-amber-400/80">
                Ventana de servicio cerrada
              </p>
              <p className="text-[10px] text-muted-foreground/60 mt-0.5">
                Esta conversación requiere una plantilla aprobada de WhatsApp para continuar.
              </p>
            </div>
            {onSelectTemplate && (
              <button
                type="button"
                onClick={onSelectTemplate}
                className="shrink-0 text-[11px] font-medium text-primary hover:text-primary/80 bg-primary/[0.06] hover:bg-primary/[0.10] rounded-md px-2.5 py-1.5 transition-colors"
              >
                Elegir plantilla
              </button>
            )}
          </div>
        </div>
      )}

      {/* Interactive toolbar */}
      {!windowClosed && (
        <InteractiveToolbar
          value={interactive}
          onChange={setInteractive}
          onClose={() => setInteractive({ type: null })}
          disabled={isPending}
        />
      )}

      {/* Composer row */}
      <div className="px-3 py-2">
        <ComposerAttachmentPreview
          attachment={attachment}
          uploading={uploading}
          onRemove={onRemoveAttachment}
        />
        <div className="flex items-end gap-1.5 rounded-2xl border border-border bg-background p-1.5 shadow-sm transition-all duration-200 focus-within:border-primary/40 focus-within:shadow-primary/5">
          {isWhatsApp && !interactive.type && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-8 w-8 shrink-0 rounded-full p-0 text-muted-foreground hover:text-foreground"
                  disabled={isPending || freeFormDisabled}
                  aria-label="Más acciones de mensaje"
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" side="top" className="w-52">
                <DropdownMenuItem onClick={() => handleInteractiveType("buttons")}>
                  <MessageSquare className="mr-2 h-3.5 w-3.5 text-muted-foreground" />
                  Botones de respuesta
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleInteractiveType("list")}>
                  <List className="mr-2 h-3.5 w-3.5 text-muted-foreground" />
                  Lista de opciones
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleInteractiveType("location_request")}>
                  <MapPin className="mr-2 h-3.5 w-3.5 text-muted-foreground" />
                  Solicitar ubicación
                </DropdownMenuItem>
                {onSelectTemplate && (
                  <DropdownMenuItem onClick={onSelectTemplate}>
                    <FileText className="mr-2 h-3.5 w-3.5 text-muted-foreground" />
                    Plantilla
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          )}

          {/* Attachment button */}
          <label
            className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-accent/60 hover:text-foreground ${freeFormDisabled ? "pointer-events-none opacity-45" : "cursor-pointer"}`}
            aria-label="Adjuntar archivo"
          >
            <Paperclip className="w-4 h-4" />
            <input
              type="file"
              className="sr-only"
              accept="image/*,video/mp4,video/quicktime,audio/mpeg,audio/ogg,audio/wav,.pdf,.docx,.xlsx"
              onChange={handleFileChange}
              disabled={freeFormDisabled || isPending || uploading}
            />
          </label>

          {/* Template picker button */}
          {availableTemplates && availableTemplates.length > 0 && onInsertTemplate && (
            <Popover open={templatePickerOpen} onOpenChange={setTemplatePickerOpen}>
              <PopoverTrigger asChild>
                <button
                  type="button"
                  disabled={freeFormDisabled}
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-accent/60 hover:text-foreground disabled:pointer-events-none disabled:opacity-45"
                  title="Insertar plantilla"
                >
                  <FileText className="w-4 h-4" />
                </button>
              </PopoverTrigger>
              <PopoverContent align="start" side="top" className="w-72 p-2">
                <div className="mb-2">
                  <input
                    className="w-full text-xs bg-muted/30 border border-border rounded-md px-2 py-1.5 outline-none placeholder:text-muted-foreground/50"
                    placeholder="Buscar plantilla..."
                    value={templateSearch}
                    onChange={e => setTemplateSearch(e.target.value)}
                    autoFocus
                  />
                </div>
                <div className="max-h-52 overflow-y-auto space-y-0.5">
                  {filteredTemplates.length === 0 ? (
                    <p className="text-xs text-muted-foreground text-center py-4">Sin resultados</p>
                  ) : filteredTemplates.map((tpl) => (
                    <button
                      key={tpl.id}
                      type="button"
                      className="w-full text-left rounded-md px-2 py-2 hover:bg-muted transition-colors"
                      onClick={() => {
                        onInsertTemplate(tpl.body);
                        setTemplatePickerOpen(false);
                        setTemplateSearch("");
                      }}
                    >
                      <div className="text-xs font-medium text-foreground">{tpl.name}</div>
                      <div className="text-[11px] text-muted-foreground line-clamp-2 mt-0.5">{tpl.body}</div>
                    </button>
                  ))}
                </div>
              </PopoverContent>
            </Popover>
          )}

          {/* Product picker button */}
          {onInsertProduct && (
            <div className="relative">
              <button
                type="button"
                onClick={() => setProductPickerOpen(v => !v)}
                disabled={freeFormDisabled}
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-accent/60 hover:text-foreground disabled:pointer-events-none disabled:opacity-45"
                title="Insertar producto"
              >
                <ShoppingBag className="w-4 h-4" />
              </button>
              {productPickerOpen && (
                <div className="absolute bottom-10 left-0 z-50 w-72">
                  <ProductPicker
                    open={productPickerOpen}
                    onOpenChange={setProductPickerOpen}
                    onSelect={(p) => {
                      const price = new Intl.NumberFormat("es-CR", { style: "currency", currency: "CRC", maximumFractionDigits: 0 }).format(p.unit_price);
                      const text = [p.name, p.description && p.description !== p.name ? p.description : null, `Precio: ${price}`]
                        .filter(Boolean)
                        .join("\n");
                      onInsertProduct(text);
                      setProductPickerOpen(false);
                    }}
                  />
                </div>
              )}
            </div>
          )}

          {/* AI Suggest button — EMPRENDE+ only, shown when onAiSuggest is provided */}
          {onAiSuggest && (
            <button
              type="button"
              onClick={handleAiSuggest}
              disabled={isSuggesting || freeFormDisabled}
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-primary/10 hover:text-primary disabled:pointer-events-none disabled:opacity-45"
              title="Sugerir respuesta con IA"
            >
              {isSuggesting ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Sparkles className="w-3.5 h-3.5" />
              )}
            </button>
          )}

          <Textarea
            className="min-h-[38px] max-h-[104px] flex-1 resize-none border-0 bg-transparent px-1 py-2 text-sm leading-relaxed shadow-none focus-visible:ring-0 focus-visible:ring-offset-0"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onInput={handleInput}
            onKeyDown={handleKeyDown}
            onPaste={handlePaste}
            placeholder={freeFormDisabled ? "Usá una plantilla para responder" : "Escribe un mensaje..."}
            rows={1}
            disabled={freeFormDisabled}
            aria-label="Escribe un mensaje"
          />

          <Button
            type="button"
            size="sm"
            className={`h-8 w-8 shrink-0 rounded-full p-0 ${
              canSend
                ? "bg-primary text-primary-foreground transition-all duration-200 hover:bg-primary/90 hover:shadow-lg hover:shadow-primary/20 active:scale-95"
                : "bg-muted text-muted-foreground/40 cursor-not-allowed"
            }`}
            onClick={handleSend}
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
      </div>
    </div>
  );
}
