import { useQuery, useMutation } from "@tanstack/react-query";
import { Link } from "wouter";
import { Loader2, Plus, LayoutTemplate } from "lucide-react";
import { queryClient } from "@/lib/queryClient";
import { api } from "@/lib/api";
import { useRequireAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { AgentCard } from "@/components/agents/AgentCard";

export default function AgentsPage() {
  useRequireAuth();
  const { toast } = useToast();

  const { data: agents = [], isLoading } = useQuery({
    queryKey: ["/api/agents"],
    queryFn: api.listAgents,
  });

  const activateMut = useMutation({
    mutationFn: (id: string) => api.activateAgent(id),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["/api/agents"] }),
    onError: (e: any) =>
      toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const deactivateMut = useMutation({
    mutationFn: (id: string) => api.deactivateAgent(id),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["/api/agents"] }),
    onError: (e: any) =>
      toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-foreground">Agentes IA</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Chatflows de Flowise conectados a tu espacio de trabajo
          </p>
        </div>
        <div className="flex gap-2">
          <Link href="/agents/templates">
            <Button variant="outline" size="sm" className="gap-1.5">
              <LayoutTemplate className="h-4 w-4" />
              Plantillas
            </Button>
          </Link>
          <Link href="/agents/new">
            <Button size="sm" className="gap-1.5">
              <Plus className="h-4 w-4" />
              Nuevo agente
            </Button>
          </Link>
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : (agents as Record<string, any>[]).length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 gap-4 text-center">
          <p className="text-muted-foreground text-sm">
            No hay agentes configurados.
          </p>
          <Link href="/agents/templates">
            <Button variant="outline" size="sm">
              Explorar plantillas
            </Button>
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {(agents as Record<string, any>[]).map((a) => (
            <AgentCard
              key={a.id}
              agent={a}
              onActivate={() => activateMut.mutate(a.id)}
              onDeactivate={() => deactivateMut.mutate(a.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
