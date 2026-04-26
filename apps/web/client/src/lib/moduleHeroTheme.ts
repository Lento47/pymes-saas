export type ModuleKey =
  | "dashboard"
  | "inbox"
  | "contacts"
  | "pipeline"
  | "invoices"
  | "tasks"
  | "documents"
  | "automations"
  | "billing"
  | "settings";

export interface ModuleHeroTheme {
  gradient: string;
  accentColor: string;
  secondaryColor: string;
}

export const heroThemes: Record<ModuleKey, ModuleHeroTheme> = {
  dashboard: {
    gradient: "linear-gradient(135deg, #F8FAFC 0%, #EEF2FF 60%, #E0E7FF 100%)",
    accentColor: "#5B5CF0",
    secondaryColor: "#8B5CF6",
  },
  inbox: {
    gradient: "linear-gradient(135deg, #F8FAFC 0%, #EFF6FF 60%, #DBEAFE 100%)",
    accentColor: "#3B82F6",
    secondaryColor: "#6366F1",
  },
  contacts: {
    gradient: "linear-gradient(135deg, #F8FAFC 0%, #EFF6FF 60%, #E0F2FE 100%)",
    accentColor: "#0EA5E9",
    secondaryColor: "#3B82F6",
  },
  pipeline: {
    gradient: "linear-gradient(135deg, #F8FAFC 0%, #EEF2FF 60%, #C7D2FE 100%)",
    accentColor: "#4338CA",
    secondaryColor: "#5B5CF0",
  },
  invoices: {
    gradient: "linear-gradient(135deg, #F8FAFC 0%, #ECFDF5 60%, #D1FAE5 100%)",
    accentColor: "#059669",
    secondaryColor: "#5B5CF0",
  },
  tasks: {
    gradient: "linear-gradient(135deg, #F8FAFC 0%, #F5F3FF 60%, #EDE9FE 100%)",
    accentColor: "#7C3AED",
    secondaryColor: "#5B5CF0",
  },
  documents: {
    gradient: "linear-gradient(135deg, #F8FAFC 0%, #F1F5F9 60%, #E2E8F0 100%)",
    accentColor: "#475569",
    secondaryColor: "#5B5CF0",
  },
  automations: {
    gradient: "linear-gradient(135deg, #1E1B4B 0%, #312E81 50%, #4C1D95 100%)",
    accentColor: "#A78BFA",
    secondaryColor: "#C4B5FD",
  },
  billing: {
    gradient: "linear-gradient(135deg, #F8FAFC 0%, #FFFBEB 60%, #FEF3C7 100%)",
    accentColor: "#D97706",
    secondaryColor: "#5B5CF0",
  },
  settings: {
    gradient: "linear-gradient(135deg, #F8FAFC 0%, #F1F5F9 60%, #EEF2FF 100%)",
    accentColor: "#64748B",
    secondaryColor: "#5B5CF0",
  },
};
