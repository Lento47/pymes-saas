import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ChevronDown, ChevronUp, Brain, TrendingUp, AlertCircle } from "lucide-react";
import { api } from "@/lib/api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

interface Props {
  conversationId: string;
}

const sentimentColors: Record<string, string> = {
  positive: "bg-success/10 text-success",
  neutral: "bg-muted text-foreground",
  negative: "bg-destructive/10 text-destructive",
};

const intentColors: Record<string, string> = {
  venta: "bg-info/10 text-info",
  soporte: "bg-warning/10 text-warning",
  consulta: "bg-primary/10 text-primary",
  reclamo: "bg-destructive/10 text-destructive",
};

export function ConversationInsightPanel({ conversationId }: Props) {
  const [open, setOpen] = useState(false);

  const { data: insight } = useQuery({
    queryKey: ["/api/learning/conversations", conversationId, "insight"],
    queryFn: () => api.getConversationInsight(conversationId),
    enabled: open,
  });

  const hasData =
    insight && (insight.intent || insight.sentiment || insight.summary);

  return (
    <div className="border rounded-lg overflow-hidden">
      <button
        className="w-full flex items-center justify-between px-4 py-3 bg-muted/40 hover:bg-muted/60 transition-colors text-sm font-medium"
        onClick={() => setOpen((v) => !v)}
      >
        <span className="flex items-center gap-2">
          <Brain className="h-4 w-4 text-primary" />
          Insight de conversación
        </span>
        {open ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
      </button>

      {open && (
        <div className="p-4 space-y-3 text-sm">
          {!hasData ? (
            <p className="text-muted-foreground text-xs">
              Sin datos todavía. El insight se genera al resolver la conversación.
            </p>
          ) : (
            <>
              <div className="flex gap-2 flex-wrap">
                {insight.intent && (
                  <Badge
                    className={intentColors[insight.intent] ?? "bg-muted text-foreground"}
                  >
                    {insight.intent}
                  </Badge>
                )}
                {insight.sentiment && (
                  <Badge
                    className={sentimentColors[insight.sentiment] ?? "bg-muted text-foreground"}
                  >
                    {insight.sentiment}
                  </Badge>
                )}
              </div>

              {insight.summary && (
                <p className="text-muted-foreground leading-relaxed">{insight.summary}</p>
              )}

              {Array.isArray(insight.suggested_actions_json) &&
                insight.suggested_actions_json.length > 0 && (
                  <div>
                    <p className="font-medium flex items-center gap-1 mb-1">
                      <TrendingUp className="h-3 w-3" />
                      Acciones sugeridas
                    </p>
                    <ul className="space-y-1">
                      {(insight.suggested_actions_json as any[]).slice(0, 3).map(
                        (action: any, i: number) => (
                          <li key={i} className="flex items-start gap-1 text-muted-foreground">
                            <span className="mt-0.5">•</span>
                            <span>{action.description ?? String(action)}</span>
                          </li>
                        ),
                      )}
                    </ul>
                  </div>
                )}

              {Array.isArray(insight.unresolved_items_json) &&
                insight.unresolved_items_json.length > 0 && (
                  <div>
                    <p className="font-medium flex items-center gap-1 mb-1 text-warning">
                      <AlertCircle className="h-3 w-3" />
                      Items sin resolver
                    </p>
                    <ul className="space-y-1">
                      {(insight.unresolved_items_json as string[]).map((item, i) => (
                        <li key={i} className="text-muted-foreground">• {item}</li>
                      ))}
                    </ul>
                  </div>
                )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
