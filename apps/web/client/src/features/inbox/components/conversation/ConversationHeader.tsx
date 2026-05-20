import { ArrowLeft, UserPlus, CheckCircle2, RefreshCw, Receipt, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { ChannelBadge } from "@/components/shared/channel-badge";

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
  statusDotClass = "w-1.5 h-1.5 rounded-full bg-emerald-400",
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
        <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={onBack}>
          <ArrowLeft className="w-4 h-4" />
        </Button>
      )}

      <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center shrink-0">
        <span className="text-[11px] font-semibold text-muted-foreground">{contactAvatarInitials}</span>
      </div>

      <div className="flex-1 min-w-0">
        <div className="text-[13px] font-semibold text-foreground truncate leading-tight">{contactName}</div>
        <div className="flex items-center gap-1 mt-px flex-wrap">
          {channelType && <ChannelBadge channel={channelType} />}
          {statusLabel && (
            <>
              <span className={statusDotClass} />
              <span className="text-[10px] text-muted-foreground">{statusLabel}</span>
            </>
          )}
          <span className="text-muted-foreground/40">·</span>
          <span className="text-[10px] text-muted-foreground">{assigneeName ?? "Sin asignar"}</span>
        </div>
      </div>

      <div className="flex items-center gap-0.5 shrink-0">
        {members && onAssign && (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Select onValueChange={onAssign}>
                  <SelectTrigger className="h-7 w-7 p-0 border-0 bg-transparent hover:bg-accent">
                    <UserPlus className="w-3.5 h-3.5 text-muted-foreground" />
                  </SelectTrigger>
                  <SelectContent>
                    {members.map((m) => {
                      const name = m.user?.name ?? m.name ?? m.email ?? "Sin nombre";
                      return <SelectItem key={m.id} value={m.user?.id ?? m.id}>{name}</SelectItem>;
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
                <Button variant="ghost" size="sm" className="h-7 w-7 p-0" disabled={!canResolve} onClick={onResolve}>
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom"><p className="text-xs">Resolver</p></TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}

        {onRefresh && (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={onRefresh}>
                  <RefreshCw className="w-3.5 h-3.5 text-muted-foreground" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom"><p className="text-xs">Actualizar</p></TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}

        {onInvoice && canSendInvoice && (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={onInvoice}>
                  <Receipt className="w-3.5 h-3.5 text-muted-foreground" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom"><p className="text-xs">Factura</p></TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}

        {onDelete && (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={onDelete}>
                  <Trash2 className="w-3.5 h-3.5 text-destructive" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom"><p className="text-xs">Eliminar</p></TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}
      </div>
    </div>
  );
}
