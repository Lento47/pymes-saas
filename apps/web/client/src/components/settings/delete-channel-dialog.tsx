import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";

export function DeleteChannelDialog({ channel, onClose }: { channel: any; onClose: () => void }) {
  const { toast } = useToast();
  const qc = useQueryClient();

  const del = useMutation({
    mutationFn: () => api.deleteChannel(channel.id),
    onSuccess: () => {
      toast({ title: "Canal eliminado" });
      qc.invalidateQueries({ queryKey: ["/api/channels"] });
      onClose();
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  return (
    <AlertDialog open onOpenChange={open => { if (!open) onClose(); }}>
      <AlertDialogContent className="bg-card border-border">
        <AlertDialogHeader>
          <AlertDialogTitle className="text-sm">¿Eliminar canal "{channel?.name}"?</AlertDialogTitle>
          <AlertDialogDescription className="text-xs text-muted-foreground">
            Esta acción es irreversible. Se perderán la configuración y el historial de conversaciones asociadas.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel className="h-8 text-xs">Cancelar</AlertDialogCancel>
          <AlertDialogAction
            onClick={() => del.mutate()}
            disabled={del.isPending}
            className="h-8 text-xs bg-destructive hover:bg-destructive/90"
          >
            {del.isPending ? "Eliminando..." : "Eliminar"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
