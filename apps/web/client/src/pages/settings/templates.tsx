import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { SettingsLayout } from "@/components/settings/settings-layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { RefreshCw, Plus, Pencil, Trash2, FileText } from "lucide-react";
import { cn } from "@/lib/utils";

const STATUS_LABELS: Record<string, string> = {
  APPROVED: "Aprobada",
  DRAFT: "Borrador",
  PENDING_APPROVAL: "Pendiente",
  REJECTED: "Rechazada",
  DISABLED: "Desactivada",
};

const STATUS_COLORS: Record<string, string> = {
  APPROVED: "bg-emerald-500/10 text-emerald-500 border-emerald-500/20",
  DRAFT: "bg-muted text-muted-foreground border-border",
  PENDING_APPROVAL: "bg-amber-500/10 text-amber-500 border-amber-500/20",
  REJECTED: "bg-red-500/10 text-red-400 border-red-500/20",
  DISABLED: "bg-muted text-muted-foreground/50 border-border",
};

const WA_CATEGORIES = ["UTILITY", "SERVICE", "MARKETING", "AUTHENTICATION"];
const LANGUAGES = [
  { code: "es", label: "Español" },
  { code: "es_AR", label: "Español (Argentina)" },
  { code: "es_MX", label: "Español (México)" },
  { code: "es_ES", label: "Español (España)" },
  { code: "en_US", label: "Inglés (EE.UU.)" },
  { code: "pt_BR", label: "Portugués (Brasil)" },
];

interface Template {
  id: string;
  name: string;
  body: string;
  channel: string;
  category?: string;
  language?: string;
  status: string;
  external_template_id?: string;
  created_at: string;
}

interface TemplateFormProps {
  initial?: Partial<Template>;
  channel: "WHATSAPP" | "TELEGRAM";
  onSave: (data: Record<string, any>) => void;
  onCancel: () => void;
  isPending: boolean;
}

