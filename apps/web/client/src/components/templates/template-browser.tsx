import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { api, getAuthToken } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Loader2, Check, Copy, Zap, MessageCircle, Receipt, LayoutTemplate } from "lucide-react";

interface Props {
  open: boolean;
  onClose: () => void;
  type: "automation" | "message" | "invoice";
}

const TYPE_ICONS: Record<string, typeof Zap> = {
  automation: Zap,
  message: MessageCircle,
  invoice: Receipt,
};

export default function TemplateBrowser({ open, onClose, type }: Props) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [category, setCategory] = useState<string>("");
  const workspaceId = user?.workspace?.id ?? "";

  const { data: templates = [], isLoading } = useQuery({
    queryKey: ["system-templates", type, category],
    queryFn: () => api.listSystemTemplates(type, category) as Promise<any[]>,
    enabled: open,
    retry: false,
    staleTime: 60000,
  });

  const instantiateMutation = useMutation({
    mutationFn: async (templateId: string) => {
      const endpoint = type === "automation"
        ? `/api/templates/system/${templateId}/instantiate/automation/${workspaceId}`
        : `/api/templates/system/${templateId}/instantiate/message/${workspaceId}`;
      const token = getAuthToken();
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Failed to instantiate");
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Template aplicado", description: `${type === "automation" ? "Automatización" : "Plantilla"} creada exitosamente.` });
    },
    onError: () => toast({ title: "Error", description: "No se pudo aplicar el template", variant: "destructive" }),
  });

  const Icon = TYPE_ICONS[type] ?? LayoutTemplate;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="bg-card border-border max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-foreground flex items-center gap-2">
            <Icon className="w-5 h-5 text-primary" />
            Plantillas de {type === "automation" ? "Automatización" : type === "message" ? "Mensajes" : "Facturas"}
          </DialogTitle>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center gap-2 py-8 justify-center">
            <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
            <span className="text-sm text-muted-foreground">Cargando plantillas...</span>
          </div>
        ) : templates.length === 0 ? (
          <div className="text-center py-8 text-sm text-muted-foreground">
            No hay plantillas disponibles para este tipo.
          </div>
        ) : (
          <div className="grid gap-3">
            {(templates as any[]).map((t: any) => (
              <div key={t.id} className="rounded-lg border border-border bg-[hsl(var(--elevated))] p-4 hover:border-primary/30 transition-colors">
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <h4 className="text-sm font-medium text-foreground">{t.name}</h4>
                    {t.description && (
                      <p className="text-xs text-muted-foreground mt-0.5">{t.description}</p>
                    )}
                  </div>
                  {t.category && (
                    <Badge variant="outline" className="text-[9px] px-1.5 py-0">{t.category}</Badge>
                  )}
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 text-xs gap-1.5"
                  onClick={() => instantiateMutation.mutate(t.id)}
                  disabled={instantiateMutation.isPending}
                >
                  {instantiateMutation.isPending ? (
                    <Loader2 className="w-3 h-3 animate-spin" />
                  ) : (
                    <Copy className="w-3 h-3" />
                  )}
                  Usar esta plantilla
                </Button>
              </div>
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
