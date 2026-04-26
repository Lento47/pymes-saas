import { LayoutList, MessageCircle, Mail, FileText, UserX } from "lucide-react";
import type { ChannelTab } from "./types";

export const CHANNEL_TABS: { id: ChannelTab; label: string; icon: React.ReactNode }[] = [
  { id: "ALL",        label: "Todos",        icon: <LayoutList     style={{ width: 12, height: 12 }} /> },
  { id: "WHATSAPP",  label: "WhatsApp",      icon: <MessageCircle style={{ width: 12, height: 12 }} /> },
  { id: "EMAIL",     label: "Email",         icon: <Mail          style={{ width: 12, height: 12 }} /> },
  { id: "FORM",      label: "Formularios",   icon: <FileText      style={{ width: 12, height: 12 }} /> },
  { id: "UNASSIGNED",label: "Sin asignar",   icon: <UserX         style={{ width: 12, height: 12 }} /> },
];
