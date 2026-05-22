import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { SecretInput } from "@/components/settings/secret-input";

export function ApiKeyCard({
  label, description, icon, iconBg, iconColor,
  isSet, keyValue, onKeyChange, placeholder,
  onSave, onClear, isPending,
}: {
  label: string; description: string;
  icon: React.ReactNode; iconBg: string; iconColor: string;
  isSet: boolean; keyValue: string; onKeyChange: (v: string) => void; placeholder: string;
  onSave: () => void; onClear: () => void; isPending: boolean;
}) {
  return (
    <div className="rounded-xl border border-border bg-[hsl(var(--elevated))] p-4 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className={`flex items-center justify-center w-8 h-8 rounded-lg ${iconBg}`}>
            {icon}
          </div>
          <div>
            <p className="text-sm font-medium">{label}</p>
            <p className="text-xs text-muted-foreground">{description}</p>
          </div>
        </div>
        <Badge variant="outline" className={isSet ? "text-green-400 border-green-500/30 bg-green-500/10" : "text-gray-400 border-gray-500/30 bg-gray-500/10"}>
          {isSet ? "Configurado" : "Sin configurar"}
        </Badge>
      </div>
      <div className="space-y-1.5">
        <Label className="text-xs text-muted-foreground uppercase tracking-wider">API Key</Label>
        <SecretInput value={keyValue} onChange={onKeyChange} placeholder={isSet ? "••••••••••••••••" : placeholder} />
      </div>
      <div className="flex items-center gap-2 justify-end">
        {isSet && (
          <Button size="sm" variant="outline" className="border-red-500/30 text-red-400 hover:bg-red-500/10" onClick={onClear} disabled={isPending}>
            {isPending ? "Eliminando..." : "Eliminar key"}
          </Button>
        )}
        <Button size="sm" onClick={onSave} disabled={!keyValue.trim() || isPending}>
          {isPending ? "Guardando..." : "Guardar"}
        </Button>
      </div>
    </div>
  );
}
