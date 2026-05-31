import React, { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { api, parsePlanError } from "@/lib/api";
import { apiErrorDescription } from "@/lib/api-error";
import { queryClient } from "@/lib/queryClient";
import { useAuth, useRequireAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Plus, Trash2, Zap, ArrowRight, CheckCircle2, GitBranch, Search, X, LayoutTemplate, ChevronDown, ChevronUp, MessageSquare, Clock, AlertTriangle, Tag, CreditCard, Bell } from "lucide-react";
import { AutomationSheet } from "@/components/automations/AutomationSheet";
import TemplateBrowser from "@/components/templates/template-browser";
import { DiagnosticButton } from "@/components/shared/diagnostic-button";
import { HelpButton } from "@/components/shared/help-button";

function triggerLabel(t: string) { return t.replace(/_/g,' ').replace(/\b\w/g,c=>c.toUpperCase()); }

const RECIPE_ICONS: Record<string, any> = {
  "welcome-message": MessageSquare,
  "out-of-hours": Clock,
  "no-reply-followup": Clock,
  "keyword-assignment": Tag,
  "unattended-alert": AlertTriangle,
  "payment-reminder": CreditCard,
  "overdue-team-alert": Bell,
};

const CATEGORY_LABELS: Record<string, string> = {
  communication: "Comunicación",
  operations: "Operaciones",
  billing: "Cobranza",
};

function RecipeConfigForm({ recipe, onSave, onCancel }: { recipe: any; onSave: (config: Record<string,string>) => void; onCancel: () => void }) {
  const [vals, setVals] = useState<Record<string, string>>(() => {
    const out: Record<string, string> = {};
    for (const field of recipe.config_schema) {
      out[field.key] = recipe.config?.[field.key] ?? field.default ?? "";
    }
    return out;
  });

  if (!recipe.config_schema?.length) return null;

  return (
    <div className="mt-3 space-y-2 rounded-lg border border-border/60 bg-muted/20 p-3">
      {recipe.config_schema.map((field: any) => (
        <div key={field.key}>
          <label className="text-[11px] font-medium text-muted-foreground block mb-1">{field.label}</label>
          {field.type === "textarea" ? (
            <textarea
              className="w-full text-[12px] rounded-md border border-border bg-background px-2 py-1.5 resize-none min-h-[64px] focus:outline-none focus:ring-1 focus:ring-primary/40"
              value={vals[field.key] ?? ""}
              onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setVals(v => ({ ...v, [field.key]: e.target.value }))}
            />
          ) : (
            <Input
              type={field.type === "number" ? "number" : "text"}
              className="h-8 text-[12px]"
              value={vals[field.key] ?? ""}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setVals(v => ({ ...v, [field.key]: e.target.value }))}
            />
          )}
        </div>
      ))}
      <div className="flex gap-2 pt-1">
        <Button size="sm" className="text-[11px] h-7" onClick={() => onSave(vals)}>Guardar</Button>
        <Button size="sm" variant="ghost" className="text-[11px] h-7 text-muted-foreground" onClick={onCancel}>Cancelar</Button>
      </div>
    </div>
  );
}

