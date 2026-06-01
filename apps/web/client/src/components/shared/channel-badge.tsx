import { MessageCircle, Send, Mail, FileText } from "lucide-react";

const CHANNEL_ICON: Record<string, React.ReactNode> = {
  WHATSAPP: <MessageCircle className="h-3 w-3" />,
  TELEGRAM: <Send className="h-3 w-3" />,
  EMAIL: <Mail className="h-3 w-3" />,
  FORM: <FileText className="h-3 w-3" />,
};

const CHANNEL_LABEL: Record<string, string> = {
  WHATSAPP: "WA",
  TELEGRAM: "TG",
  EMAIL: "Mail",
  FORM: "Form",
};

export function ChannelBadge({ channel }: { channel?: string | null }) {
  if (!channel) return null;
  const icon = CHANNEL_ICON[channel];
  const label = CHANNEL_LABEL[channel] ?? channel;
  return (
    <span className="inline-flex items-center gap-1 text-[10px] font-medium text-muted-foreground/50">
      {icon}
      <span className="hidden sm:inline">{label}</span>
    </span>
  );
}
