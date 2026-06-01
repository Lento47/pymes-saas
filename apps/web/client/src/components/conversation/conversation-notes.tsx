import { useState, useEffect } from 'react';
import { api } from '@/lib/api';
import { apiErrorDescription } from '@/lib/api-error';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Save, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Props {
  conversationId: string;
  initialNotes?: string | null;
  onSaved?: (notes: string) => void;
}

export function ConversationNotes({ conversationId, initialNotes, onSaved }: Props) {
  const [notes, setNotes] = useState(initialNotes || '');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    setNotes(initialNotes || '');
    setSaved(false);
  }, [initialNotes, conversationId]);

  const handleSave = async () => {
    setSaving(true);
    try {
      await api.updateConversation(conversationId, { notes });
      setSaved(true);
      onSaved?.(notes);
      toast({ title: 'Notas guardadas' });
      setTimeout(() => setSaved(false), 2000);
    } catch (err: unknown) {
      toast({ title: 'Error', description: apiErrorDescription(err), variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="bg-card border border-border rounded-xl p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Notas internas</h3>
        <Button
          variant="ghost"
          size="sm"
          className="h-5 px-1.5 text-[10px] gap-1"
          disabled={saving}
          onClick={handleSave}
        >
          {saving ? (
            <Loader2 className="w-3 h-3 animate-spin" />
          ) : saved ? (
            <span className="text-success">✓ Guardado</span>
          ) : (
            <>
              <Save className="w-3 h-3" />
              Guardar
            </>
          )}
        </Button>
      </div>
      <Textarea
        value={notes}
        onChange={e => setNotes(e.target.value)}
        placeholder="Notas internas del equipo..."
        className={cn(
          "min-h-[80px] text-xs resize-none bg-[hsl(var(--elevated))] border-border",
          "focus:ring-1 focus:ring-primary/30"
        )}
        rows={3}
      />
    </div>
  );
}
