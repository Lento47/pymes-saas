import { ArrowLeft, UserPlus, CheckCircle2, MoreVertical, RefreshCw, Receipt, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { ChannelBadge } from "@/components/shared/channel-badge";
import { SensitiveText } from "@/components/shared/sensitive-text";

interface ConversationHeaderProps {
  contactName: string;
  contactAvatarInitials: string;
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
  members?: Array<{ user?: { id: string; name?: string }; id: string; name?: string; email?: string }>;
  canResolve?: boolean;
  canSendInvoice?: boolean;
  className?: string;
}

export function ConversationHeader({
  contactName,
  contactAvatarInitials,
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
  members,
  canResolve,
  canSendInvoice,
  className,
}: ConversationHeaderProps) {
  return (
    <div className={`flex items-center gap-2.5 border-b border-border px-3 sm:px-4 py-2.5 shrink-0 ${className ?? ""}`}>
      {onBack && (
        <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={onBack} aria-label="Volver">
          <ArrowLeft className="w-4 h-4" />
        </Button>
      )}

      <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center shrink-0 ring-1 ring-border/50" aria-hidden="true">
        <span className="text-[11px] font-semibold text-muted-foreground">{contactAvatarInitials}</span>
      </div>

      <div className="flex-1 min-w-0">
        <div className="text-[13px] font-medium text-foreground truncate leading-tight">
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

      <div className="flex items-center gap-1 shrink-0 border-l border-border/50 pl-1.5 ml-0.5">
        {members && onAssign && (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Select onValueChange={onAssign}>
                  <SelectTrigger className="h-9 w-9 p-0 border-0 bg-transparent hover:bg-accent rounded-md" aria-label="Asignar conversación">
                    <UserPlus className="w-4 h-4 text-muted-foreground" />
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

        {onResolve && (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="sm" className="h-9 w-9 p-0 rounded-md" disabled={!canResolve} onClick={onResolve} aria-label="Marcar como resuelta">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
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
