import { ArrowLeft, UserPlus, CheckCircle2, MoreVertical, RefreshCw, Receipt, Trash2, Sparkles, Bot, Loader2, PauseCircle, ChevronDown, CheckSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { ChannelBadge } from "@/components/shared/channel-badge";
import { SensitiveText } from "@/components/shared/sensitive-text";

const STATUS_TRANSITIONS: Array<{ value: string; label: string }> = [
  { value: "OPEN",           label: "Abierto" },
  { value: "IN_PROGRESS",    label: "En progreso" },
  { value: "WAITING_CLIENT", label: "Esp. cliente" },
  { value: "REQUIRES_HUMAN", label: "Req. humano" },
  { value: "SPAM",           label: "Spam" },
];

interface ConversationHeaderProps {
  contactName: string;
  contactAvatarInitials: string;
  contactAvatarUrl?: string | null;
  channelType?: string;
  statusLabel?: string;
  assigneeName?: string | null;
  statusDotClass?: string;
  onBack?: () => void;
  onAssign?: (userId: string) => void;
  onResolve?: () => void;
  onRefresh?: () => void;
  onInvoice?: () => void;
  onDelete?: () => void;
  onAddContact?: () => void;
  onCreateTask?: () => void;
  members?: Array<{ user?: { id: string; name?: string }; id: string; name?: string; email?: string }>;
  canResolve?: boolean;
  canSendInvoice?: boolean;
  canAddContact?: boolean;
  onDelegateToAi?: () => void;
  isDelegatingToAi?: boolean;
  onStartAgent?: () => void;
  isStartingAgent?: boolean;
  onPauseAi?: () => void;
  isPausingAi?: boolean;
  currentStatus?: string;
  onStatusChange?: (status: string) => void;
  className?: string;
}

export function ConversationHeader({
  contactName,
  contactAvatarInitials,
  contactAvatarUrl,
  channelType,
  statusLabel,
  assigneeName,
  statusDotClass = "w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse",
  onBack,
  onAssign,
  onResolve,
  onRefresh,
  onInvoice,
  onDelete,
  onAddContact,
  members,
  canResolve,
  canSendInvoice,
  canAddContact,
  onDelegateToAi,
  isDelegatingToAi,
  onStartAgent,
  isStartingAgent,
  onPauseAi,
  isPausingAi,
  currentStatus,
  onStatusChange,
  onCreateTask,
  className,
}: ConversationHeaderProps) {
  return (
    <div className={`flex items-center gap-2.5 border-b border-border bg-background px-3 py-2.5 sm:px-4 shrink-0 ${className ?? ""}`}>
      {onBack && (
        <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={onBack} aria-label="Volver">
          <ArrowLeft className="w-4 h-4" />
        </Button>
      )}

      <div className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full bg-muted ring-1 ring-border/50" aria-hidden="true">
        {contactAvatarUrl ? (
          <img src={contactAvatarUrl} alt="" className="w-full h-full object-cover" />
        ) : (
          <span className="text-[11px] font-semibold text-muted-foreground">{contactAvatarInitials}</span>
        )}
      </div>

      <div className="flex-1 min-w-0">
        <div className="truncate text-[13px] font-semibold leading-tight text-foreground">
          <SensitiveText text={contactName} />
        </div>
        <div className="flex items-center gap-1 mt-px flex-wrap">
          {channelType && <ChannelBadge channel={channelType} />}
          {statusLabel && (
            <>
              <span className={statusDotClass} />
              <span className="text-[10px] text-muted-foreground">{statusLabel}</span>
            </>
          )}
          <span className="text-muted-foreground/40">·</span>
          <span className="text-[10px] text-muted-foreground">
            <SensitiveText text={assigneeName ?? "Sin asignar"} />
          </span>
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-1 border-l border-border/50 pl-1.5 ml-0.5">
        {members && onAssign && (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Select onValueChange={onAssign}>
                  <SelectTrigger className="h-9 w-9 border-0 bg-transparent p-0 hover:bg-accent sm:w-auto sm:gap-1.5 sm:px-2.5" aria-label="Asignar conversación">
                    <UserPlus className="h-4 w-4 text-muted-foreground" />
                    <span className="hidden text-xs font-medium text-muted-foreground sm:inline">Asignar</span>
                  </SelectTrigger>
                  <SelectContent>
                    {members.map((m) => {
                      const name = m.user?.name ?? m.name ?? m.email ?? "Sin nombre";
                      return <SelectItem key={m.id} value={m.user?.id ?? m.id}><SensitiveText text={name} /></SelectItem>;
                    })}
                  </SelectContent>
                </Select>
              </TooltipTrigger>
              <TooltipContent side="bottom"><p className="text-xs">Asignar</p></TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}

        {onStartAgent && (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="sm" className="h-9 w-9 rounded-md p-0 text-violet-500 hover:text-violet-600 sm:w-auto sm:gap-1.5 sm:px-2.5" onClick={onStartAgent} disabled={isStartingAgent} aria-label="Iniciar Agente IA">
                  {isStartingAgent ? <Loader2 className="h-4 w-4 animate-spin" /> : <Bot className="h-4 w-4" />}
                  <span className="hidden text-xs font-medium sm:inline">Agente IA</span>
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom"><p className="text-xs">Iniciar Agente IA en esta conversación</p></TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}

        {onDelegateToAi && (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="sm" className="h-9 w-9 rounded-md p-0 text-primary hover:text-primary sm:w-auto sm:gap-1.5 sm:px-2.5" onClick={onDelegateToAi} disabled={isDelegatingToAi} aria-label="Delegar a IA">
                  {isDelegatingToAi ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                  <span className="hidden text-xs font-medium sm:inline">Delegar a IA</span>
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom"><p className="text-xs">Devolver control a la IA</p></TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}

        {onPauseAi && (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="sm" className="h-9 w-9 rounded-md p-0 text-amber-500 hover:text-amber-500 sm:w-auto sm:gap-1.5 sm:px-2.5" onClick={onPauseAi} disabled={isPausingAi} aria-label="Pausar agente IA">
                  {isPausingAi ? <Loader2 className="h-4 w-4 animate-spin" /> : <PauseCircle className="h-4 w-4" />}
                  <span className="hidden text-xs font-medium sm:inline">Pausar IA</span>
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom"><p className="text-xs">Pausar agente IA</p></TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}

        {onStatusChange && currentStatus && currentStatus !== "RESOLVED" && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="h-9 rounded-md px-2 gap-1 text-muted-foreground hover:text-foreground" aria-label="Cambiar estado">
                <span className="hidden text-xs font-medium sm:inline">
                  {STATUS_TRANSITIONS.find(s => s.value === currentStatus)?.label ?? currentStatus}
                </span>
                <ChevronDown className="h-3.5 w-3.5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-44">
              {STATUS_TRANSITIONS.filter(s => s.value !== currentStatus).map((s) => (
                <DropdownMenuItem key={s.value} onClick={() => onStatusChange(s.value)}>
                  {s.label}
                </DropdownMenuItem>
              ))}
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => onStatusChange("RESOLVED")} className="text-emerald-600 focus:text-emerald-600">
                <CheckCircle2 className="w-3.5 h-3.5 mr-2" />
                Resolver
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}

        {onResolve && !onStatusChange && (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="sm" className="h-9 w-9 rounded-md p-0 text-emerald-500 hover:text-emerald-500 sm:w-auto sm:gap-1.5 sm:px-2.5" disabled={!canResolve} onClick={onResolve} aria-label="Marcar como resuelta">
                  <CheckCircle2 className="h-4 w-4" />
                  <span className="hidden text-xs font-medium sm:inline">Resolver</span>
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom"><p className="text-xs">Resolver</p></TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}

        <TooltipProvider>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="h-9 w-9 p-0 rounded-md" aria-label="Más opciones">
                <MoreVertical className="w-4 h-4 text-muted-foreground" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-44">
              {onAddContact && canAddContact && (
                <DropdownMenuItem onClick={onAddContact}>
                  <UserPlus className="w-3.5 h-3.5 mr-2 text-muted-foreground" />
                  Agregar contacto
                </DropdownMenuItem>
              )}
              {onCreateTask && (
                <DropdownMenuItem onClick={onCreateTask}>
                  <CheckSquare className="w-3.5 h-3.5 mr-2 text-muted-foreground" />
                  Crear tarea
                </DropdownMenuItem>
              )}
              {onRefresh && (
                <DropdownMenuItem onClick={onRefresh}>
                  <RefreshCw className="w-3.5 h-3.5 mr-2 text-muted-foreground" />
                  Actualizar
                </DropdownMenuItem>
              )}
              {onInvoice && canSendInvoice && (
                <DropdownMenuItem onClick={onInvoice}>
                  <Receipt className="w-3.5 h-3.5 mr-2 text-muted-foreground" />
                  Crear factura
                </DropdownMenuItem>
              )}
              {onDelete && (
                <DropdownMenuItem onClick={onDelete} className="text-destructive focus:text-destructive">
                  <Trash2 className="w-3.5 h-3.5 mr-2" />
                  Eliminar
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </TooltipProvider>
      </div>
    </div>
  );
}
