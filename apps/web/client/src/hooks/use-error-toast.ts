import { useEffect } from "react";
import { useToast } from "@/hooks/use-toast";

/**
 * Shows an error toast when isError becomes true.
 * Use alongside any useQuery/useMutation to surface API failures.
 *
 * @param isError - From react-query's useQuery/useMutation
 * @param title - Toast title (default: "Error al cargar datos")
 * @param description - Toast description
 */
export function useErrorToast(
  isError: boolean,
  title = "Error al cargar datos",
  description?: string,
) {
  const { toast } = useToast();

  useEffect(() => {
    if (isError) {
      toast({
        title,
        description: description ?? "Revisá tu conexión e intentá de nuevo.",
        variant: "destructive",
      });
    }
  }, [isError]);
}
