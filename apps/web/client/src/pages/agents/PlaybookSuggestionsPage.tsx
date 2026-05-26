import { useQuery, useMutation } from "@tanstack/react-query";
import { CheckCircle2, XCircle, Loader2, Lightbulb } from "lucide-react";
import { queryClient } from "@/lib/queryClient";
import { api } from "@/lib/api";
import { useRequireAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

const statusColors: Record<string, string> = {
  PENDING: "bg-amber-100 text-amber-800",
  APPROVED: "bg-green-100 text-green-800",
  ACTIVE: "bg-blue-100 text-blue-800",
  REJECTED: "bg-gray-100 text-gray-500",
};

export default function PlaybookSuggestionsPage() {
  useRequireAuth();
  const { toast } = useToast();

  const { data: playbooks = [], isLoading } = useQuery({
    queryKey: ["/api/learning/playbooks"],
    queryFn: () => api.listPlaybooks(),
  });

  const updateMut = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      api.updatePlaybookStatus(id, status),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/learning/playbooks"] }),
    onError: (e: any) =>
      toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-48">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-xl font-semibold flex items-center gap-2">
          <Lightbulb className="h-5 w-5 text-amber-500" />
          Sugerencias de Playbooks
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          PymesHub aprendió patrones de tus conversaciones y sugiere automatizaciones. Aprueba las
          que te parezcan útiles.
        </p>
      </div>

      {playbooks.length === 0 ? (
        <div className="border rounded-lg p-8 text-center text-muted-foreground text-sm">
          No hay sugerencias todavía. Se generan automáticamente con el tiempo.
        </div>
      ) : (
        <div className="space-y-4">
          {playbooks.map((pb: any) => (
            <div key={pb.id} className="border rounded-lg p-4 space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-medium">{pb.title}</p>
                  {pb.reason && (
                    <p className="text-xs text-muted-foreground mt-0.5">{pb.reason}</p>
                  )}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Badge className={statusColors[pb.status] ?? "bg-gray-100 text-gray-600"}>
                    {pb.status}
                  </Badge>
                  {pb.confidence > 0 && (
                    <span className="text-xs text-muted-foreground">
                      {Math.round(pb.confidence * 100)}%
                    </span>
                  )}
                </div>
              </div>

              {pb.status === "PENDING" && (
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    className="text-green-700 border-green-200 hover:bg-green-50"
                    disabled={updateMut.isPending}
                    onClick={() => updateMut.mutate({ id: pb.id, status: "APPROVED" })}
                  >
                    <CheckCircle2 className="h-3 w-3 mr-1" />
                    Aprobar
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-muted-foreground"
                    disabled={updateMut.isPending}
                    onClick={() => updateMut.mutate({ id: pb.id, status: "REJECTED" })}
                  >
                    <XCircle className="h-3 w-3 mr-1" />
                    Rechazar
                  </Button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
