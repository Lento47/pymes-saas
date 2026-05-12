import { Loader2, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { formatMoney } from "@/lib/utils";

export function InvoiceReminderDialog({
  open,
  onOpenChange,
  invoice,
  reminderDraft,
  setReminderDraft,
  selectedChannelId,
  onChannelChange,
  availableChannels,
  isLoadingDraft,
  sendMutation,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  invoice: any;
  reminderDraft: string;
  setReminderDraft: (draft: string) => void;
  selectedChannelId: string;
  onChannelChange: (id: string) => void;
  availableChannels: any[];
  isLoadingDraft: boolean;
  sendMutation: { isPending: boolean; mutate: () => void };
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-card border-border sm:max-w-[560px]">
        <DialogHeader>
          <DialogTitle className="text-sm">Recordatorio de pago</DialogTitle>
        </DialogHeader>
        {!invoice || (isLoadingDraft && !reminderDraft.trim()) ? (
          <div className="py-6 flex items-center justify-center text-sm text-white/40">
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            Cargando borrador...
          </div>
        ) : (
          <div className="space-y-3">
            <div className="rounded-md border border-border bg-background px-3 py-2">
              <div className="text-xs text-white/40">
                {invoice.number} · {invoice.contact?.full_name}
              </div>
              <div className="text-sm text-foreground mt-1">
                {formatMoney(invoice.balance_due, invoice.currency)} pendientes
              </div>
            </div>

            <div className="space-y-1">
              <Label className="text-xs text-white/40">Borrador</Label>
              <Textarea
                value={reminderDraft}
                onChange={(e) => setReminderDraft(e.target.value)}
                className="min-h-[160px] text-sm bg-background border-border"
                placeholder="El borrador generado aparecerá aquí"
              />
            </div>

            <div className="space-y-1">
              <Label className="text-xs text-white/40">Canal</Label>
              <Select value={selectedChannelId} onValueChange={onChannelChange}>
                <SelectTrigger className="h-8 text-xs bg-background border-border">
                  <SelectValue placeholder="Selecciona un canal" />
                </SelectTrigger>
                <SelectContent>
                  {availableChannels.map((channel: any) => (
                    <SelectItem key={channel.id} value={channel.id}>
                      {channel.name} · {channel.type}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        )}
        <DialogFooter>
          <Button variant="outline" size="sm" className="h-8 text-xs" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            size="sm"
            className="h-8 text-xs"
            onClick={() => sendMutation.mutate()}
            disabled={!invoice || !reminderDraft.trim() || !selectedChannelId || sendMutation.isPending}
          >
            {sendMutation.isPending ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : <Send className="w-3.5 h-3.5 mr-1.5" />}
            Enviar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
