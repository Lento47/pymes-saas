import { useEffect, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { CheckCircle2, Circle, Loader2, ArrowRight } from "lucide-react";
import { api } from "@/lib/api";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { queryClient } from "@/lib/queryClient";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const DEFAULT_CHECKLIST = [
  {
    category: "Workspace",
    items: [
      { label: "Configurar nombre del workspace", completed: false, notes: "", apiField: "workspace" },
      { label: "Invitar a tu equipo", completed: false, notes: "", apiField: "members" },
      { label: "Configurar idioma y zona horaria", completed: false, notes: "", apiField: "workspace" },
    ],
  },
  {
    category: "Canales",
    items: [
      { label: "Conectar WhatsApp", completed: false, notes: "", apiField: "channels" },
      { label: "Configurar canal de Email", completed: false, notes: "", apiField: "channels" },
      { label: "Conectar Telegram", completed: false, notes: "", apiField: "channels" },
    ],
  },
  {
    category: "Facturación",
    items: [
      { label: "Crear primera factura", completed: false, notes: "", apiField: "invoices" },
      { label: "Configurar datos fiscales (Hacienda)", completed: false, notes: "", apiField: "settings" },
      { label: "Agregar método de pago", completed: false, notes: "", apiField: "billing" },
    ],
  },
  {
    category: "CRM",
    items: [
      { label: "Importar o crear contactos", completed: false, notes: "", apiField: "contacts" },
      { label: "Crear primer deal en Pipeline", completed: false, notes: "", apiField: "pipeline" },
      { label: "Configurar primera automatización", completed: false, notes: "", apiField: "automations" },
    ],
  },
  {
    category: "Lanzamiento",
    items: [
      { label: "Revisar centro de ayuda", completed: false, notes: "", apiField: "help" },
      { label: "Completar checklist de seguridad", completed: false, notes: "", apiField: "security" },
      { label: "Invitar clientes al portal", completed: false, notes: "", apiField: "contacts" },
    ],
  },
];

export default function OnboardingPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [checklist, setChecklist] = useState(DEFAULT_CHECKLIST);
  const [status, setStatus] = useState("NOT_STARTED");

  const { data: project, isLoading } = useQuery({
    queryKey: ["onboarding"],
    queryFn: () => api.getOnboardingProject().catch(() => null),
  });

  useEffect(() => {
    if (project?.checklist) {
      const merged = DEFAULT_CHECKLIST.map(cat => ({
        category: cat.category,
        items: cat.items.map(item => {
          const existing = (project.checklist as any[])
            ?.find((c) => c.category === cat.category)
            ?.items?.find((i) => i.label === item.label);
          return existing ? { ...item, completed: existing.completed ?? false, notes: existing.notes ?? "" } : item;
        }),
      }));
      setChecklist(merged);
    }
    if (project?.status) setStatus(project.status);
  }, [project]);

  const saveMut = useMutation({
    mutationFn: (data: Record<string, any>) => api.saveOnboardingProject(data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["onboarding"] }); toast({ title: "Avance guardado" }); },
    onError: (e) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const toggleItem = (catIdx: number, itemIdx: number) => {
    const newChecklist = [...checklist];
    newChecklist[catIdx].items[itemIdx].completed = !newChecklist[catIdx].items[itemIdx].completed;
    setChecklist(newChecklist);
  };

  const allDone = checklist.every(cat => cat.items.every(i => i.completed));
  const completedCount = checklist.reduce((s, cat) => s + cat.items.filter(i => i.completed).length, 0);
  const totalCount = checklist.reduce((s, cat) => s + cat.items.length, 0);

  if (isLoading) return <div className="flex items-center justify-center py-20"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>;

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <PageHeader title="Onboarding" description="Completá estos pasos para poner tu workspace en marcha." />
      <div className="mt-1 mb-6 text-sm text-muted-foreground">{completedCount} de {totalCount} tareas completadas</div>

      <div className="space-y-6">
        {checklist.map((category, catIdx) => (
          <div key={category.category} className="rounded-xl border border-border/60 bg-card/40 p-4">
            <h3 className="text-sm font-semibold mb-3">{category.category}</h3>
            <div className="space-y-2">
              {category.items.map((item, itemIdx) => (
                <div
                  key={item.label}
                  className={cn(
                    "flex items-center gap-3 p-2.5 rounded-lg cursor-pointer transition-colors",
                    item.completed ? "bg-green-500/5 border border-green-500/10" : "hover:bg-sidebar-accent/40 border border-transparent"
                  )}
                  onClick={() => toggleItem(catIdx, itemIdx)}
                >
                  {item.completed
                    ? <CheckCircle2 className="w-5 h-5 text-green-400 shrink-0" />
                    : <Circle className="w-5 h-5 text-muted-foreground/75 shrink-0" />
                  }
                  <span className={cn("text-sm", item.completed ? "text-muted-foreground line-through" : "text-foreground")}>{item.label}</span>
                  {item.notes && <span className="text-xs text-muted-foreground ml-auto">{item.notes}</span>}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="mt-8 flex gap-3">
        <Button onClick={() => saveMut.mutate({ checklist, status: allDone ? "COMPLETED" : "IN_PROGRESS" })} disabled={saveMut.isPending} className="flex-1">
          {saveMut.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
          Guardar avance
        </Button>
        <Button variant="outline" onClick={() => window.open("/documentation", "_blank")}>Centro de ayuda</Button>
      </div>
    </div>
  );
}