import { useState, useCallback } from "react";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetFooter,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Loader2, Zap } from "lucide-react";
import { WorkflowSpine } from "./WorkflowSpine";
import { TriggerSelector } from "./TriggerSelector";
import { ActionSelector } from "./ActionSelector";
import { ConditionsSection, type ConditionRow } from "./ConditionsSection";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";

const PLAN_BADGE: Record<string, { label: string; className: string }> = {
  FREE: { label: "Free", className: "border-zinc-500/20 bg-zinc-500/5 text-zinc-400" },
  STARTER: { label: "Starter", className: "border-amber-500/20 bg-amber-500/5 text-amber-400" },
  GROWTH: { label: "Growth", className: "border-violet-500/20 bg-violet-500/5 text-violet-400" },
  ENTERPRISE: { label: "Business+", className: "border-yellow-500/20 bg-yellow-500/5 text-yellow-400" },
};

const AUTOMATION_LIMITS: Record<string, number> = {
  FREE: 5,
  STARTER: 25,
  GROWTH: 100,
  ENTERPRISE: Infinity,
};

interface AutomationSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  members: Record<string, any>[];
  channels: Record<string, any>[];
  currentPlan: string;
  currentCount: number;
  editingAuto: Record<string, any> | null;
  onSave: (payload: Record<string, any>) => Promise<void>;
  isSaving: boolean;
  onClose: () => void;
}

export function AutomationSheet({
  open,
  onOpenChange,
  members,
  channels,
  currentPlan,
  currentCount,
  editingAuto,
  onSave,
  isSaving,
  onClose,
}: AutomationSheetProps) {
  const isEditing = !!editingAuto;
  const limit = AUTOMATION_LIMITS[currentPlan] ?? 5;
  const atLimit = currentCount >= limit && !isEditing;
  const planBadge = PLAN_BADGE[currentPlan] || PLAN_BADGE.FREE;

  const [name, setName] = useState(editingAuto?.name ?? "");
  const [description, setDescription] = useState(editingAuto?.description ?? "");
  const [triggerType, setTriggerType] = useState(editingAuto?.trigger_type ?? "MESSAGE_RECEIVED");
  const [actionType, setActionType] = useState(editingAuto?.action_type ?? "notify_in_app");
  const [actionValue, setActionValue] = useState(editingAuto?.action_config_json?.value ?? "");
  const [channelId, setChannelId] = useState(editingAuto?.trigger_config_json?.channel_id ?? "");
  const [conditions, setConditions] = useState<ConditionRow[]>(
    editingAuto?.condition_config_json && Array.isArray(editingAuto.condition_config_json)
      ? editingAuto.condition_config_json.map((c) => ({
          field: c.field ?? "body_text",
          operator: c.operator ?? "contains",
          value: String(c.value ?? ""),
        }))
      : []
  );

  const handleSave = useCallback(async () => {
    const payload: Record<string, any> = {
      name: name.trim(),
      description: description.trim() || undefined,
      trigger_type: triggerType,
      trigger_config_json: channelId ? { channel_id: channelId } : {},
      action_config_json: { value: actionValue, type: actionType },
    };

    const activeConditions = conditions.filter(c => c.field && c.value);
    if (activeConditions.length > 0) {
      payload.condition_config_json = activeConditions;
    }

    await onSave(payload);
  }, [name, description, triggerType, actionType, actionValue, channelId, conditions, onSave]);

  const hasBoth = !!triggerType && !!actionType;
  const canSave = name.trim().length > 0 && !atLimit;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-[570px] sm:max-w-[570px] p-0 gap-0 flex flex-col h-full"
        onInteractOutside={(e) => { if (isSaving) e.preventDefault(); }}
      >
        {/* Header */}
        <SheetHeader className="px-6 py-4 border-b border-border/60 space-y-1 shrink-0">
          <div className="flex items-center justify-between">
            <div>
              <SheetTitle className="text-sm font-semibold">
                {isEditing ? "Editar automatización" : "Nueva automatización"}
              </SheetTitle>
              <SheetDescription className="text-[11px] mt-0.5">
                Define cuándo se ejecuta y qué acción realizar.
              </SheetDescription>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className={cn("text-[10px] px-2 py-0.5 border", planBadge.className)}>
                {planBadge.label}
              </Badge>
              <Badge
                variant="outline"
                className={cn(
                  "text-[10px] px-2 py-0.5 border",
                  atLimit
                    ? "border-red-500/20 bg-red-500/5 text-red-400"
                    : "border-emerald-500/20 bg-emerald-500/5 text-emerald-400"
                )}
              >
                {currentCount}/{limit === Infinity ? "∞" : limit}
              </Badge>
            </div>
          </div>
        </SheetHeader>

        {/* Body: spine + config */}
        <div className="flex flex-row flex-1 min-h-0 overflow-hidden">
          {/* Workflow spine */}
          <WorkflowSpine triggerType={triggerType} actionType={actionType} hasBoth={hasBoth} />

          {/* Config panel */}
          <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">
            {/* Name & Description */}
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label className="text-[11px] text-muted-foreground">
                  Nombre <span className="text-red-400">*</span>
                </Label>
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Ej: Notificar mensajes urgentes"
                  className="h-9 text-xs bg-background border-border"
                  autoFocus
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-[11px] text-muted-foreground">Descripción</Label>
                <Textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Describe qué hace esta automatización..."
                  className="min-h-[60px] text-xs bg-background border-border resize-none"
                />
              </div>
            </div>

            <Separator className="bg-border/60" />

            {/* Trigger selector */}
            <TriggerSelector
              value={triggerType}
              onChange={setTriggerType}
              channels={channels}
              channelId={channelId}
              onChannelChange={setChannelId}
            />

            {/* Conditions */}
            <ConditionsSection
              conditions={conditions}
              onChange={setConditions}
              currentPlan={currentPlan}
              isEditing={isEditing}
            />

            {/* Action selector */}
            <ActionSelector
              value={actionType}
              onChange={setActionType}
              actionValue={actionValue}
              onActionValueChange={setActionValue}
              members={members}
            />

            {/* Limit warning */}
            {atLimit && (
              <div className="rounded-xl border border-amber-500/10 bg-amber-500/[0.03] p-3 flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center shrink-0">
                  <Zap className="w-4 h-4 text-amber-400" />
                </div>
                <div>
                  <p className="text-[11px] font-medium text-amber-400">
                    Límite de {limit} automatizaciones alcanzado
                  </p>
                  <p className="text-[10px] text-muted-foreground">
                    Mejora tu plan para crear más automatizaciones.
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <SheetFooter className="px-6 py-3 border-t border-border/60 shrink-0 flex-row justify-between items-center sm:justify-between">
          <Button variant="ghost" size="sm" onClick={onClose} disabled={isSaving} className="h-8 text-xs">
            Cancelar
          </Button>
          <Button
            size="sm"
            onClick={handleSave}
            disabled={isSaving || !canSave}
            className="h-8 text-xs gap-1.5 bg-violet-600 hover:bg-violet-700"
          >
            {isSaving ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Zap className="w-3.5 h-3.5" />
            )}
            {isEditing ? "Guardar cambios" : "Crear automatización"}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