export default function AutomationsPage() {
  useRequireAuth(); const { user } = useAuth();
  const { toast } = useToast();
  const [createOpen, setCreateOpen] = useState(false);
  const [editingAuto, setEditingAuto] = useState<Record<string, any> | null>(null);
  const [templateOpen, setTemplateOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedRecipe, setExpandedRecipe] = useState<string | null>(null);

  const currentPlan = user?.workspace?.plan ?? "FREE";

  const { data: automationsRaw = [], isLoading } = useQuery({ queryKey: ["/api/automations"], queryFn: api.getAutomations });
  const automations = Array.isArray(automationsRaw) ? automationsRaw : (automationsRaw as any)?.data || (automationsRaw as any)?.automations || [];
  const { data: channelsRaw = [] } = useQuery({ queryKey: ["/api/channels"], queryFn: api.getChannels });
  const channels = Array.isArray(channelsRaw) ? channelsRaw : (channelsRaw as any)?.data || (channelsRaw as any)?.channels || [];
  const { data: membersRaw } = useQuery({ queryKey: ["/api/workspaces/current/members", "automation-builder"], queryFn: api.getMembers });
  const members = Array.isArray(membersRaw) ? membersRaw : (membersRaw as any)?.data || [];

  const { data: recipesRaw = [], isLoading: recipesLoading } = useQuery({
    queryKey: ["/api/workspaces/current/automation-recipes"],
    queryFn: api.getAutomationRecipes,
  });
  const recipes: any[] = Array.isArray(recipesRaw) ? recipesRaw : [];

  const toggleRecipeMut = useMutation({
    mutationFn: ({ slug, config }: { slug: string; config?: Record<string, string> }) =>
      api.toggleAutomationRecipe(slug, config),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/workspaces/current/automation-recipes"] });
      setExpandedRecipe(null);
    },
    onError: (err: unknown) => toast({ title: "Error", description: apiErrorDescription(err, "No se pudo actualizar."), variant: "destructive" }),
  });

  const recipesByCategory = recipes.reduce<Record<string, any[]>>((acc, r) => {
    (acc[r.category] = acc[r.category] || []).push(r);
    return acc;
  }, {});

  const filteredAutomations = useMemo(() => {
    if (!searchQuery.trim()) return automations;
    const q = searchQuery.toLowerCase().trim();
    return automations.filter((a: any) =>
      a.name?.toLowerCase().includes(q) ||
      a.description?.toLowerCase().includes(q) ||
      a.trigger_type?.toLowerCase().includes(q) ||
      a.action_type?.toLowerCase().includes(q)
    );
  }, [automations, searchQuery]);

  const toggleMut = useMutation({ mutationFn: (id: string) => api.toggleAutomation(id), onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/automations"] }), onError: (err: unknown) => toast({ title: 'Error', description: apiErrorDescription(err, 'No se pudo cambiar el estado.'), variant: 'destructive' }) });
  const deleteMut = useMutation({ mutationFn: (id: string) => api.deleteAutomation(id), onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/automations"] }); setDeleteId(null); toast({ title: 'Automatización eliminada' }); }, onError: (err: unknown) => toast({ title: 'Error', description: apiErrorDescription(err, 'No se pudo eliminar.'), variant: 'destructive' }) });

  const createMut = useMutation({
    mutationFn: (data: Record<string, any>) => api.createAutomation(data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/automations"] }); setCreateOpen(false); setEditingAuto(null); },
    onError: (err: unknown) => { const p = parsePlanError(err); toast({ title: p.isPlanLimit ? 'Límite de plan' : 'Error', description: p.message, variant: 'destructive' }); },
    onSettled: () => setIsSaving(false),
  });

  const updateMut = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Record<string, any> }) => api.updateAutomation(id, data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/automations"] }); setCreateOpen(false); setEditingAuto(null); },
    onError: (err: unknown) => { const p = parsePlanError(err); toast({ title: p.isPlanLimit ? 'Límite de plan' : 'Error', description: p.message, variant: 'destructive' }); },
    onSettled: () => setIsSaving(false),
  });

  const handleSave = async (payload: Record<string, any>) => {
    setIsSaving(true);
    try {
      if (editingAuto?.id) {
        await updateMut.mutateAsync({ id: editingAuto.id, data: payload });
      } else {
        await createMut.mutateAsync(payload);
      }
    } catch {
      // error already handled by mutation's onError callback
    }
  };

  const openEdit = (a: Record<string, any>) => { setEditingAuto(a); setCreateOpen(true); };

  const handleClose = () => {
    if (isSaving) return;
    setCreateOpen(false);
    setEditingAuto(null);
  };

  return (
    <div className="flex flex-col h-full overflow-hidden bg-background">
      {/* Header */}
      <header className="shrink-0 flex items-center justify-between px-6 py-3 border-b border-border">
        <div className="flex items-center gap-3">
          <Zap className="w-4 h-4 text-muted-foreground" />
          <h1 className="text-[15px] font-semibold text-foreground">Automatizaciones</h1>
          <span className="text-[11px] text-muted-foreground">{automations.filter((a: any) => a.enabled).length} activas</span>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setTemplateOpen(true)} className="gap-1.5 rounded-md text-[12px]">
            <LayoutTemplate className="w-[13px] h-[13px]" />Plantillas
          </Button>
          <Button onClick={() => { setEditingAuto(null); setCreateOpen(true); }} size="sm" className="gap-1.5 rounded-md text-[12px]">
            <Plus className="w-[13px] h-[13px]" />Nueva
          </Button>
        </div>
      </header>

      <div className="px-6 pb-2">
        <DiagnosticButton module="automations" />
      </div>

      <Tabs defaultValue="rules" className="flex flex-col flex-1 overflow-hidden">
        <div className="shrink-0 px-6 border-b border-border/60">
          <TabsList className="h-9 bg-transparent p-0 gap-4 border-0 rounded-none">
            <TabsTrigger value="rules" className="h-9 px-0 text-[12px] rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:text-foreground data-[state=active]:shadow-none bg-transparent">
              Reglas personalizadas
            </TabsTrigger>
            <TabsTrigger value="recipes" className="h-9 px-0 text-[12px] rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:text-foreground data-[state=active]:shadow-none bg-transparent">
              Recetas
              {recipes.filter((r: any) => r.is_active).length > 0 && (
                <Badge variant="secondary" className="ml-1.5 h-4 px-1 text-[10px]">
                  {recipes.filter((r: any) => r.is_active).length}
                </Badge>
              )}
            </TabsTrigger>
          </TabsList>
        </div>

        {/* ── Rules tab ── */}
        <TabsContent value="rules" className="flex flex-col flex-1 overflow-hidden mt-0">
          {/* Search bar */}
          <div className="shrink-0 px-6 py-2">
            <div className="relative max-w-xs">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
              <Input
                value={searchQuery}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearchQuery(e.target.value)}
                placeholder="Buscar automatizaciones..."
                className="h-8 pl-8 pr-8 text-[12px] bg-background border-border rounded-lg"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery("")}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>

          {isLoading ? (
            <div className="flex-1 flex items-center justify-center text-muted-foreground text-sm">Cargando...</div>
          ) : filteredAutomations.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center gap-4 text-muted-foreground">
              <GitBranch className="w-10 h-10 opacity-30" />
              <p className="text-sm">
                {searchQuery ? "Sin resultados para tu búsqueda." : "Sin automatizaciones. Creá tu primera regla."}
              </p>
              {searchQuery && (
                <Button variant="ghost" size="sm" onClick={() => setSearchQuery("")} className="text-xs">
                  Limpiar búsqueda
                </Button>
              )}
            </div>
          ) : (
            <div className="flex-1 overflow-y-auto p-4 pb-16 lg:pb-4 space-y-3">
              {filteredAutomations.map((auto: any) => (
                <div key={auto.id}
                  className="rounded-lg border border-border bg-card/40 p-4 transition-colors hover:bg-card/60 hover:border-border/80"
                >
                  <div className="flex flex-col sm:flex-row items-start gap-3 sm:gap-4">
                    <div className="flex items-center gap-2 shrink-0 pt-1">
                      <div className="flex flex-col items-center gap-1">
                        <div className="flex h-8 w-8 items-center justify-center rounded-md border border-border bg-muted/30">
                          <Zap className="w-3.5 h-3.5 text-muted-foreground" />
                        </div>
                        <span className="text-[10px] text-muted-foreground">{triggerLabel(auto.trigger_type)}</span>
                      </div>
                      <ArrowRight className="w-3.5 h-3.5 text-muted-foreground/55" />
                      <div className="flex flex-col items-center gap-1">
                        <div className="flex h-8 w-8 items-center justify-center rounded-md border border-border/40 bg-muted/30">
                          <GitBranch className="w-3.5 h-3.5 text-muted-foreground" />
                        </div>
                        <span className="text-[10px] text-muted-foreground/60">Condiciones</span>
                      </div>
                      <ArrowRight className="w-3.5 h-3.5 text-muted-foreground/55" />
                      <div className="flex flex-col items-center gap-1">
                        <div className="flex h-8 w-8 items-center justify-center rounded-md border border-border bg-muted/30">
                          <CheckCircle2 className="w-3.5 h-3.5 text-muted-foreground" />
                        </div>
                        <span className="text-[10px] text-muted-foreground">{auto.action_type ? auto.action_type.replace(/_/g,' ') : 'Acción'}</span>
                      </div>
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="text-[14px] font-medium text-foreground">{auto.name}</h3>
                        <span className={auto.enabled ? 'text-gray-700' : 'text-gray-400'} style={{ fontSize: 10 }}>
                          {auto.enabled ? '● Activa' : '○ Pausada'}
                        </span>
                      </div>
                      {auto.description && <p className="text-[12px] text-muted-foreground mb-2">{auto.description}</p>}
                      <div className="flex items-center gap-2">
                        <Switch checked={auto.enabled} onCheckedChange={() => toggleMut.mutate(auto.id)} />
                        <span className="text-[11px] text-muted-foreground">{auto.trigger_type.replace(/_/g,' ')}</span>
                        {auto.trigger_config_json?.channel_id && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded-full text-muted-foreground bg-muted/30">
                            {channels?.find((c: any)=>c.id===auto.trigger_config_json.channel_id)?.name || 'Canal específico'}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      <Button variant="ghost" size="sm" onClick={() => openEdit(auto)} className="text-muted-foreground hover:text-foreground text-xs">Editar</Button>
                      <Button variant="ghost" size="sm" onClick={() => setDeleteId(auto.id)} className="text-red-400/60 hover:text-red-400"><Trash2 className="w-3.5 h-3.5" /></Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </TabsContent>

        {/* ── Recipes tab ── */}
        <TabsContent value="recipes" className="flex-1 overflow-y-auto mt-0 p-4 pb-16 lg:pb-4">
          {recipesLoading ? (
            <div className="flex items-center justify-center py-16 text-muted-foreground text-sm">Cargando...</div>
          ) : (
            <div className="space-y-6 max-w-2xl">
              <p className="text-[12px] text-muted-foreground">
                Activá estas automatizaciones predefinidas con un solo clic. Podés configurar los parámetros antes de activarlas.
              </p>
              {Object.entries(recipesByCategory).map(([category, items]) => (
                <div key={category}>
                  <h3 className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground mb-2">
                    {CATEGORY_LABELS[category] ?? category}
                  </h3>
                  <div className="space-y-2">
                    {items.map((recipe: any) => {
                      const Icon = RECIPE_ICONS[recipe.slug] ?? Zap;
                      const isExpanded = expandedRecipe === recipe.slug;
                      const hasConfig = recipe.config_schema?.length > 0;
                      return (
                        <div key={recipe.slug} className={`rounded-lg border bg-card/40 transition-colors ${recipe.is_active ? "border-primary/30" : "border-border"}`}>
                          <div className="flex items-start gap-3 p-3">
                            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-border bg-muted/30 mt-0.5">
                              <Icon className="w-3.5 h-3.5 text-muted-foreground" strokeWidth={1.75} />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="text-[13px] font-medium text-foreground">{recipe.name}</span>
                                {recipe.is_active && (
                                  <Badge variant="secondary" className="h-4 px-1.5 text-[9px] text-emerald-700 bg-emerald-50 border-emerald-200">Activa</Badge>
                                )}
                              </div>
                              <p className="text-[11px] text-muted-foreground mt-0.5 leading-relaxed">{recipe.description}</p>
                              {hasConfig && recipe.is_active && (
                                <button
                                  onClick={() => setExpandedRecipe(isExpanded ? null : recipe.slug)}
                                  className="mt-1.5 flex items-center gap-1 text-[11px] text-primary/80 hover:text-primary"
                                >
                                  {isExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                                  Configurar
                                </button>
                              )}
                              {isExpanded && (
                                <RecipeConfigForm
                                  recipe={recipe}
                                  onSave={(config) => toggleRecipeMut.mutate({ slug: recipe.slug, config })}
                                  onCancel={() => setExpandedRecipe(null)}
                                />
                              )}
                            </div>
                            <Switch
                              checked={recipe.is_active}
                              onCheckedChange={() => {
                                if (!recipe.is_active && hasConfig) {
                                  setExpandedRecipe(recipe.slug);
                                } else {
                                  toggleRecipeMut.mutate({ slug: recipe.slug });
                                }
                              }}
                              disabled={toggleRecipeMut.isPending}
                              className="shrink-0 mt-0.5"
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Create/Edit Sheet */}
      <AutomationSheet
        key={editingAuto?.id || "new"}
        open={createOpen}
        onOpenChange={(o) => { if (!isSaving) setCreateOpen(o); }}
        members={members}
        channels={channels}
        currentPlan={currentPlan}
        currentCount={automations.length}
        editingAuto={editingAuto}
        onSave={handleSave}
        isSaving={isSaving}
        onClose={handleClose}
      />

      {/* Delete confirm */}
      {deleteId && (
        <Dialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
          <DialogContent className="max-w-sm bg-card border-border rounded-2xl">
            <DialogHeader><DialogTitle className="text-foreground text-sm">¿Eliminar automatización?</DialogTitle></DialogHeader>
            <p className="text-muted-foreground text-sm">Esta acción no se puede deshacer.</p>
            <div className="flex gap-2 justify-end pt-2">
              <Button variant="ghost" onClick={() => setDeleteId(null)} className="text-muted-foreground text-xs">Cancelar</Button>
              <Button onClick={() => deleteMut.mutate(deleteId)} variant="destructive" size="sm" className="text-xs">Eliminar</Button>
            </div>
          </DialogContent>
        </Dialog>
      )}
      <TemplateBrowser open={templateOpen} onClose={() => setTemplateOpen(false)} type="automation" />
      <HelpButton page="Automatizaciones" />
    </div>
  );
}
