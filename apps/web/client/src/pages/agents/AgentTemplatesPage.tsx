import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Loader2 } from "lucide-react";
import { queryClient } from "@/lib/queryClient";
import { api } from "@/lib/api";
import { useRequireAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { AgentTemplateCard } from "@/components/agents/AgentTemplateCard";

export default function AgentTemplatesPage() {
  useRequireAuth();
  const { toast } = useToast();
  const [, setLocation] = useLocation();

  const { data: templates = [], isLoading } = useQuery({
    queryKey: ["/api/agents/templates"],
    queryFn: api.listAgentTemplates,
  });

  const installMut = useMutation({
    mutationFn: (id: string) => api.installAgentTemplate(id),
    onSuccess: (agent) => {
      queryClient.invalidateQueries({ queryKey: ["/api/agents"] });
      toast({ title: "Plantilla instalada" });
      setLocation(`/agents/${agent.id}`);
    },
    onError: (e: any) =>
      toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  return (
    <div className="flex flex-col gap-6 p-6">
      <div>
        <h1 className="text-xl font-bold text-foreground">
          Plantillas de agentes
        </h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Instala un agente pre-configurado para tu negocio
        </p>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : (templates as Record<string, any>[]).length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No hay plantillas disponibles.
        </p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {(templates as Record<string, any>[]).map((t) => (
            <AgentTemplateCard
              key={t.id}
              template={t}
              onInstall={(id) => installMut.mutate(id)}
              installing={installMut.isPending}
            />
          ))}
        </div>
      )}
    </div>
  );
}
