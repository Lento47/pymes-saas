import {
  ArrowLeft,
  Bot,
  CheckCircle2,
  CheckSquare,
  ChevronDown,
  Loader2,
  MoreHorizontal,
  PauseCircle,
  Receipt,
  RefreshCw,
  Sparkles,
  Trash2,
  UserPlus,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ChannelBadge } from "@/components/shared/channel-badge";
import { SensitiveText } from "@/components/shared/sensitive-text";

const STATUS_TRANSITIONS: Array<{ value: string; label: string }> = [
  { value: "OPEN", label: "Abierto" },
  { value: "IN_PROGRESS", label: "En progreso" },
  { value: "WAITING_CLIENT", label: "Esp. cliente" },
  { value: "REQUIRES_HUMAN", label: "Req. humano" },
  { value: "SPAM", label: "Spam" },
];

const groupedButtonClass =
  "h-8 rounded-none border-border/70 px-2.5 text-xs first:rounded-l-md last:rounded-r-md -ml-px first:ml-0";
const groupedIconButtonClass =
  "h-8 w-8 rounded-none border-border/70 p-0 first:rounded-l-md last:rounded-r-md -ml-px first:ml-0";

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
  const hasAiAction = Boolean(onStartAgent || onDelegateToAi || onPauseAi);
  const memberList = members ?? [];
  const currentStatusLabel = STATUS_TRANSITIONS.find((s) => s.value === currentStatus)?.label ?? currentStatus;

  const handleResolve = () => {
    if (onStatusChange) {
      onStatusChange("RESOLVED");
      return;
    }
    onResolve?.();
  };

  return (
    <div className={`flex items-center gap-2.5 border-b border-border bg-background px-3 py-2.5 sm:px-4 shrink-0 ${className ?? ""}`}>
      <div className="hidden shrink-0 items-center sm:flex" role="group" aria-label="Navegación de conversación">
        {onBack && (
          <Button variant="outline" size="sm" className={groupedIconButtonClass} onClick={onBack} aria-label="Volver">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        )}
      </div>

      {onBack && (
        <Button variant="ghost" size="sm" className="h-8 w-8 shrink-0 p-0 sm:hidden" onClick={onBack} aria-label="Volver">
          <ArrowLeft className="h-4 w-4" />
        </Button>
      )}

      <div className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full bg-muted ring-1 ring-border/50" aria-hidden="true">
        {contactAvatarUrl ? (
          <img src={contactAvatarUrl} alt="" className="h-full w-full object-cover" />
        ) : (
          <span className="text-[11px] font-semibold text-muted-foreground">{contactAvatarInitials}</span>
        )}
      </div>

      <div className="min-w-0 flex-1">
        <div className="truncate text-[13px] font-semibold leading-tight text-foreground">
          <SensitiveText text={contactName} />
        </div>
        <div className="mt-px flex flex-wrap items-center gap-1">
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

      <div className="flex shrink-0 items-center gap-2">
        {hasAiAction && (
          <div className="hidden items-center lg:flex" role="group" aria-label="Acciones de IA">
            {onStartAgent && (
              <Button
                variant="outline"
                size="sm"
                className={`${groupedButtonClass} text-violet-600 hover:text-violet-700`}
                onClick={onStartAgent}
                disabled={isStartingAgent}
                aria-label="Iniciar Agente IA"
              >
                {isStartingAgent ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Bot className="mr-1.5 h-3.5 w-3.5" />}
                Agente IA
              </Button>
            )}
            {onDelegateToAi && (
              <Button
                variant="outline"
                size="sm"
                className={`${groupedButtonClass} text-primary hover:text-primary`}
                onClick={onDelegateToAi}
                disabled={isDelegatingToAi}
                aria-label="Delegar a IA"
              >
                {isDelegatingToAi ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Sparkles className="mr-1.5 h-3.5 w-3.5" />}
                Delegar IA
              </Button>
            )}
            {onPauseAi && (
              <Button
                variant="outline"
                size="sm"
                className={`${groupedButtonClass} text-amber-600 hover:text-amber-600`}
                onClick={onPauseAi}
                disabled={isPausingAi}
                aria-label="Pausar agente IA"
              >
                {isPausingAi ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <PauseCircle className="mr-1.5 h-3.5 w-3.5" />}
                Pausar IA
              </Button>
            )}
          </div>
        )}

        <div className="hidden items-center md:flex" role="group" aria-label="Acciones principales de conversación">
          {onStatusChange && currentStatus && currentStatus !== "RESOLVED" ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className={groupedButtonClass} aria-label="Cambiar estado">
                  {currentStatusLabel}
                  <ChevronDown className="ml-1.5 h-3.5 w-3.5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-44">
                <DropdownMenuGroup>
                  {STATUS_TRANSITIONS.filter((s) => s.value !== currentStatus).map((s) => (
                    <DropdownMenuItem key={s.value} onClick={() => onStatusChange(s.value)}>
                      {s.label}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuGroup>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleResolve} className="text-emerald-600 focus:text-emerald-600">
                  <CheckCircle2 className="h-4 w-4" />
                  Resolver
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : onResolve ? (
            <Button
              variant="outline"
              size="sm"
              className={`${groupedButtonClass} text-emerald-600 hover:text-emerald-700`}
              disabled={!canResolve}
              onClick={handleResolve}
              aria-label="Marcar como resuelta"
            >
              <CheckCircle2 className="mr-1.5 h-3.5 w-3.5" />
              Resolver
            </Button>
          ) : null}

          {onCreateTask && (
            <Button variant="outline" size="sm" className={groupedButtonClass} onClick={onCreateTask} aria-label="Crear tarea">
              <CheckSquare className="mr-1.5 h-3.5 w-3.5" />
              Tarea
            </Button>
          )}

          {onInvoice && canSendInvoice && (
            <Button variant="outline" size="sm" className={groupedButtonClass} onClick={onInvoice} aria-label="Crear factura">
              <Receipt className="mr-1.5 h-3.5 w-3.5" />
              Factura
            </Button>
          )}
        </div>

        <div className="flex items-center" role="group" aria-label="Más acciones de conversación">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="h-8 w-8 p-0" aria-label="Más opciones">
                <MoreHorizontal className="h-4 w-4 text-muted-foreground" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-52">
              <DropdownMenuGroup>
                {onStatusChange && currentStatus && currentStatus !== "RESOLVED" && (
                  <DropdownMenuSub>
                    <DropdownMenuSubTrigger className="md:hidden">
                      <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
                      Estado
                    </DropdownMenuSubTrigger>
                    <DropdownMenuSubContent className="w-44">
                      {STATUS_TRANSITIONS.filter((s) => s.value !== currentStatus).map((s) => (
                        <DropdownMenuItem key={s.value} onClick={() => onStatusChange(s.value)}>
                          {s.label}
                        </DropdownMenuItem>
                      ))}
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onClick={handleResolve} className="text-emerald-600 focus:text-emerald-600">
                        Resolver
                      </DropdownMenuItem>
                    </DropdownMenuSubContent>
                  </DropdownMenuSub>
                )}

                {onResolve && !onStatusChange && (
                  <DropdownMenuItem onClick={handleResolve} disabled={!canResolve} className="md:hidden">
                    <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
                    Resolver
                  </DropdownMenuItem>
                )}
                {onCreateTask && (
                  <DropdownMenuItem onClick={onCreateTask} className="md:hidden">
                    <CheckSquare className="h-4 w-4 text-muted-foreground" />
                    Crear tarea
                  </DropdownMenuItem>
                )}
                {onInvoice && canSendInvoice && (
                  <DropdownMenuItem onClick={onInvoice} className="md:hidden">
                    <Receipt className="h-4 w-4 text-muted-foreground" />
                    Crear factura
                  </DropdownMenuItem>
                )}
                {onAddContact && canAddContact && (
                  <DropdownMenuItem onClick={onAddContact}>
                    <UserPlus className="h-4 w-4 text-muted-foreground" />
                    Agregar contacto
                  </DropdownMenuItem>
                )}
                {onRefresh && (
                  <DropdownMenuItem onClick={onRefresh}>
                    <RefreshCw className="h-4 w-4 text-muted-foreground" />
                    Actualizar
                  </DropdownMenuItem>
                )}
              </DropdownMenuGroup>

              {(hasAiAction || (onAssign && memberList.length > 0)) && <DropdownMenuSeparator />}

              <DropdownMenuGroup>
                {hasAiAction && (
                  <>
                    {onStartAgent && (
                      <DropdownMenuItem onClick={onStartAgent} disabled={isStartingAgent} className="lg:hidden">
                        {isStartingAgent ? <Loader2 className="h-4 w-4 animate-spin" /> : <Bot className="h-4 w-4 text-muted-foreground" />}
                        Iniciar Agente IA
                      </DropdownMenuItem>
                    )}
                    {onDelegateToAi && (
                      <DropdownMenuItem onClick={onDelegateToAi} disabled={isDelegatingToAi} className="lg:hidden">
                        {isDelegatingToAi ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4 text-muted-foreground" />}
                        Delegar a IA
                      </DropdownMenuItem>
                    )}
                    {onPauseAi && (
                      <DropdownMenuItem onClick={onPauseAi} disabled={isPausingAi} className="lg:hidden">
                        {isPausingAi ? <Loader2 className="h-4 w-4 animate-spin" /> : <PauseCircle className="h-4 w-4 text-muted-foreground" />}
                        Pausar IA
                      </DropdownMenuItem>
                    )}
                  </>
                )}

                {onAssign && memberList.length > 0 && (
                  <DropdownMenuSub>
                    <DropdownMenuSubTrigger>
                      <UserPlus className="h-4 w-4 text-muted-foreground" />
                      Asignar a...
                    </DropdownMenuSubTrigger>
                    <DropdownMenuSubContent className="w-48">
                      {memberList.map((m) => {
                        const id = m.user?.id ?? m.id;
                        const name = m.user?.name ?? m.name ?? m.email ?? "Sin nombre";
                        return (
                          <DropdownMenuItem key={m.id} onClick={() => onAssign(id)}>
                            <SensitiveText text={name} />
                          </DropdownMenuItem>
                        );
                      })}
                    </DropdownMenuSubContent>
                  </DropdownMenuSub>
                )}
              </DropdownMenuGroup>

              {onDelete && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuGroup>
                    <DropdownMenuItem onClick={onDelete} className="text-destructive focus:text-destructive">
                      <Trash2 className="h-4 w-4" />
                      Eliminar
                    </DropdownMenuItem>
                  </DropdownMenuGroup>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </div>
  );
}
