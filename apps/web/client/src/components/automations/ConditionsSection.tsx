import { useState } from "react";
import { Plus, X, ChevronDown, ChevronUp, Lock } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const FIELDS = [
  { value: "body_text", label: "Texto del mensaje" },
  { value: "channel_type", label: "Tipo de canal" },
  { value: "contact_name", label: "Nombre del contacto" },
  { value: "contact_email", label: "Email del contacto" },
  { value: "priority", label: "Prioridad" },
  { value: "status", label: "Estado" },
  { value: "assigned_to", label: "Asignado a" },
] as const;

const OPERATORS = [
  { value: "contains", label: "Contiene" },
  { value: "not_contains", label: "No contiene" },
  { value: "equals", label: "Es igual a" },
  { value: "not_equals", label: "No es igual a" },
  { value: "starts_with", label: "Empieza con" },
  { value: "ends_with", label: "Termina con" },
  { value: "exists", label: "Existe" },
] as const;

export interface ConditionRow {
  field: string;
  operator: string;
  value: string;
}

interface ConditionsSectionProps {
  conditions: ConditionRow[];
  onChange: (conditions: ConditionRow[]) => void;
  currentPlan: string;
  isEditing?: boolean;
}

const PLAN_ALLOWS_CONDITIONS = ["GROWTH", "ENTERPRISE"];

export function ConditionsSection({ conditions, onChange, currentPlan, isEditing }: ConditionsSectionProps) {
  const [expanded, setExpanded] = useState(false);
  const hasConditions = PLAN_ALLOWS_CONDITIONS.includes(currentPlan);

  const addRow = () => {
    onChange([...conditions, { field: "body_text", operator: "contains", value: "" }]);
  };

  const removeRow = (index: number) => {
    onChange(conditions.filter((_, i) => i !== index));
  };

  const updateRow = (index: number, updates: Partial<ConditionRow>) => {
    onChange(conditions.map((c, i) => (i === index ? { ...c, ...updates } : c)));
  };

  if (!hasConditions) {
    return (
      <div className="rounded-xl border border-border/60 bg-card/40 p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
              Condiciones
            </span>
            <Badge variant="outline" className="text-[9px] px-1.5 py-0 border-amber-500/20 bg-amber-500/5 text-amber-400">
              <Lock className="w-2.5 h-2.5 mr-0.5" />
              {currentPlan === "FREE" ? "Starter+" : "Growth+"}
            </Badge>
          </div>
        </div>
        <p className="text-[11px] text-muted-foreground/60 mt-2">
          {currentPlan === "FREE"
            ? "Mejora a Starter o superior para filtrar automatizaciones por condiciones."
            : "Mejora a Growth o superior para filtrar automatizaciones por condiciones."}
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-border/60 bg-card/40 overflow-hidden">
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between p-4 hover:bg-accent/30 transition-colors"
      >
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-medium text-foreground uppercase tracking-wider">
            Condiciones
          </span>
          {conditions.length > 0 && (
            <Badge variant="outline" className="text-[9px] px-1.5 py-0 border-violet-500/20 bg-violet-500/5 text-violet-400">
              {conditions.length}
            </Badge>
          )}
          <span className="text-[10px] text-muted-foreground">(opcional)</span>
        </div>
        {expanded ? (
          <ChevronUp className="w-4 h-4 text-muted-foreground" />
        ) : (
          <ChevronDown className="w-4 h-4 text-muted-foreground" />
        )}
      </button>

      {expanded && (
        <div className="px-4 pb-4 space-y-3">
          <p className="text-[10px] text-muted-foreground/60">
            Filtra cuándo se ejecuta esta automatización. Todas las condiciones deben cumplirse.
          </p>

          {conditions.length === 0 ? (
            <div className="text-center py-4">
              <p className="text-[11px] text-muted-foreground/50">Sin condiciones. La automatización se ejecutará siempre que ocurra el evento.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {conditions.map((row, i) => (
                <div key={i} className="flex items-start gap-2">
                  <div className="grid grid-cols-3 gap-2 flex-1">
                    <Select value={row.field} onValueChange={(v) => updateRow(i, { field: v })}>
                      <SelectTrigger className="h-8 text-[11px] bg-background border-border">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {FIELDS.map(f => (
                          <SelectItem key={f.value} value={f.value} className="text-[11px]">{f.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Select value={row.operator} onValueChange={(v) => updateRow(i, { operator: v })}>
                      <SelectTrigger className="h-8 text-[11px] bg-background border-border">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {OPERATORS.map(o => (
                          <SelectItem key={o.value} value={o.value} className="text-[11px]">{o.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Input
                      value={row.value}
                      onChange={(e) => updateRow(i, { value: e.target.value })}
                      placeholder="Valor"
                      className="h-8 text-[11px] bg-background border-border"
                      disabled={row.operator === "exists"}
                    />
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => removeRow(i)}
                    className="h-8 w-8 shrink-0 text-muted-foreground hover:text-red-400"
                  >
                    <X className="w-3.5 h-3.5" />
                  </Button>
                </div>
              ))}
            </div>
          )}

          {conditions.length < 5 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={addRow}
              className="h-7 text-[11px] gap-1 text-muted-foreground hover:text-foreground"
            >
              <Plus className="w-3 h-3" />
              Agregar condición
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
