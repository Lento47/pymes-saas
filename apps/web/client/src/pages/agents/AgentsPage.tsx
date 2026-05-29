import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation, Link } from "wouter";
import { Loader2, Plus, LayoutTemplate } from "lucide-react";
import { queryClient } from "@/lib/queryClient";
import { api } from "@/lib/api";
import { useRequireAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { AgentCard } from "@/components/agents/AgentCard";
import { AgentGlobalConfig } from "@/components/agents/AgentGlobalConfig";

export default function AgentsPage() {
  useRequireAuth();
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ name: "", description: "", system_instructions: "" });

  const { data: agents = [], isLoading } = useQuery({
    queryKey: ["/api/agents"],
    queryFn: api.listAgents,
  });

  const createMut = useMutation({
    mutationFn: () => api.createAgent(form),
    onSuccess: (agent) => {
      queryClient.invalidateQueries({ queryKey: ["/api/agents"] });
      toast({ title: "Agente creado", description: "El chatflow se está desplegando en Flowise." });
      setShowCreate(false);
      setForm({ name: "", description: "", system_instructions: "" });
      setLocation(`/agents/${agent.id}`);
    },
    onError: (e: any) =>
      toast({ title: "Error", description: e.message, variant: "destructive" }),
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

  const deleteMut = useMutation({
    mutationFn: (id: string) => api.deleteAgent(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/agents"] });
      toast({ title: "Agente eliminado" });
    },
    onError: (e: any) =>
      toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-foreground">Agentes IA</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Asistentes automáticos impulsados por Flowise
          </p>
        </div>
        <div className="flex gap-2">
          <Link href="/agents/templates">
            <Button variant="outline" size="sm" className="gap-1.5">
              <LayoutTemplate className="h-4 w-4" />
              Plantillas
            </Button>
          </Link>
          <Button size="sm" className="gap-1.5" onClick={() => setShowCreate(true)}>
            <Plus className="h-4 w-4" />
            Nuevo agente
          </Button>
        </div>
      </div>

      <AgentGlobalConfig />

      {isLoading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : (agents as Record<string, any>[]).length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 gap-4 text-center">
          <p className="text-muted-foreground text-sm">
            No hay agentes configurados.
          </p>
          <div className="flex gap-2">
            <Button size="sm" onClick={() => setShowCreate(true)}>
              Crear agente
            </Button>
            <Link href="/agents/templates">
              <Button variant="outline" size="sm">
                Explorar plantillas
              </Button>
            </Link>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {(agents as Record<string, any>[]).map((a) => (
            <AgentCard
              key={a.id}
              agent={a}
              onActivate={() => activateMut.mutate(a.id)}
              onDeactivate={() => deactivateMut.mutate(a.id)}
              onDelete={() => deleteMut.mutate(a.id)}
            />
          ))}
        </div>
      )}

      {/* Create agent dialog */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Nuevo agente</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-4 mt-2">
            <div>
              <Label className="text-xs">Nombre del agente</Label>
              <Input
                className="mt-1 text-sm"
                placeholder="Ej: Soporte al cliente"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              />
            </div>
            <div>
              <Label className="text-xs">Descripción (opcional)</Label>
              <Input
                className="mt-1 text-sm"
                placeholder="Breve descripción del propósito"
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              />
            </div>
            <div>
              <Label className="text-xs font-medium">
                Prompt del negocio (instrucciones del sistema)
              </Label>
              <p className="text-[10px] text-muted-foreground mt-0.5 mb-1.5">
                Describe cómo debe comportarse el agente. PymesHub lo enviará
                a Flowise automáticamente en cada conversación.
              </p>
              <Textarea
                className="text-xs font-mono resize-y"
                rows={8}
                placeholder={`Eres el asistente virtual de [nombre del negocio].
Respondes en español, de forma clara y amigable.
Tu objetivo es ayudar con preguntas sobre productos y pedidos.
Si el cliente tiene un reclamo o consulta legal, deriva al equipo humano.`}
                value={form.system_instructions}
                onChange={(e) =>
                  setForm((f) => ({ ...f, system_instructions: e.target.value }))
                }
              />
            </div>
            <div className="flex gap-2 justify-end pt-1">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowCreate(false)}
              >
                Cancelar
              </Button>
              <Button
                size="sm"
                disabled={!form.name.trim() || createMut.isPending}
                onClick={() => createMut.mutate()}
              >
                {createMut.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-1" />
                ) : null}
                Crear y desplegar en Flowise
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
