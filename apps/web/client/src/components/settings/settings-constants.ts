import { Mail, MessageCircle, PlugZap, Plug, Radio } from "lucide-react";

export const ROLE_COLORS: Record<string, string> = {
  OWNER: "bg-yellow-500/10 text-yellow-400 border-yellow-500/30",
  ADMIN: "bg-blue-500/10 text-blue-400 border-blue-500/30",
  AGENT: "bg-green-500/10 text-green-400 border-green-500/30",
  VIEWER: "bg-gray-500/10 text-gray-400 border-gray-500/30",
};

export const CHANNEL_TYPE_COLORS: Record<string, string> = {
  EMAIL: "bg-blue-500/10 text-blue-400",
  WHATSAPP: "bg-green-500/10 text-green-400",
  FORM: "bg-purple-500/10 text-purple-400",
  API: "bg-orange-500/10 text-orange-400",
  MANUAL: "bg-gray-500/10 text-gray-400",
};

export const CHANNEL_ICONS: Record<string, any> = {
  EMAIL: Mail,
  WHATSAPP: MessageCircle,
  FORM: PlugZap,
  API: Plug,
  MANUAL: Radio,
};
