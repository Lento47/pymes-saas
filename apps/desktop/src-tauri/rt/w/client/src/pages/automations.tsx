import { useMemo, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { api, parsePlanError } from "@/lib/api";
import { queryClient } from "@/lib/queryClient";
import { useAuth, useRequireAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { PageLoader } from "@/components/shared/loading-spinner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Bot, Code2, Loader2, MoreHorizontal, Pencil, Plus, Sparkles, Trash2, Zap } from "lucide-react";

const TRIGGER_TYPES = [
  "MESSAGE_RECEIVED", "CONVERSATION_CREATED", "CONVERSATION_STATUS_CHANGED",
  "TASK_CREATED", "TASK_OVERDUE", "DOCUMENT_UPLOADED", "DOCUMENT_PROCESSED",
  "SCHEDULED", "MANUAL",
] as const;

const CONDITION_OPERATORS = [
  { value: "eq", label: "es igual a" },
  { value: "neq", label: "no es igual a" },
  { value: "contains", label: "contiene" },
  { value: "not_contains", label: "no contiene" },
  { value: "exists", label: "existe / no existe" },
  { value: "gt", label: ">" },
  { value: "gte", label: ">=" },
  { value: "lt", label: "<" },
  { value: "lte", label: "<=" },
] as const;

const ACTION_TYPES = [
  { value: "notify_in_app", label: "Notificar en app" },
  { value: "set_priority", label: "Cambiar prioridad" },
  { value: "set_status", label: "Cambiar estado" },
  { value: "assign", label: "Asignar agente" },
  { value: "create_task", label: "Crear tarea" },
] as const;

const PRIORITIES = ["LOW", "MEDIUM", "HIGH", "URGENT"] as const;
const CONVERSATION_STATUSES = ["NEW", "OPEN", "PENDING", "RESOLVED", "ARCHIVED"] as const;
const TASK_STATUSES = ["TODO", "IN_PROGRESS", "BLOCKED", "DONE", "ARCHIVED"] as const;

const FIELD_OPTIONS: Record<string, Array<{ value: string; label: string }>> = {
  MESSAGE_RECEIVED: [
    { value: "body_text", label: "Texto del mensaje" },
    { value: "sender_ref", label: "Remitente" },
    { value: "sender_name", label: "Nombre remitente" },
    { value: "direction", label: "Dirección" },
  ],
  CONVERSATION_CREATED: [
    { value: "subject", label: "Asunto" },
    { value: "status", label: "Estado" },
    { value: "priority", label: "Prioridad" },
    { value: "category", label: "Categoría" },
    { value: "assigned_user_id", label: "Agente asignado" },
  ],
  CONVERSATION_STATUS_CHANGED: [
    { value: "subject", label: "Asunto" },
    { value: "status", label: "Estado" },
    { value: "priority", label: "Prioridad" },
    { value: "category", label: "Categoría" },
    { value: "assigned_user_id", label: "Agente asignado" },
  ],
  TASK_CREATED: [
    { value: "title", label: "Título" },
    { value: "status", label: "Estado" },
    { value: "priority", label: "Prioridad" },
    { value: "assigned_user_id", label: "Responsable" },
  ],
  TASK_OVERDUE: [
    { value: "title", label: "Título" },
    { value: "status", label: "Estado" },
    { value: "priority", label: "Prioridad" },
    { value: "assigned_user_id", label: "Responsable" },
  ],
  DOCUMENT_UPLOADED: [
    { value: "file_name", label: "Nombre de archivo" },
    { value: "mime_type", label: "Tipo MIME" },
    { value: "status", label: "Estado" },
  ],
  DOCUMENT_PROCESSED: [
    { value: "file_name", label: "Nombre de archivo" },
    { value: "mime_type", label: "Tipo MIME" },
    { value: "status", label: "Estado" },
  ],
  SCHEDULED: [],
  MANUAL: [],
};

type BuilderMode = "manual" | "advanced" | "ai";

type ManualFormState = {
  name: string;
  triggerType: string;
  conditions: Array<{
    enabled: boolean;
    field: string;
    operator: string;
    value: string;
  }>;
  actionType: string;
  actionPriority: string;
  actionStatus: string;
  actionUserId: string;
  actionTitle: string;
  actionBody: string;
  actionAssignedUserId: string;
};

type AdvancedFormState = {
  name: string;
  triggerType: string;
  triggerJson: string;
  conditionJson: string;
  actionJson: string;
};

type AiFormState = {
  name: string;
  prompt: string;
};

const emptyManualForm = (): ManualFormState => ({
  name: "",
  triggerType: "MESSAGE_RECEIVED",
  conditions: [
    { enabled: false, field: "body_text", operator: "contains", value: "" },
    { enabled: false, field: "body_text", operator: "contains", value: "" },
    { enabled: false, field: "body_text", operator: "contains", value: "" },
  ],
  actionType: "notify_in_app",
  actionPriority: "HIGH",
  actionStatus: "OPEN",
  actionUserId: "AUTO",
  actionTitle: "",
  actionBody: "",
  actionAssignedUserId: "AUTO",
});

const emptyAdvancedForm = (): AdvancedFormState => ({
  name: "",
  triggerType: "MESSAGE_RECEIVED",
  triggerJson: "{}",
  conditionJson: "{}",
  actionJson: JSON.stringify({ type: "notify_in_app" }, null, 2),
});

const emptyAiForm = (): AiFormState => ({
  name: "",
  prompt: "",
});

function parseJsonField(value: string, fieldName: string) {
  try {
    return JSON.parse(value);
  } catch {
    throw new Error(`JSON inválido en ${fieldName}.`);
  }
}

function prettyJson(value: unknown) {
  return JSON.stringify(value ?? {}, null, 2);
}

function inferBuilderMode(auto: any): BuilderMode {
  const action = auto?.action_config_json;
  const condition = auto?.condition_config_json;
  const actionType = Array.isArray(action) ? action[0]?.type : action?.type;

  if (
    actionType &&
    ["notify_in_app", "set_priority", "set_status", "assign", "create_task"].includes(actionType)
  ) {
    const isSimpleCondition =
      !condition ||
      (
        typeof condition === "object" &&
        "field" in condition &&
        "operator" in condition
      );

    if (isSimpleCondition) return "manual";
  }

  return "advanced";
}

function automationToManualForm(auto: any): ManualFormState {
  const action = Array.isArray(auto?.action_config_json)
    ? auto.action_config_json[0] ?? {}
    : auto?.action_config_json ?? {};
  const condition = auto?.condition_config_json ?? {};

  return {
    name: auto?.name ?? "",
    triggerType: auto?.trigger_type ?? "MESSAGE_RECEIVED",
    conditions: (() => {
      const normalized = Array.isArray(condition)
        ? condition
        : condition?.field && condition?.operator
          ? [condition]
          : [];
      const fallbackField = FIELD_OPTIONS[auto?.trigger_type ?? "MESSAGE_RECEIVED"]?.[0]?.value ?? "body_text";
      return Array.from({ length: 3 }).map((_, index) => {
        const current = normalized[index];
        return {
          enabled: Boolean(current?.field && current?.operator),
          field: current?.field ?? fallbackField,
          operator: current?.operator ?? "contains",
          value: current?.value === undefined ? "" : String(current.value),
        };
      });
    })(),
    actionType: action?.type ?? "notify_in_app",
    actionPriority: action?.priority ?? "HIGH",
    actionStatus: action?.status ?? "OPEN",
    actionUserId: action?.user_id ?? "AUTO",
    actionTitle: action?.title ?? "",
    actionBody: action?.body ?? action?.description ?? "",
    actionAssignedUserId: action?.assigned_user_id ?? "AUTO",
  };
}

function automationToAdvancedForm(auto: any): AdvancedFormState {
  return {
    name: auto?.name ?? "",
    triggerType: auto?.trigger_type ?? "MESSAGE_RECEIVED",
    triggerJson: prettyJson(auto?.trigger_config_json ?? {}),
    conditionJson: prettyJson(auto?.condition_config_json ?? {}),
    actionJson: prettyJson(auto?.action_config_json ?? {}),
  };
}

function buildManualPayload(form: ManualFormState) {
  const action: Record<string, unknown> = { type: form.actionType };

  if (form.actionType === "notify_in_app") {
    if (form.actionUserId !== "AUTO") action.user_id = form.actionUserId;
    if (form.actionTitle.trim()) action.title = form.actionTitle.trim();
    if (form.actionBody.trim()) action.body = form.actionBody.trim();
  }

  if (form.actionType === "set_priority") {
    action.priority = form.actionPriority;
  }

  if (form.actionType === "set_status") {
    action.status = form.actionStatus;
  }

  if (form.actionType === "assign") {
    action.user_id = form.actionUserId === "AUTO" ? null : form.actionUserId;
  }

  if (form.actionType === "create_task") {
    action.title = form.actionTitle.trim() || "Tarea automática";
    if (form.actionBody.trim()) action.description = form.actionBody.trim();
    action.priority = form.actionPriority;
      if (form.actionAssignedUserId !== "AUTO") {
      action.assigned_user_id = form.actionAssignedUserId;
    }
  }

  const payload: Record<string, unknown> = {
    name: form.name.trim(),
    trigger_type: form.triggerType,
    trigger_config_json: {},
    action_config_json: action,
  };

  const conditions = form.conditions
    .filter((condition) => condition.enabled && condition.field)
    .map((condition) => ({
      field: condition.field,
      operator: condition.operator,
      value:
        condition.operator === "exists"
          ? condition.value === "true"
          : condition.value,
    }));

  if (conditions.length > 0) {
    payload.condition_config_json = conditions;
  }

  return payload;
}

function buildAdvancedPayload(form: AdvancedFormState) {
  return {
    name: form.name.trim(),
    trigger_type: form.triggerType,
    trigger_config_json: parseJsonField(form.triggerJson, "trigger_config_json"),
    condition_config_json: parseJsonField(form.conditionJson, "condition_config_json"),
    action_config_json: parseJsonField(form.actionJson, "action_config_json"),
  };
}

function AccessBadge({ label }: { label: string }) {
  return (
    <Badge variant="outline" className="text-[10px] px-1.5 py-0 border border-amber-500/20 bg-amber-500/10 text-amber-300">
      {label}
    </Badge>
  );
}

function ManualBuilder({
  form,
  setForm,
  members,
}: {
  form: ManualFormState;
  setForm: (next: ManualFormState) => void;
  members: any[];
}) {
  const fieldOptions = FIELD_OPTIONS[form.triggerType] ?? [];

  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <Label className="text-xs text-muted-foreground">Nombre</Label>
        <Input
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
          className="h-8 text-xs bg-background border-border"
        />
      </div>

      <div className="space-y-1">
        <Label className="text-xs text-muted-foreground">Trigger Type</Label>
        <Select
          value={form.triggerType}
          onValueChange={(value) =>
            setForm({
              ...form,
              triggerType: value,
              conditions: form.conditions.map((condition) => ({
                ...condition,
                field: FIELD_OPTIONS[value]?.[0]?.value ?? "",
              })),
            })
          }
        >
          <SelectTrigger className="h-8 text-xs bg-background border-border">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {TRIGGER_TYPES.map((t) => (
              <SelectItem key={t} value={t}>
                {t.replace(/_/g, " ")}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="rounded-lg border border-border p-3 space-y-3 bg-background/40">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-xs text-foreground">Condiciones</div>
            <div className="text-[11px] text-muted-foreground">Hasta 3 condiciones en Freemium. Todas deben cumplirse.</div>
          </div>
          <Badge variant="outline" className="text-[10px] px-1.5 py-0 border border-emerald-500/20 bg-emerald-500/10 text-emerald-300">
            3 condiciones
          </Badge>
        </div>

        <div className="space-y-3">
          {form.conditions.map((condition, index) => (
            <div key={index} className="rounded-md border border-border p-3 space-y-3">
              <div className="flex items-center justify-between">
                <div className="text-[11px] text-foreground">Condición {index + 1}</div>
                <Switch
                  checked={condition.enabled}
                  onCheckedChange={(checked) =>
                    setForm({
                      ...form,
                      conditions: form.conditions.map((current, currentIndex) =>
                        currentIndex === index ? { ...current, enabled: checked } : current,
                      ),
                    })
                  }
                />
              </div>

              {condition.enabled && (
                <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Campo</Label>
                    <Select
                      value={condition.field}
                      onValueChange={(value) =>
                        setForm({
                          ...form,
                          conditions: form.conditions.map((current, currentIndex) =>
                            currentIndex === index ? { ...current, field: value } : current,
                          ),
                        })
                      }
                    >
                      <SelectTrigger className="h-8 text-xs bg-background border-border">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {fieldOptions.length === 0 ? (
                          <SelectItem value="none" disabled>Sin campos disponibles</SelectItem>
                        ) : (
                          fieldOptions.map((field) => (
                            <SelectItem key={field.value} value={field.value}>
                              {field.label}
                            </SelectItem>
                          ))
                        )}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Operador</Label>
                    <Select
                      value={condition.operator}
                      onValueChange={(value) =>
                        setForm({
                          ...form,
                          conditions: form.conditions.map((current, currentIndex) =>
                            currentIndex === index ? { ...current, operator: value } : current,
                          ),
                        })
                      }
                    >
                      <SelectTrigger className="h-8 text-xs bg-background border-border">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {CONDITION_OPERATORS.map((operator) => (
                          <SelectItem key={operator.value} value={operator.value}>
                            {operator.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Valor</Label>
                    {condition.operator === "exists" ? (
                      <Select
                        value={condition.value || "true"}
                        onValueChange={(value) =>
                          setForm({
                            ...form,
                            conditions: form.conditions.map((current, currentIndex) =>
                              currentIndex === index ? { ...current, value } : current,
                            ),
                          })
                        }
                      >
                        <SelectTrigger className="h-8 text-xs bg-background border-border">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="true">Sí existe</SelectItem>
                          <SelectItem value="false">No existe</SelectItem>
                        </SelectContent>
                      </Select>
                    ) : (
                      <Input
                        value={condition.value}
                        onChange={(e) =>
                          setForm({
                            ...form,
                            conditions: form.conditions.map((current, currentIndex) =>
                              currentIndex === index ? { ...current, value: e.target.value } : current,
                            ),
                          })
                        }
                        className="h-8 text-xs bg-background border-border"
                        placeholder="Valor esperado"
                      />
                    )}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-lg border border-border p-3 space-y-3 bg-background/40">
        <div>
          <div className="text-xs text-foreground">Acción</div>
          <div className="text-[11px] text-muted-foreground">Qué debe hacer exactamente la regla cuando se cumpla.</div>
        </div>

        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">Tipo de acción</Label>
          <Select
            value={form.actionType}
            onValueChange={(value) => setForm({ ...form, actionType: value })}
          >
            <SelectTrigger className="h-8 text-xs bg-background border-border">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {ACTION_TYPES.map((action) => (
                <SelectItem key={action.value} value={action.value}>
                  {action.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {(form.actionType === "notify_in_app" || form.actionType === "assign") && (
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">
              {form.actionType === "assign" ? "Agente destino" : "Destinatario"}
            </Label>
            <Select
              value={form.actionUserId}
              onValueChange={(value) => setForm({ ...form, actionUserId: value })}
            >
              <SelectTrigger className="h-8 text-xs bg-background border-border">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="AUTO">
                  {form.actionType === "assign" ? "Sin asignar" : "Auto (asignado u owner)"}
                </SelectItem>
                {members.map((member: any) => (
                  <SelectItem key={member.user?.id || member.id} value={member.user?.id || member.id}>
                    {member.user?.name || member.name || member.email}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {form.actionType === "notify_in_app" && (
          <>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Título</Label>
              <Input
                value={form.actionTitle}
                onChange={(e) => setForm({ ...form, actionTitle: e.target.value })}
                className="h-8 text-xs bg-background border-border"
                placeholder="Notificación automática"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Mensaje</Label>
              <Textarea
                value={form.actionBody}
                onChange={(e) => setForm({ ...form, actionBody: e.target.value })}
                className="min-h-[88px] text-xs bg-background border-border"
                placeholder="Texto que verá el usuario"
              />
            </div>
          </>
        )}

        {form.actionType === "set_priority" && (
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Prioridad</Label>
            <Select
              value={form.actionPriority}
              onValueChange={(value) => setForm({ ...form, actionPriority: value })}
            >
              <SelectTrigger className="h-8 text-xs bg-background border-border">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PRIORITIES.map((priority) => (
                  <SelectItem key={priority} value={priority}>{priority}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {form.actionType === "set_status" && (
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Estado</Label>
            <Select
              value={form.actionStatus}
              onValueChange={(value) => setForm({ ...form, actionStatus: value })}
            >
              <SelectTrigger className="h-8 text-xs bg-background border-border">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CONVERSATION_STATUSES.map((status) => (
                  <SelectItem key={status} value={status}>{status}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {form.actionType === "create_task" && (
          <>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Título de tarea</Label>
              <Input
                value={form.actionTitle}
                onChange={(e) => setForm({ ...form, actionTitle: e.target.value })}
                className="h-8 text-xs bg-background border-border"
                placeholder="Tarea automática"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Descripción</Label>
              <Textarea
                value={form.actionBody}
                onChange={(e) => setForm({ ...form, actionBody: e.target.value })}
                className="min-h-[88px] text-xs bg-background border-border"
                placeholder="Instrucciones para la tarea"
              />
            </div>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Prioridad</Label>
                <Select
                  value={form.actionPriority}
                  onValueChange={(value) => setForm({ ...form, actionPriority: value })}
                >
                  <SelectTrigger className="h-8 text-xs bg-background border-border">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PRIORITIES.map((priority) => (
                      <SelectItem key={priority} value={priority}>{priority}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Asignar a</Label>
                <Select
                  value={form.actionAssignedUserId}
                  onValueChange={(value) => setForm({ ...form, actionAssignedUserId: value })}
                >
                  <SelectTrigger className="h-8 text-xs bg-background border-border">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="AUTO">Sin asignar</SelectItem>
                    {members.map((member: any) => (
                      <SelectItem key={member.user?.id || member.id} value={member.user?.id || member.id}>
                        {member.user?.name || member.name || member.email}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function AdvancedBuilder({
  form,
  setForm,
  locked,
}: {
  form: AdvancedFormState;
  setForm: (next: AdvancedFormState) => void;
  locked: boolean;
}) {
  return (
    <div className="space-y-4">
      {locked && (
        <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-3 text-xs text-amber-100">
          Editor JSON avanzado disponible en plan Pro (`GROWTH`) o superior.
        </div>
      )}

      <div className="space-y-1">
        <Label className="text-xs text-muted-foreground">Nombre</Label>
        <Input
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
          className="h-8 text-xs bg-background border-border"
          disabled={locked}
        />
      </div>

      <div className="space-y-1">
        <Label className="text-xs text-muted-foreground">Trigger Type</Label>
        <Select
          value={form.triggerType}
          onValueChange={(value) => setForm({ ...form, triggerType: value })}
          disabled={locked}
        >
          <SelectTrigger className="h-8 text-xs bg-background border-border">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {TRIGGER_TYPES.map((t) => (
              <SelectItem key={t} value={t}>{t.replace(/_/g, " ")}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-1">
        <Label className="text-xs text-muted-foreground">trigger_config_json</Label>
        <Textarea
          value={form.triggerJson}
          onChange={(e) => setForm({ ...form, triggerJson: e.target.value })}
          className="min-h-[88px] font-mono text-[11px] bg-background border-border"
          disabled={locked}
        />
      </div>

      <div className="space-y-1">
        <Label className="text-xs text-muted-foreground">condition_config_json</Label>
        <Textarea
          value={form.conditionJson}
          onChange={(e) => setForm({ ...form, conditionJson: e.target.value })}
          className="min-h-[88px] font-mono text-[11px] bg-background border-border"
          disabled={locked}
        />
      </div>

      <div className="space-y-1">
        <Label className="text-xs text-muted-foreground">action_config_json</Label>
        <Textarea
          value={form.actionJson}
          onChange={(e) => setForm({ ...form, actionJson: e.target.value })}
          className="min-h-[120px] font-mono text-[11px] bg-background border-border"
          disabled={locked}
        />
      </div>
    </div>
  );
}

function AiBuilder({
  form,
  setForm,
  allowed,
}: {
  form: AiFormState;
  setForm: (next: AiFormState) => void;
  allowed: boolean;
}) {
  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-border p-3 bg-background/40">
        <div className="flex items-center gap-2 mb-2">
          <Bot className="w-4 h-4 text-sky-300" />
          <div className="text-xs text-foreground">Modo IA</div>
          {allowed ? <AccessBadge label="Premium / Pro Max" /> : <AccessBadge label="Bloqueado" />}
        </div>
        <p className="text-[11px] text-muted-foreground">
          Describe la regla en lenguaje natural y conviértela a configuración estructurada.
          La UI queda preparada, pero el motor de conversión IA todavía no está conectado.
        </p>
      </div>

      <div className="space-y-1">
        <Label className="text-xs text-muted-foreground">Nombre sugerido</Label>
        <Input
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
          className="h-8 text-xs bg-background border-border"
          disabled
        />
      </div>

      <div className="space-y-1">
        <Label className="text-xs text-muted-foreground">Prompt</Label>
        <Textarea
          value={form.prompt}
          onChange={(e) => setForm({ ...form, prompt: e.target.value })}
          className="min-h-[140px] text-xs bg-background border-border"
          placeholder='Ejemplo: "Cuando llegue un mensaje que contenga urgente, asignarlo a Soporte y crear una tarea alta prioridad".'
          disabled
        />
      </div>
    </div>
  );
}

export default function AutomationsPage() {
  useRequireAuth();
  const { user } = useAuth();
  const { toast } = useToast();
  const [showCreate, setShowCreate] = useState(false);
  const [editTarget, setEditTarget] = useState<any>(null);
  const [deleteTarget, setDeleteTarget] = useState<any>(null);
  const [createMode, setCreateMode] = useState<BuilderMode>("manual");
  const [editMode, setEditMode] = useState<BuilderMode>("manual");
  const [manualForm, setManualForm] = useState<ManualFormState>(emptyManualForm());
  const [advancedForm, setAdvancedForm] = useState<AdvancedFormState>(emptyAdvancedForm());
  const [aiForm, setAiForm] = useState<AiFormState>(emptyAiForm());
  const [editManualForm, setEditManualForm] = useState<ManualFormState>(emptyManualForm());
  const [editAdvancedForm, setEditAdvancedForm] = useState<AdvancedFormState>(emptyAdvancedForm());
  const [editAiForm, setEditAiForm] = useState<AiFormState>(emptyAiForm());

  const currentPlan = user?.workspace?.plan ?? "FREE";
  const hasAdvancedBuilder = ["GROWTH", "ENTERPRISE"].includes(currentPlan);
  const hasAiBuilder = ["ENTERPRISE"].includes(currentPlan);

  const { data, isLoading } = useQuery({
    queryKey: ["/api/automations"],
    queryFn: () => api.getAutomations(),
  });

  const { data: membersData } = useQuery({
    queryKey: ["/api/workspaces/current/members", "automation-builder"],
    queryFn: () => api.getMembers(),
  });

  const members = Array.isArray(membersData) ? membersData : membersData?.data || [];
  const autoList = Array.isArray(data) ? data : data?.data || [];

  const createPayload = useMemo(() => {
    try {
      if (createMode === "manual") return buildManualPayload(manualForm);
      if (createMode === "advanced") return buildAdvancedPayload(advancedForm);
      return null;
    } catch {
      return null;
    }
  }, [createMode, manualForm, advancedForm]);

  const createMutation = useMutation({
    mutationFn: async () => {
      if (createMode === "ai") {
        throw new Error("El modo IA todavía no está conectado.");
      }
      if (createMode === "advanced" && !hasAdvancedBuilder) {
        throw new Error("El editor JSON avanzado requiere plan Pro o superior.");
      }
      if (!createPayload) {
        throw new Error("Revisa la configuración antes de guardar.");
      }
      return api.createAutomation(createPayload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/automations"] });
      setShowCreate(false);
      setCreateMode("manual");
      setManualForm(emptyManualForm());
      setAdvancedForm(emptyAdvancedForm());
      setAiForm(emptyAiForm());
      toast({ title: "Automatización creada" });
    },
    onError: (err: any) => {
      const { isPlanLimit, message } = parsePlanError(err);
      toast({
        title: isPlanLimit ? "🔒 Límite de plan alcanzado" : "No se pudo crear la automatización",
        description: message,
        variant: "destructive",
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, mode }: { id: string; mode: BuilderMode }) => {
      if (mode === "ai") {
        throw new Error("El modo IA todavía no está conectado.");
      }
      if (mode === "advanced" && !hasAdvancedBuilder) {
        throw new Error("El editor JSON avanzado requiere plan Pro o superior.");
      }
      const payload = mode === "manual"
        ? buildManualPayload(editManualForm)
        : buildAdvancedPayload(editAdvancedForm);

      return api.updateAutomation(id, payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/automations"] });
      setEditTarget(null);
      toast({ title: "Automatización actualizada" });
    },
    onError: (err: any) => {
      toast({ title: "No se pudo actualizar", description: err.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.deleteAutomation(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/automations"] });
      setDeleteTarget(null);
      toast({ title: "Automatización eliminada" });
    },
    onError: (err: any) => {
      toast({ title: "No se pudo eliminar", description: err.message, variant: "destructive" });
    },
  });

  const toggleMutation = useMutation({
    mutationFn: (id: string) => api.toggleAutomation(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/automations"] }),
    onError: (err: any) => {
      toast({ title: "No se pudo cambiar el estado", description: err.message, variant: "destructive" });
    },
  });

  function openEdit(auto: any) {
    const mode = inferBuilderMode(auto);
    setEditMode(mode);
    setEditManualForm(automationToManualForm(auto));
    setEditAdvancedForm(automationToAdvancedForm(auto));
    setEditAiForm({ name: auto?.name ?? "", prompt: "" });
    setEditTarget(auto);
  }

  return (
    <div>
      <PageHeader title="Automations" description="Construye reglas manuales, flujos avanzados y una base para automatización asistida por IA.">
        <div className="flex items-center gap-2">
          <AccessBadge label={`Plan ${currentPlan}`} />
          <Button size="sm" className="h-8 text-xs" onClick={() => setShowCreate(true)}>
            <Plus className="w-3.5 h-3.5 mr-1.5" /> Nueva automatización
          </Button>
        </div>
      </PageHeader>

      <div className="grid gap-3 md:grid-cols-3 mb-4">
        <div className="rounded-lg border border-border bg-card p-4">
          <div className="flex items-center gap-2 mb-1">
            <Sparkles className="w-4 h-4 text-emerald-300" />
            <div className="text-sm text-foreground font-medium">Regla manual</div>
          </div>
          <p className="text-xs text-muted-foreground">Trigger + condición + acción exacta. Disponible hoy.</p>
        </div>
        <div className="rounded-lg border border-border bg-card p-4">
          <div className="flex items-center gap-2 mb-1">
            <Code2 className="w-4 h-4 text-sky-300" />
            <div className="text-sm text-foreground font-medium">JSON avanzado</div>
            <AccessBadge label="Pro" />
          </div>
          <p className="text-xs text-muted-foreground">Máxima granularidad editando `trigger`, `condition` y `action` directamente.</p>
        </div>
        <div className="rounded-lg border border-border bg-card p-4">
          <div className="flex items-center gap-2 mb-1">
            <Bot className="w-4 h-4 text-violet-300" />
            <div className="text-sm text-foreground font-medium">Modo IA</div>
            <AccessBadge label="Premium / Pro Max" />
          </div>
          <p className="text-xs text-muted-foreground">Diseñado para describir reglas en lenguaje natural y convertirlas a config estructurada.</p>
        </div>
      </div>

      {isLoading ? <PageLoader /> : autoList.length === 0 ? (
        <EmptyState icon={Zap} title="Sin automatizaciones" description="Crea reglas manuales o avanzadas para ejecutar acciones útiles cuando pasen eventos reales." />
      ) : (
        <div className="rounded-lg border border-border overflow-hidden bg-card">
          <Table>
            <TableHeader>
              <TableRow className="border-border hover:bg-transparent">
                <TableHead className="text-[11px] text-muted-foreground font-medium">Nombre</TableHead>
                <TableHead className="text-[11px] text-muted-foreground font-medium">Trigger</TableHead>
                <TableHead className="text-[11px] text-muted-foreground font-medium">Executions</TableHead>
                <TableHead className="text-[11px] text-muted-foreground font-medium">Enabled</TableHead>
                <TableHead className="text-[11px] text-muted-foreground font-medium w-10"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {autoList.map((auto: any) => (
                <TableRow key={auto.id} className="border-border hover:bg-white/[0.02]">
                  <TableCell>
                    <div className="text-sm text-foreground font-medium">{auto.name}</div>
                    <div className="text-[11px] text-muted-foreground mt-1">
                      {inferBuilderMode(auto) === "manual" ? "Manual" : "JSON avanzado"}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="text-[10px] px-1.5 py-0 border bg-blue-500/10 text-blue-400 border-blue-500/20">
                      {(auto.triggerType || auto.trigger_type || "").replace(/_/g, " ")}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="text-[10px] px-1.5 py-0 border bg-zinc-500/10 text-zinc-400 border-zinc-500/20">
                      {auto.executionCount || auto.execution_count || 0}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Switch checked={auto.enabled ?? false} onCheckedChange={() => toggleMutation.mutate(auto.id)} />
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-7 w-7">
                          <MoreHorizontal className="w-3.5 h-3.5" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => openEdit(auto)} className="text-xs gap-2">
                          <Pencil className="w-3.5 h-3.5" /> Editar
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => setDeleteTarget(auto)} className="text-xs gap-2 text-destructive focus:text-destructive">
                          <Trash2 className="w-3.5 h-3.5" /> Eliminar
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="bg-card border-border sm:max-w-[760px]">
          <DialogHeader>
            <DialogTitle className="text-sm">Nueva automatización</DialogTitle>
          </DialogHeader>

          <Tabs value={createMode} onValueChange={(value) => setCreateMode(value as BuilderMode)}>
            <TabsList className="grid grid-cols-3 w-full">
              <TabsTrigger value="manual">Manual</TabsTrigger>
              <TabsTrigger value="advanced">JSON avanzado</TabsTrigger>
              <TabsTrigger value="ai">IA</TabsTrigger>
            </TabsList>

            <TabsContent value="manual" className="mt-4">
              <ManualBuilder form={manualForm} setForm={setManualForm} members={members} />
            </TabsContent>

            <TabsContent value="advanced" className="mt-4">
              <AdvancedBuilder form={advancedForm} setForm={setAdvancedForm} locked={!hasAdvancedBuilder} />
            </TabsContent>

            <TabsContent value="ai" className="mt-4">
              <AiBuilder form={aiForm} setForm={setAiForm} allowed={hasAiBuilder} />
            </TabsContent>
          </Tabs>

          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setShowCreate(false)} className="h-8 text-xs">Cancelar</Button>
            <Button
              size="sm"
              className="h-8 text-xs"
              onClick={() => createMutation.mutate()}
              disabled={
                createMutation.isPending ||
                (createMode === "manual" && !manualForm.name.trim()) ||
                (createMode === "advanced" && (!hasAdvancedBuilder || !advancedForm.name.trim())) ||
                createMode === "ai"
              }
            >
              {createMutation.isPending && <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />}
              Crear
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!editTarget} onOpenChange={(open) => !open && setEditTarget(null)}>
        <DialogContent className="bg-card border-border sm:max-w-[760px]">
          <DialogHeader>
            <DialogTitle className="text-sm">Editar automatización</DialogTitle>
          </DialogHeader>

          <Tabs value={editMode} onValueChange={(value) => setEditMode(value as BuilderMode)}>
            <TabsList className="grid grid-cols-3 w-full">
              <TabsTrigger value="manual">Manual</TabsTrigger>
              <TabsTrigger value="advanced">JSON avanzado</TabsTrigger>
              <TabsTrigger value="ai">IA</TabsTrigger>
            </TabsList>

            <TabsContent value="manual" className="mt-4">
              <ManualBuilder form={editManualForm} setForm={setEditManualForm} members={members} />
            </TabsContent>

            <TabsContent value="advanced" className="mt-4">
              <AdvancedBuilder form={editAdvancedForm} setForm={setEditAdvancedForm} locked={!hasAdvancedBuilder} />
            </TabsContent>

            <TabsContent value="ai" className="mt-4">
              <AiBuilder form={editAiForm} setForm={setEditAiForm} allowed={hasAiBuilder} />
            </TabsContent>
          </Tabs>

          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setEditTarget(null)} className="h-8 text-xs">Cancelar</Button>
            <Button
              size="sm"
              className="h-8 text-xs"
              onClick={() => updateMutation.mutate({ id: editTarget.id, mode: editMode })}
              disabled={
                updateMutation.isPending ||
                (editMode === "manual" && !editManualForm.name.trim()) ||
                (editMode === "advanced" && (!hasAdvancedBuilder || !editAdvancedForm.name.trim())) ||
                editMode === "ai"
              }
            >
              {updateMutation.isPending && <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />}
              Guardar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent className="bg-card border-border">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-sm">¿Eliminar automatización?</AlertDialogTitle>
            <AlertDialogDescription className="text-xs text-muted-foreground">
              Se eliminará <span className="text-foreground font-medium">{deleteTarget?.name}</span> junto con su historial de ejecuciones.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="h-8 text-xs">Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => deleteMutation.mutate(deleteTarget.id)} className="h-8 text-xs bg-destructive hover:bg-destructive/90">
              {deleteMutation.isPending && <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />}
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
