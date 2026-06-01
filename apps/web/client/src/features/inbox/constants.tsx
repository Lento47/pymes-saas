import { Inbox, MessageCircle, Send, Mail, FileText, UserX, User } from "lucide-react";
import type { ChannelTab } from "./types";

export const CHANNEL_TABS: { id: ChannelTab; label: string; icon: React.ReactNode }[] = [
  { id: "ALL",        label: "Todos",         icon: <Inbox        className="h-3 w-3" /> },
  { id: "WHATSAPP",   label: "WhatsApp",      icon: <MessageCircle className="h-3 w-3" /> },
  { id: "TELEGRAM",   label: "Telegram",      icon: <Send         className="h-3 w-3" /> },
  { id: "EMAIL",      label: "Email",         icon: <Mail         className="h-3 w-3" /> },
  { id: "FORM",       label: "Formularios",   icon: <FileText     className="h-3 w-3" /> },
  { id: "UNASSIGNED", label: "Sin asignar",   icon: <UserX        className="h-3 w-3" /> },
  { id: "MINE",       label: "Asignadas a mí", icon: <User        className="h-3 w-3" /> },
];
