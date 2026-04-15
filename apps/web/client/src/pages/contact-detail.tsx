import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useRequireAuth } from "@/hooks/use-auth";
import { StatusBadge } from "@/components/shared/status-badge";
import { PageLoader } from "@/components/shared/loading-spinner";
import { EmptyState } from "@/components/shared/empty-state";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { useRoute, Link } from "wouter";
import { ArrowLeft, MessageSquare, CheckSquare, FileText } from "lucide-react";
import { format } from "date-fns";

const typeBadgeColors: Record<string, string> = {
  CUSTOMER: "bg-blue-500/15 text-blue-400 border-blue-500/20",
  VENDOR: "bg-purple-500/15 text-purple-400 border-purple-500/20",
  LEAD: "bg-amber-500/15 text-amber-400 border-amber-500/20",
  OTHER: "bg-zinc-500/15 text-zinc-400 border-zinc-500/20",
};

export default function ContactDetailPage() {
  useRequireAuth();
  const [, params] = useRoute("/contacts/:id");
  const id = params?.id || "";

  const { data: contact, isLoading } = useQuery({
    queryKey: ["/api/contacts", id],
    queryFn: () => api.getContact(id),
    enabled: !!id,
  });

  if (isLoading) return <PageLoader />;
  if (!contact) return <div className="text-center text-muted-foreground py-12">Contact not found</div>;

  const conversations = contact.conversations || [];
  const tasks = contact.tasks || [];
  const documents = contact.documents || [];

  return (
    <div>
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <Link href="/contacts">
          <Button variant="ghost" size="sm" className="h-8 w-8 p-0" data-testid="button-back">
            <ArrowLeft className="w-4 h-4" />
          </Button>
        </Link>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <h1 className="text-lg font-semibold text-foreground" data-testid="text-contact-name">
              {contact.name || `${contact.firstName || ""} ${contact.lastName || ""}`.trim() || "Unknown"}
            </h1>
            <Badge variant="outline" className={`text-[10px] px-1.5 py-0 border ${typeBadgeColors[contact.type] || typeBadgeColors.OTHER}`}>
              {contact.type}
            </Badge>
          </div>
          {contact.company && <p className="text-xs text-muted-foreground">{contact.company}</p>}
        </div>
        <div className="flex gap-4 text-xs text-muted-foreground">
          {contact.email && <span>{contact.email}</span>}
          {contact.phone && <span>{contact.phone}</span>}
        </div>
      </div>

      <Tabs defaultValue="conversations" className="space-y-4">
        <TabsList className="bg-muted/50 h-8">
          <TabsTrigger value="conversations" className="text-xs h-7 data-[state=active]:bg-card" data-testid="tab-conversations">
            Conversations ({conversations.length})
          </TabsTrigger>
          <TabsTrigger value="tasks" className="text-xs h-7 data-[state=active]:bg-card" data-testid="tab-tasks">
            Tasks ({tasks.length})
          </TabsTrigger>
          <TabsTrigger value="documents" className="text-xs h-7 data-[state=active]:bg-card" data-testid="tab-documents">
            Documents ({documents.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="conversations">
          {conversations.length === 0 ? (
            <EmptyState icon={MessageSquare} title="No conversations" description="No conversations with this contact yet." />
          ) : (
            <Card className="bg-card border-border divide-y divide-border">
              {conversations.map((conv: any) => (
                <Link key={conv.id} href={`/inbox/${conv.id}`}>
                  <div className="px-4 py-3 hover:bg-white/[0.02] cursor-pointer transition-colors" data-testid={`contact-conversation-${conv.id}`}>
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="text-sm text-foreground truncate flex-1">{conv.subject || "No subject"}</span>
                      <StatusBadge status={conv.status} type="conversation" />
                    </div>
                    <div className="text-[11px] text-muted-foreground">
                      {conv.updatedAt || conv.updated_at ? format(new Date(conv.updatedAt || conv.updated_at), "MMM d, yyyy") : ""}
                    </div>
                  </div>
                </Link>
              ))}
            </Card>
          )}
        </TabsContent>

        <TabsContent value="tasks">
          {tasks.length === 0 ? (
            <EmptyState icon={CheckSquare} title="No tasks" description="No tasks linked to this contact." />
          ) : (
            <Card className="bg-card border-border divide-y divide-border">
              {tasks.map((task: any) => (
                <div key={task.id} className="px-4 py-3" data-testid={`contact-task-${task.id}`}>
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-foreground flex-1 truncate">{task.title}</span>
                    <StatusBadge status={task.status} type="task" />
                  </div>
                  <div className="text-[11px] text-muted-foreground mt-0.5">
                    {task.dueDate || task.due_date ? `Due ${format(new Date(task.dueDate || task.due_date), "MMM d")}` : "No due date"}
                  </div>
                </div>
              ))}
            </Card>
          )}
        </TabsContent>

        <TabsContent value="documents">
          {documents.length === 0 ? (
            <EmptyState icon={FileText} title="No documents" description="No documents linked to this contact." />
          ) : (
            <Card className="bg-card border-border divide-y divide-border">
              {documents.map((doc: any) => (
                <div key={doc.id} className="px-4 py-3" data-testid={`contact-doc-${doc.id}`}>
                  <div className="flex items-center gap-2">
                    <FileText className="w-4 h-4 text-muted-foreground shrink-0" />
                    <span className="text-sm text-foreground flex-1 truncate">{doc.filename || doc.name}</span>
                    <StatusBadge status={doc.status} type="document" />
                  </div>
                </div>
              ))}
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
