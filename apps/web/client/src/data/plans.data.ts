import { Users, Receipt, Zap, FolderOpen, Database } from "lucide-react";
import type { LucideIcon } from "lucide-react";

export const PLAN_ORDER = ["FREE", "STARTER", "GROWTH", "ENTERPRISE"] as const;

export interface PlanTier {
  key: string;
  name: string;
  description: string;
  monthlyCRC: number;
  monthlyUSD: number;
  usersLabel: string;
  highlights: string[];
  limits: { label: string; value: string; icon: LucideIcon }[];
  popular: boolean;
  priceIdMonthly: string | null;
  priceIdAnnual: string | null;
}

export const PLAN_TIERS: PlanTier[] = [
  {
    key: "FREE",
    name: "Free",
    description: "Para empezar a organizar tu operación sin costo.",
    monthlyCRC: 0,
    monthlyUSD: 0,
    usersLabel: "1 usuario",
    highlights: [
      "CRM básico",
      "Dashboard",
      "Facturación básica",
      "5 automatizaciones",
    ],
    limits: [
      { label: "Contactos", value: "500", icon: Users },
      { label: "Facturas/mes", value: "50", icon: Receipt },
      { label: "Automatizaciones", value: "5", icon: Zap },
      { label: "Documentos", value: "50", icon: FolderOpen },
      { label: "Almacenamiento", value: "100 MB", icon: Database },
    ],
    popular: false,
    priceIdMonthly: null,
    priceIdAnnual: null,
  },
  {
    key: "STARTER",
    name: "Starter",
    description: "Ideal para negocios que necesitan más capacidad y control.",
    monthlyCRC: 12900,
    monthlyUSD: 25,
    usersLabel: "hasta 10 usuarios",
    highlights: [
      "Todo lo de Free",
      "Pipeline de ventas",
      "Roles de usuario",
      "Canales (Email)",
      "25 automatizaciones",
    ],
    limits: [
      { label: "Contactos", value: "5,000", icon: Users },
      { label: "Facturas/mes", value: "200", icon: Receipt },
      { label: "Automatizaciones", value: "25", icon: Zap },
      { label: "Documentos", value: "500", icon: FolderOpen },
      { label: "Almacenamiento", value: "1 GB", icon: Database },
    ],
    popular: false,
    priceIdMonthly: null,
    priceIdAnnual: null,
  },
  {
    key: "GROWTH",
    name: "Growth",
    description: "Para equipos en crecimiento que necesitan flujos avanzados.",
    monthlyCRC: 29900,
    monthlyUSD: 59,
    usersLabel: "hasta 50 usuarios",
    highlights: [
      "Todo lo de Starter",
      "WhatsApp inbox",
      "Editor JSON de automatizaciones",
      "Prompt builder IA (3/día)",
      "Reportes avanzados",
    ],
    limits: [
      { label: "Contactos", value: "50,000", icon: Users },
      { label: "Facturas/mes", value: "1,000", icon: Receipt },
      { label: "Automatizaciones", value: "100", icon: Zap },
      { label: "Documentos", value: "5,000", icon: FolderOpen },
      { label: "Almacenamiento", value: "10 GB", icon: Database },
    ],
    popular: true,
    priceIdMonthly: null,
    priceIdAnnual: null,
  },
  {
    key: "ENTERPRISE",
    name: "Business",
    description: "Control avanzado para operaciones que no pueden frenar.",
    monthlyCRC: 59900,
    monthlyUSD: 119,
    usersLabel: "hasta 50 usuarios",
    highlights: [
      "Todo lo de Growth",
      "Prompt builder IA ilimitado",
      "API access",
      "Audit logs",
      "SLA garantizado",
    ],
    limits: [
      { label: "Contactos", value: "Ilimitado", icon: Users },
      { label: "Facturas/mes", value: "Ilimitado", icon: Receipt },
      { label: "Automatizaciones", value: "Ilimitado", icon: Zap },
      { label: "Documentos", value: "Ilimitado", icon: FolderOpen },
      { label: "Almacenamiento", value: "Ilimitado", icon: Database },
    ],
    popular: false,
    priceIdMonthly: null,
    priceIdAnnual: null,
  },
  {
    key: "ENTERPRISE",
    name: "Business+",
    description: "Para pymes con operaciones avanzadas y necesidades a medida.",
    monthlyCRC: 0,
    monthlyUSD: 0,
    usersLabel: "usuarios personalizados",
    highlights: [
      "Todo lo de Business",
      "SSO / SAML",
      "Contrato personalizado",
      "Onboarding dedicado",
      "Soporte prioritario 24/7",
    ],
    limits: [
      { label: "Contactos", value: "Personalizado", icon: Users },
      { label: "Facturas/mes", value: "Personalizado", icon: Receipt },
      { label: "Automatizaciones", value: "Personalizado", icon: Zap },
      { label: "Documentos", value: "Personalizado", icon: FolderOpen },
      { label: "Almacenamiento", value: "Personalizado", icon: Database },
    ],
    popular: false,
    priceIdMonthly: null,
    priceIdAnnual: null,
  },
];

export const PLAN_BADGE: Record<string, string> = {
  FREE: "border-zinc-500/20 bg-zinc-500/10 text-zinc-400",
  STARTER: "border-amber-500/20 bg-amber-500/10 text-amber-400",
  GROWTH: "border-violet-500/20 bg-violet-500/10 text-violet-400",
  ENTERPRISE: "border-yellow-500/20 bg-yellow-500/10 text-yellow-400",
};

export const PLAN_CARD_BORDER: Record<string, string> = {
  FREE: "border-border/60",
  STARTER: "border-amber-500/20",
  GROWTH: "border-violet-500/20",
  ENTERPRISE: "border-yellow-500/20",
};
