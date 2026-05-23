import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useRequireAuth } from "@/hooks/use-auth";
import { StatusBadge } from "@/components/shared/status-badge";
import { PriorityDot } from "@/components/shared/priority-dot";
import { PageLoader } from "@/components/shared/loading-spinner";
import { EmptyState } from "@/components/shared/empty-state";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { useRoute, Link } from "wouter";
import { ArrowLeft, MessageSquare, CheckSquare, FileText, Mail, Phone, Building2, Calendar, ExternalLink, FileImage, FileSpreadsheet, Sparkles, ChevronDown, ChevronUp, RefreshCw, Brain, Clock, PlusCircle } from "lucide-react";
import { format, formatDistanceToNow, isPast, isToday } from "date-fns";
import { es } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";

const TYPE_LABELS: Record<string, string> = {
  CUSTOMER: "Cliente",
  VENDOR: "Proveedor",
  LEAD: "Prospecto",
  OTHER: "Otro",
};

const typeBadgeColors: Record<string, string> = {
  CUSTOMER: "bg-blue-500/15 text-blue-400 border-blue-500/20",
  VENDOR: "bg-purple-500/15 text-purple-400 border-purple-500/20",
  LEAD: "bg-amber-500/15 text-amber-400 border-amber-500/20",
  OTHER: "bg-zinc-500/15 text-zinc-400 border-zinc-500/20",
};

function getInitials(name: string) {
  return name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2);
}

function getFileIcon(mimeType?: string) {
  if (!mimeType) return <FileText className="w-3.5 h-3.5 text-muted-foreground" />;
  if (mimeType.includes("image")) return <FileImage className="w-3.5 h-3.5 text-blue-400" />;
  if (mimeType.includes("sheet") || mimeType.includes("excel")) return <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-400" />;
  if (mimeType.includes("pdf")) return <FileText className="w-3.5 h-3.5 text-red-400" />;
  return <FileText className="w-3.5 h-3.5 text-muted-foreground" />;
}

const EMPRENDE_PLANS = ["EMPRENDE", "STARTER", "GROWTH", "BUSINESS", "ENTERPRISE", "BUSINESS_PLUS"];