function TemplateForm({ initial, channel, onSave, onCancel, isPending }: TemplateFormProps) {
  const [name, setName] = useState(initial?.name ?? "");
  const [body, setBody] = useState(initial?.body ?? "");
  const [category, setCategory] = useState(initial?.category ?? "UTILITY");
  const [language, setLanguage] = useState(initial?.language ?? "es");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !body.trim()) return;
    onSave({
      name: name.trim(),
      body: body.trim(),
      channel,
      ...(channel === "WHATSAPP" ? { category, language } : { status: "APPROVED" }),
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-1.5">
        <Label>Nombre</Label>
        <Input
          value={name}
          onChange={e => setName(e.target.value)}
          placeholder={channel === "WHATSAPP" ? "ej: bienvenida_cliente" : "ej: Info de servicio"}
          required
        />
        {channel === "WHATSAPP" && (
          <p className="text-[11px] text-muted-foreground">Debe coincidir exactamente con el nombre en Meta (minúsculas, sin espacios).</p>
        )}
      </div>

      {channel === "WHATSAPP" && (
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label>Categoría</Label>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {WA_CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Idioma</Label>
            <Select value={language} onValueChange={setLanguage}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {LANGUAGES.map(l => <SelectItem key={l.code} value={l.code}>{l.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>
      )}

      <div className="space-y-1.5">
        <Label>Cuerpo del mensaje</Label>
        <Textarea
          value={body}
          onChange={e => setBody(e.target.value)}
          placeholder={channel === "WHATSAPP"
            ? "Hola {{1}}, tu pedido {{2}} está listo."
            : "Hola {{nombre}}, gracias por contactarnos."}
          rows={5}
          required
        />
        <p className="text-[11px] text-muted-foreground">
          {channel === "WHATSAPP"
            ? "Usá {{1}}, {{2}}, etc. para variables posicionales de Meta."
            : "Podés usar {{nombre}}, {{producto}}, etc. como marcadores."}
        </p>
      </div>

      <div className="flex justify-end gap-2 pt-1">
        <Button type="button" variant="outline" size="sm" onClick={onCancel} disabled={isPending}>Cancelar</Button>
        <Button type="submit" size="sm" disabled={isPending || !name.trim() || !body.trim()}>
          {isPending ? "Guardando..." : "Guardar"}
        </Button>
      </div>
    </form>
  );
}

function TemplateList({ channel }: { channel: "WHATSAPP" | "TELEGRAM" }) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [editTarget, setEditTarget] = useState<Template | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Template | null>(null);

  const { data: templates = [], isLoading } = useQuery<Template[]>({
    queryKey: ["message-templates", channel],
    queryFn: () => api.getMessageTemplates(channel) as Promise<Template[]>,
  });

  const syncMut = useMutation({
    mutationFn: () => api.syncTemplatesFromMeta(),
    onSuccess: (r) => {
      qc.invalidateQueries({ queryKey: ["message-templates", "WHATSAPP"] });
      toast({ title: `Sincronización completa`, description: `${r.created} creadas, ${r.updated} actualizadas (${r.synced} totales).` });
    },
    onError: (e: any) => toast({ title: "Error al sincronizar", description: e.message, variant: "destructive" }),
  });

  const createMut = useMutation({
    mutationFn: (data: Record<string, any>) => api.createMessageTemplate(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["message-templates", channel] });
      setCreateOpen(false);
      toast({ title: "Plantilla creada" });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const updateMut = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Record<string, any> }) => api.updateMessageTemplate(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["message-templates", channel] });
      setEditTarget(null);
      toast({ title: "Plantilla actualizada" });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => api.deleteMessageTemplate(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["message-templates", channel] });
      setDeleteTarget(null);
      toast({ title: "Plantilla eliminada" });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  return (
    <div className="space-y-4">
      {/* Actions */}
      <div className="flex items-center gap-2">
        {channel === "WHATSAPP" && (
          <Button variant="outline" size="sm" onClick={() => syncMut.mutate()} disabled={syncMut.isPending} className="gap-1.5">
            <RefreshCw className={cn("h-3.5 w-3.5", syncMut.isPending && "animate-spin")} />
            Sincronizar desde Meta
          </Button>
        )}
        <Button size="sm" onClick={() => setCreateOpen(true)} className="gap-1.5 ml-auto">
          <Plus className="h-3.5 w-3.5" />
          Nueva plantilla
        </Button>
      </div>

      {/* Template list */}
      {isLoading ? (
        <div className="text-sm text-muted-foreground py-8 text-center">Cargando plantillas...</div>
      ) : templates.length === 0 ? (
        <div className="flex flex-col items-center gap-3 py-12 text-center">
          <FileText className="h-8 w-8 text-muted-foreground/30" />
          <p className="text-sm text-muted-foreground">
            {channel === "WHATSAPP"
              ? 'No hay plantillas. Sincronizá desde Meta o creá una nueva.'
              : 'No hay plantillas de Telegram. Creá una para usar en las conversaciones.'}
          </p>
        </div>
      ) : (
        <div className="divide-y divide-border rounded-lg border border-border overflow-hidden">
          {templates.map((tpl) => (
            <div key={tpl.id} className="flex items-start gap-3 px-4 py-3 bg-background hover:bg-muted/20 transition-colors">
              <div className="flex-1 min-w-0 space-y-0.5">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-medium">{tpl.name}</span>
                  <Badge variant="outline" className={cn("text-[10px] px-1.5 py-0", STATUS_COLORS[tpl.status] ?? STATUS_COLORS.DRAFT)}>
                    {STATUS_LABELS[tpl.status] ?? tpl.status}
                  </Badge>
                  {tpl.category && (
                    <span className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded">{tpl.category}</span>
                  )}
                  {tpl.language && (
                    <span className="text-[10px] text-muted-foreground">{tpl.language}</span>
                  )}
                </div>
                <p className="text-xs text-muted-foreground line-clamp-2">{tpl.body}</p>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => setEditTarget(tpl)}>
                  <Pencil className="h-3.5 w-3.5" />
                </Button>
                <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-destructive hover:text-destructive" onClick={() => setDeleteTarget(tpl)}>
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Nueva plantilla — {channel === "WHATSAPP" ? "WhatsApp" : "Telegram"}</DialogTitle>
          </DialogHeader>
          <TemplateForm
            channel={channel}
            onSave={(data) => createMut.mutate(data)}
            onCancel={() => setCreateOpen(false)}
            isPending={createMut.isPending}
          />
        </DialogContent>
      </Dialog>

      {/* Edit dialog */}
      <Dialog open={!!editTarget} onOpenChange={(o) => !o && setEditTarget(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Editar plantilla</DialogTitle>
          </DialogHeader>
          {editTarget && (
            <TemplateForm
              initial={editTarget}
              channel={channel}
              onSave={(data) => updateMut.mutate({ id: editTarget.id, data })}
              onCancel={() => setEditTarget(null)}
              isPending={updateMut.isPending}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Delete confirm */}
      <Dialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>¿Eliminar plantilla?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Se eliminará <strong>{deleteTarget?.name}</strong>. Esta acción no se puede deshacer.
          </p>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" size="sm" onClick={() => setDeleteTarget(null)}>Cancelar</Button>
            <Button variant="destructive" size="sm" onClick={() => deleteTarget && deleteMut.mutate(deleteTarget.id)} disabled={deleteMut.isPending}>
              Eliminar
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default function TemplatesSettingsPage() {
  const [tab, setTab] = useState<"WHATSAPP" | "TELEGRAM">("WHATSAPP");

  return (
    <SettingsLayout>
      <div className="space-y-6 max-w-3xl">
        <div>
          <h2 className="text-lg font-semibold">Plantillas de mensajes</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Gestioná las plantillas de WhatsApp (requieren aprobación de Meta) y Telegram (uso libre).
          </p>
        </div>

        {/* Tab selector */}
        <div className="flex gap-1 p-1 bg-muted/40 rounded-lg w-fit">
          {(["WHATSAPP", "TELEGRAM"] as const).map((ch) => (
            <button
              key={ch}
              onClick={() => setTab(ch)}
              className={cn(
                "px-4 py-1.5 rounded-md text-sm font-medium transition-colors",
                tab === ch
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {ch === "WHATSAPP" ? "WhatsApp" : "Telegram"}
            </button>
          ))}
        </div>

        <TemplateList key={tab} channel={tab} />
      </div>
    </SettingsLayout>
  );
}
