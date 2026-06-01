import { useQuery } from "@tanstack/react-query";
import { User, TrendingUp, MessageSquare } from "lucide-react";
import { api } from "@/lib/api";
import { Badge } from "@/components/ui/badge";

interface Props {
  contactId: string;
}

function ScoreBar({ value, color }: { value: number; color: string }) {
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${value}%` }} />
      </div>
      <span className="text-xs text-muted-foreground w-7 text-right">{value}</span>
    </div>
  );
}

export function CustomerMemoryCard({ contactId }: Props) {
  const { data: memory } = useQuery({
    queryKey: ["/api/learning/customer", contactId],
    queryFn: () => api.getCustomerMemory(contactId),
  });

  if (!memory) return null;

  const profile = (memory.profile_json ?? {}) as Record<string, any>;
  const objections = memory.objections_json as string[] | null;
  const interests = memory.interests_json as string[] | null;
  const hasData =
    profile.summary ||
    memory.next_best_action ||
    memory.lead_score > 0 ||
    memory.risk_score > 0 ||
    objections?.length ||
    interests?.length;

  if (!hasData) return null;

  return (
    <div className="border rounded-lg p-4 space-y-3 text-sm">
      <p className="font-medium flex items-center gap-2">
        <User className="h-4 w-4 text-primary" />
        Memoria del cliente
      </p>

      {profile.summary && (
        <p className="text-muted-foreground text-xs leading-relaxed">{profile.summary}</p>
      )}

      {memory.next_best_action && (
        <div className="bg-info/5 border border-info/20 rounded p-2 text-xs text-info">
          <TrendingUp className="inline h-3 w-3 mr-1" />
          {memory.next_best_action}
        </div>
      )}

      {(memory.lead_score > 0 || memory.risk_score > 0) && (
        <div className="space-y-1.5">
          {memory.lead_score > 0 && (
            <div>
              <p className="text-xs text-muted-foreground mb-0.5">Lead score</p>
              <ScoreBar value={memory.lead_score} color="bg-blue-500" />
            </div>
          )}
          {memory.risk_score > 0 && (
            <div>
              <p className="text-xs text-muted-foreground mb-0.5">Riesgo de abandono</p>
              <ScoreBar value={memory.risk_score} color="bg-red-400" />
            </div>
          )}
        </div>
      )}

      {interests?.length > 0 && (
        <div>
          <p className="text-xs text-muted-foreground mb-1">Intereses</p>
          <div className="flex flex-wrap gap-1">
            {interests.map((i: string) => (
              <Badge key={i} variant="secondary" className="text-xs">
                {i}
              </Badge>
            ))}
          </div>
        </div>
      )}

      {objections?.length > 0 && (
        <div>
          <p className="text-xs text-muted-foreground mb-1 flex items-center gap-1">
            <MessageSquare className="h-3 w-3" /> Objeciones frecuentes
          </p>
          <ul className="space-y-0.5">
            {objections.map((o: string) => (
              <li key={o} className="text-xs text-muted-foreground">• {o}</li>
            ))}
          </ul>
        </div>
      )}

      {memory.channel_preference && (
        <p className="text-xs text-muted-foreground">
          Canal preferido: <span className="font-medium">{memory.channel_preference}</span>
        </p>
      )}
    </div>
  );
}
