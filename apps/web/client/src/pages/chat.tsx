import { ChatPage } from "@/components/shared/chat-bubble";
import { PageTemplate } from "@/components/layout/page-template";

export default function ChatPageView() {
  return (
    <PageTemplate title="AI Assistant" description="Get help and answers from our AI assistant">
      <div className="min-h-[60vh]">
        <ChatPage />
      </div>
    </PageTemplate>
  );
}
