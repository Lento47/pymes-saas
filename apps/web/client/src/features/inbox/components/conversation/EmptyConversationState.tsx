import { Loader2, MessageCircle } from "lucide-react";

interface EmptyConversationStateProps {
  isLoading: boolean;
  contactName?: string;
}

export function EmptyConversationState({ isLoading, contactName }: EmptyConversationStateProps) {
  if (isLoading) {
    return (
      <div className="flex h-full min-h-0 flex-col items-center justify-center gap-2 text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin" />
        <span className="text-sm">Cargando mensajes...</span>
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col items-center justify-center gap-2 px-6 text-center text-muted-foreground">
      <div className="rounded-full border border-border/50 bg-background/70 p-3 shadow-sm">
        <MessageCircle className="h-6 w-6 opacity-35" />
      </div>
      <span className="text-sm font-medium text-foreground/70">Sin mensajes aún</span>
      {contactName && (
        <span className="max-w-xs text-xs text-muted-foreground/65">
          Inicia la conversación cuando tengas el contexto listo.
        </span>
      )}
    </div>
  );
}
