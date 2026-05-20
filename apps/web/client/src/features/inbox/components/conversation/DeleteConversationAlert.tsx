import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface DeleteConversationAlertProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDelete: () => void;
  deletePending: boolean;
}

export function DeleteConversationAlert({
  open,
  onOpenChange,
  onDelete,
  deletePending,
}: DeleteConversationAlertProps) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="bg-card border-border">
        <AlertDialogHeader>
          <AlertDialogTitle className="text-sm">¿Eliminar conversación?</AlertDialogTitle>
          <AlertDialogDescription className="text-xs text-muted-foreground">
            Esta acción no se puede deshacer. Se eliminarán la conversación y todos sus mensajes.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel className="h-8 text-xs">Cancelar</AlertDialogCancel>
          <AlertDialogAction className="h-8 text-xs bg-destructive hover:bg-destructive/90"
            onClick={onDelete}
            disabled={deletePending}>
            Eliminar
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
