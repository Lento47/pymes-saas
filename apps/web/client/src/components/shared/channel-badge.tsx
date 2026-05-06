const CHANNEL_STYLES: Record<string, string> = {
  WHATSAPP: "bg-[#25D366]/15 text-[#25D366]",
  EMAIL: "bg-[#60A5FA]/15 text-[#60A5FA]",
  FORM: "bg-[#A78BFA]/15 text-[#A78BFA]",
};

export function ChannelBadge({ channel }: { channel?: string | null }) {
  if (!channel) return null;
  const style = CHANNEL_STYLES[channel] || "bg-muted text-muted-foreground";
  return (
    <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${style}`}>
      {channel}
    </span>
  );
}
