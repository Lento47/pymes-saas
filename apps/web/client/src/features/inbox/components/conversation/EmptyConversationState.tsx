import { Loader2, MessageCircle } from "lucide-react";

interface EmptyConversationStateProps {
  isLoading: boolean;
  contactName?: string;
}

export function EmptyConversationState({ isLoading, contactName }: EmptyConversationStateProps) {
  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-2 text-muted-foreground">
        <Loader2 className="w-6 h-6 animate-spin" />
        <span className="text-sm">Cargando mensajes...</span>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center h-full gap-2 text-muted-foreground">
      <MessageCircle className="w-8 h-8 opacity-20" />
      <span className="text-sm">Sin mensajes aún</span>
    </div>
  );
}
