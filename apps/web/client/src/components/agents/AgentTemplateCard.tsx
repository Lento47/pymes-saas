import { Bot, Download } from "lucide-react";
import { Button } from "@/components/ui/button";

interface AgentTemplateCardProps {
  template: Record<string, any>;
  onInstall: (id: string) => void;
  installing: boolean;
}

export function AgentTemplateCard({
  template,
  onInstall,
  installing,
}: AgentTemplateCardProps) {
  return (
    <div className="rounded-xl border bg-card/60 p-5 flex flex-col gap-3 hover:border-primary/30 transition-colors">
      <div className="flex items-center gap-2">
        <Bot className="h-5 w-5 text-primary" />
        <h3 className="text-sm font-semibold text-foreground">{template.name}</h3>
      </div>
      {template.description && (
        <p className="text-xs text-muted-foreground">{template.description}</p>
      )}
      <div className="flex items-center justify-between pt-1">
        <span className="text-[10px] text-muted-foreground font-mono uppercase">
          {template.channel_scope}
        </span>
        <Button
          size="sm"
          variant="outline"
          disabled={installing}
          onClick={() => onInstall(template.id)}
          className="h-7 gap-1 text-xs"
        >
          <Download className="h-3 w-3" />
          Instalar
        </Button>
      </div>
    </div>
  );
}
