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
    gradient: "hsl(var(--card))",
    accentColor: "hsl(var(--muted-foreground))",
    secondaryColor: "hsl(var(--border))",
  },
  inbox: {
    gradient: "hsl(var(--card))",
    accentColor: "hsl(var(--muted-foreground))",
    secondaryColor: "hsl(var(--border))",
  },
  contacts: {
    gradient: "hsl(var(--card))",
    accentColor: "hsl(var(--muted-foreground))",
    secondaryColor: "hsl(var(--border))",
  },
  pipeline: {
    gradient: "hsl(var(--card))",
    accentColor: "hsl(var(--muted-foreground))",
    secondaryColor: "hsl(var(--border))",
  },
  invoices: {
    gradient: "hsl(var(--card))",
    accentColor: "hsl(var(--muted-foreground))",
    secondaryColor: "hsl(var(--border))",
  },
  tasks: {
    gradient: "hsl(var(--card))",
    accentColor: "hsl(var(--muted-foreground))",
    secondaryColor: "hsl(var(--border))",
  },
  documents: {
    gradient: "hsl(var(--card))",
    accentColor: "hsl(var(--muted-foreground))",
    secondaryColor: "hsl(var(--border))",
  },
  automations: {
    gradient: "hsl(var(--card))",
    accentColor: "hsl(var(--muted-foreground))",
    secondaryColor: "hsl(var(--border))",
  },
  billing: {
    gradient: "hsl(var(--card))",
    accentColor: "hsl(var(--muted-foreground))",
    secondaryColor: "hsl(var(--border))",
  },
  settings: {
    gradient: "hsl(var(--card))",
    accentColor: "hsl(var(--muted-foreground))",
    secondaryColor: "hsl(var(--border))",
  },
};