function AiProfileCard({ contactId }: { contactId: string }) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);

  const { data: workspace } = useQuery({
    queryKey: ["/api/workspaces/current"],
    queryFn: () => api.getWorkspace(),
  });

  const { data: contact } = useQuery({
    queryKey: ["/api/contacts", contactId],
    queryFn: () => api.getContact(contactId),
    enabled: !!contactId,
  });

  const plan: string = workspace?.plan ?? "FREE";
  const aiProfile = (contact?.extracted_data_json as any)?.ai_profile;

  const { data: memoryData, refetch: refetchMemory } = useQuery({
    queryKey: ["/api/memory/contacts", contactId],
    queryFn: () => api.getContactMemory(contactId),
    enabled: !!contactId && EMPRENDE_PLANS.includes(plan),
  });

  const extendMemory = useMutation({
    mutationFn: (days: number) => api.extendContactMemory(contactId, days),
    onSuccess: (res: any) => {
      refetchMemory();
      toast({ title: res.ok ? `Memoria extendida ${res.days_extended} días` : res.message });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const analyze = useMutation({
    mutationFn: () => api.emprendeAnalyzeContact(contactId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/contacts", contactId] });
      toast({ title: "Perfil IA actualizado" });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  if (!EMPRENDE_PLANS.includes(plan)) return null;

  const memoryStatus = memoryData?.status;
  const memoryStatusLabel = memoryStatus?.status === "ACTIVE" ? "Activa"
    : memoryStatus?.status === "EXTENDED" ? "Extendida"
    : memoryStatus?.status === "PAUSED" ? "Pausada"
    : null;
  const memoryStatusColor = memoryStatus?.status === "ACTIVE" || memoryStatus?.status === "EXTENDED"
    ? "text-emerald-400"
    : "text-amber-400";

  return (
    <div className="bg-card border border-primary/20 rounded-xl p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Sparkles className="w-3.5 h-3.5 text-primary" />
          <h3 className="text-[10px] font-medium text-primary uppercase tracking-wider">Perfil IA</h3>
        </div>
        <div className="flex items-center gap-1">
          {aiProfile && (
            <button
              type="button"
              onClick={() => setOpen((v) => !v)}
              className="text-muted-foreground hover:text-foreground transition-colors"
              aria-label={open ? "Colapsar" : "Expandir"}
            >
              {open ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            </button>
          )}
          <Button
            size="sm"
            variant="ghost"
            className="h-6 w-6 p-0 text-muted-foreground hover:text-foreground"
            disabled={analyze.isPending}
            onClick={() => analyze.mutate()}
            title="Analizar conversaciones"
          >
            <RefreshCw className={cn("w-3 h-3", analyze.isPending && "animate-spin")} />
          </Button>
        </div>
      </div>

      {!aiProfile && !analyze.isPending && (
        <p className="text-[11px] text-muted-foreground">
          Presioná el botón para analizar las conversaciones de este cliente.
        </p>
      )}

      {analyze.isPending && (
        <p className="text-[11px] text-muted-foreground">Analizando...</p>
      )}

      {aiProfile && (open || !aiProfile.summary) && (
        <div className="space-y-2.5 mt-1">
          {aiProfile.summary && (
            <p className="text-[11px] text-foreground leading-relaxed">{aiProfile.summary}</p>
          )}
          {aiProfile.common_requests?.length > 0 && (
            <div>
              <p className="text-[10px] text-muted-foreground mb-1">Solicita frecuentemente</p>
              <div className="flex flex-wrap gap-1">
                {aiProfile.common_requests.map((r: string, i: number) => (
                  <span key={i} className="text-[10px] px-1.5 py-0.5 rounded border border-primary/20 bg-primary/[0.07] text-primary/80">
                    {r}
                  </span>
                ))}
              </div>
            </div>
          )}
          {aiProfile.contact_frequency && (
            <div className="flex items-center justify-between">
              <span className="text-[10px] text-muted-foreground">Frecuencia</span>
              <span className="text-[10px] text-foreground">{aiProfile.contact_frequency}</span>
            </div>
          )}
          {aiProfile.communication_style && (
            <div className="flex items-start justify-between gap-2">
              <span className="text-[10px] text-muted-foreground shrink-0">Estilo</span>
              <span className="text-[10px] text-foreground text-right">{aiProfile.communication_style}</span>
            </div>
          )}
        </div>
      )}

      {aiProfile && !open && aiProfile.summary && (
        <p className="text-[11px] text-muted-foreground line-clamp-2 mt-1">{aiProfile.summary}</p>
      )}

      {/* Memory status */}
      <div className="mt-3 pt-3 border-t border-border/40 flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <Brain className="w-3 h-3 text-muted-foreground" />
          <span className="text-[10px] text-muted-foreground">Memoria</span>
          {memoryStatusLabel && (
            <span className={cn("text-[10px] font-medium", memoryStatusColor)}>
              {memoryStatusLabel}
            </span>
          )}
          {memoryStatus?.expires_at && memoryStatus.status !== "PAUSED" && (
            <span className="text-[10px] text-muted-foreground/60 flex items-center gap-0.5">
              <Clock className="w-2.5 h-2.5" />
              {Math.max(0, Math.ceil((new Date(memoryStatus.extended_until ?? memoryStatus.expires_at).getTime() - Date.now()) / 86400000))}d
            </span>
          )}
          {memoryStatus?.status === "PAUSED" && (
            <span className="text-[10px] text-amber-400/80">Pausada — comprá créditos para reactivar</span>
          )}
          {!memoryStatus && (
            <span className="text-[10px] text-muted-foreground/60">Sin perfil aún</span>
          )}
        </div>
        {memoryStatus?.status === "PAUSED" && (
          <button
            type="button"
            onClick={() => extendMemory.mutate(30)}
            disabled={extendMemory.isPending}
            className="flex items-center gap-1 text-[10px] text-primary hover:text-primary/80 transition-colors"
            title="Extender 30 días (consume 30 créditos)"
          >
            <PlusCircle className="w-3 h-3" />
            +30 días
          </button>
        )}
      </div>
    </div>
  );
}

export default function ContactDetailPage() {
  useRequireAuth();
  const [, params] = useRoute("/contacts/:id");
  const id = params?.id || "";

  const { data: contact, isLoading } = useQuery({
    queryKey: ["/api/contacts", id],
    queryFn: () => api.getContact(id),
    enabled: !!id,
  });

  if (isLoading) return <PageLoader />;
  if (!contact) return <div className="text-center text-muted-foreground py-12">Contacto no encontrado</div>;

  const conversations = contact.conversations || [];
  const tasks = contact.tasks || [];
  const documents = contact.documents || [];

  const contactName = contact.name
    || `${contact.firstName || ""} ${contact.lastName || ""}`.trim()
    || contact.email
    || "Sin nombre";

  const createdAt = contact.createdAt || contact.created_at;

  return (
    <div>
      {/* Back */}
      <div className="flex items-center gap-2 mb-5">
        <Link href="/contacts">
          <Button variant="ghost" size="sm" className="h-8 w-8 p-0" data-testid="button-back">
            <ArrowLeft className="w-4 h-4" />
          </Button>
        </Link>
        <span className="text-xs text-muted-foreground">Contactos</span>
        <span className="text-xs text-muted-foreground">/</span>
        <span className="text-xs text-foreground truncate">{contactName}</span>
      </div>

      <div className="flex gap-5">
        {/* Left panel — Contact info */}
        <div className="w-[220px] shrink-0 flex flex-col gap-3">
          {/* Avatar + name */}
          <div className="bg-card border border-border rounded-xl p-4 flex flex-col items-center text-center gap-2">
            <div className="w-14 h-14 rounded-full bg-primary/20 flex items-center justify-center text-lg font-semibold text-primary">
              {getInitials(contactName)}
            </div>
            <div>
              <h2 className="text-sm font-semibold text-foreground leading-tight" data-testid="text-contact-name">
                {contactName}
              </h2>
              {contact.company && (
                <p className="text-[11px] text-muted-foreground mt-0.5">{contact.company}</p>
              )}
            </div>
            <Badge
              variant="outline"
              className={`text-[10px] px-2 py-0.5 border ${typeBadgeColors[contact.type] || typeBadgeColors.OTHER}`}
            >
              {TYPE_LABELS[contact.type] || contact.type}
            </Badge>
          </div>

          {/* Contact details */}
          <div className="bg-card border border-border rounded-xl p-4">
            <h3 className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider mb-3">Información</h3>
            <div className="space-y-2.5">
              {contact.email && (
                <div className="flex items-start gap-2">
                  <Mail className="w-3.5 h-3.5 text-muted-foreground shrink-0 mt-0.5" />
                  <span className="text-xs text-foreground break-all">{contact.email}</span>
                </div>
              )}
              {contact.phone && (
                <div className="flex items-center gap-2">
                  <Phone className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                  <span className="text-xs text-foreground">{contact.phone}</span>
                </div>
              )}
              {contact.company && (
                <div className="flex items-center gap-2">
                  <Building2 className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                  <span className="text-xs text-foreground">{contact.company}</span>
                </div>
              )}
              {createdAt && (
                <div className="flex items-center gap-2">
                  <Calendar className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                  <span className="text-xs text-muted-foreground">
                    {format(new Date(createdAt), "dd MMM yyyy")}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Stats */}
          <div className="bg-card border border-border rounded-xl p-4">
            <h3 className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider mb-3">Resumen</h3>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[11px] text-muted-foreground">Conversaciones</span>
                <span className="text-[11px] font-medium text-foreground">{conversations.length}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[11px] text-muted-foreground">Tareas</span>
                <span className="text-[11px] font-medium text-foreground">{tasks.length}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[11px] text-muted-foreground">Archivos</span>
                <span className="text-[11px] font-medium text-foreground">{documents.length}</span>
              </div>
            </div>
          </div>

          {/* AI Profile */}
          <AiProfileCard contactId={id} />
        </div>

        {/* Right — Tabs */}
        <div className="flex-1 min-w-0">
          <Tabs defaultValue="conversations" className="space-y-3">
            <TabsList className="bg-muted/50 h-8">
              <TabsTrigger value="conversations" className="text-xs h-7 data-[state=active]:bg-card" data-testid="tab-conversations">
                Conversaciones {conversations.length > 0 && `(${conversations.length})`}
              </TabsTrigger>
              <TabsTrigger value="tasks" className="text-xs h-7 data-[state=active]:bg-card" data-testid="tab-tasks">
                Tareas {tasks.length > 0 && `(${tasks.length})`}
              </TabsTrigger>
              <TabsTrigger value="documents" className="text-xs h-7 data-[state=active]:bg-card" data-testid="tab-documents">
                Archivos {documents.length > 0 && `(${documents.length})`}
              </TabsTrigger>
            </TabsList>

            {/* Conversations */}
            <TabsContent value="conversations">
              {conversations.length === 0 ? (
                <EmptyState icon={MessageSquare} title="Sin conversaciones" description="No hay conversaciones con este contacto aún." />
              ) : (
                <div className="bg-card border border-border rounded-xl divide-y divide-border overflow-hidden">
                  {conversations.map((conv: any) => {
                    const updatedStr = conv.updatedAt || conv.updated_at;
                    return (
                      <Link key={conv.id} href={`/inbox/${conv.id}`}>
                        <div
                          className="px-4 py-3 hover:bg-foreground/[0.015] cursor-pointer transition-colors flex items-center gap-3"
                          data-testid={`contact-conversation-${conv.id}`}
                        >
                          <PriorityDot priority={conv.priority} />
                          <div className="flex-1 min-w-0">
                            <div className="text-sm text-foreground truncate">
                              {conv.subject || "Sin asunto"}
                            </div>
                            {updatedStr && (
                              <div className="text-[11px] text-muted-foreground mt-0.5">
                                {formatDistanceToNow(new Date(updatedStr), { addSuffix: true, locale: es })}
                              </div>
                            )}
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <StatusBadge status={conv.status} type="conversation" />
                            <ExternalLink className="w-3 h-3 text-muted-foreground/80" />
                          </div>
                        </div>
                      </Link>
                    );
                  })}
                </div>
              )}
            </TabsContent>

            {/* Tasks */}
            <TabsContent value="tasks">
              {tasks.length === 0 ? (
                <EmptyState icon={CheckSquare} title="Sin tareas" description="No hay tareas vinculadas a este contacto." />
              ) : (
                <div className="bg-card border border-border rounded-xl divide-y divide-border overflow-hidden">
                  {tasks.map((task: any) => {
                    const dueStr = task.dueDate || task.due_date || task.due_at;
                    const isOverdue = dueStr && isPast(new Date(dueStr)) && !isToday(new Date(dueStr)) && task.status !== "DONE";
                    return (
                      <div
                        key={task.id}
                        className={cn("px-4 py-3", isOverdue && "bg-red-500/5")}
                        data-testid={`contact-task-${task.id}`}
                      >
                        <div className="flex items-center gap-2.5">
                          <PriorityDot priority={task.priority} />
                          <div className="flex-1 min-w-0">
                            <div className={cn("text-sm truncate", task.status === "DONE" ? "line-through text-muted-foreground" : "text-foreground")}>
                              {task.title}
                            </div>
                            {dueStr && (
                              <div className={cn("text-[11px] mt-0.5", isOverdue ? "text-red-400" : "text-muted-foreground")}>
                                {isOverdue ? "Vencida · " : ""}
                                {format(new Date(dueStr), "dd MMM")}
                              </div>
                            )}
                          </div>
                          <StatusBadge status={task.status} type="task" />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </TabsContent>

            {/* Documents */}
            <TabsContent value="documents">
              {documents.length === 0 ? (
                <EmptyState icon={FileText} title="Sin archivos" description="No hay archivos vinculados a este contacto." />
              ) : (
                <div className="bg-card border border-border rounded-xl divide-y divide-border overflow-hidden">
                  {documents.map((doc: any) => {
                    const mime = doc.mimeType || doc.mime_type;
                    const dateStr = doc.createdAt || doc.created_at;
                    return (
                      <div
                        key={doc.id}
                        className="px-4 py-3 flex items-center gap-2.5"
                        data-testid={`contact-doc-${doc.id}`}
                      >
                        {getFileIcon(mime)}
                        <span className="text-sm text-foreground flex-1 truncate">
                          {doc.file_name || doc.filename || doc.name || "Sin nombre"}
                        </span>
                        {dateStr && (
                          <span className="text-[11px] text-muted-foreground shrink-0">
                            {format(new Date(dateStr), "dd MMM")}
                          </span>
                        )}
                        <StatusBadge status={doc.status} type="document" />
                      </div>
                    );
                  })}
                </div>
              )}
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}
