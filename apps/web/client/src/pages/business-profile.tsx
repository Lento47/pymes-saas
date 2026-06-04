import { useState } from "react";
import { useLocation } from "wouter";
import { api } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Loader2, CheckCircle2, ChevronLeft,
  UtensilsCrossed, Briefcase, ShoppingCart, Heart, BookOpen, Laptop,
  Hammer, Truck, Hotel, Scissors, PartyPopper, Leaf, Home, Cog, Building2, HelpCircle,
  Smartphone, MessageCircle, Users, Store, Globe, Plus,
  Receipt, TrendingUp, Package, ClipboardList, Calendar, CreditCard,
  User,
} from "lucide-react";

type IconType = typeof User;

const CATEGORIES: { value: string; label: string; icon: IconType }[] = [
  { value: "alimentacion_bebidas",      label: "Alimentación y bebidas",     icon: UtensilsCrossed },
  { value: "servicios_profesionales",   label: "Servicios profesionales",    icon: Briefcase       },
  { value: "comercio_ventas",           label: "Comercio y ventas",          icon: ShoppingCart    },
  { value: "salud_bienestar",           label: "Salud y bienestar",          icon: Heart           },
  { value: "educacion_formacion",       label: "Educación y formación",      icon: BookOpen        },
  { value: "tecnologia_software",       label: "Tecnología y software",      icon: Laptop          },
  { value: "construccion_remodelacion", label: "Construcción y remodelación",icon: Hammer          },
  { value: "transporte_logistica",      label: "Transporte y logística",     icon: Truck           },
  { value: "turismo_hospitalidad",      label: "Turismo y hospitalidad",     icon: Hotel           },
  { value: "belleza_estetica",          label: "Belleza y estética",         icon: Scissors        },
  { value: "entretenimiento_eventos",   label: "Entretenimiento y eventos",  icon: PartyPopper     },
  { value: "agropecuario",              label: "Agropecuario",               icon: Leaf            },
  { value: "servicios_hogar",           label: "Servicios del hogar",        icon: Home            },
  { value: "manufactura_artesania",     label: "Manufactura y artesanía",    icon: Cog             },
  { value: "bienes_raices",             label: "Bienes raíces",              icon: Building2       },
  { value: "otro",                      label: "Otro",                       icon: HelpCircle      },
];

const TEAM_SIZES: { value: string; label: string; sub: string }[] = [
  { value: "solo",    label: "Solo yo",             sub: "1 persona"      },
  { value: "2_5",     label: "2 a 5 personas",      sub: "Pequeño equipo" },
  { value: "6_20",    label: "6 a 20 personas",     sub: "Equipo mediano" },
  { value: "20_plus", label: "Más de 20 personas",  sub: "Empresa grande" },
];

const CHANNELS: { value: string; label: string; sub: string; icon: IconType }[] = [
  { value: "redes_sociales", label: "Redes sociales", sub: "Instagram, Facebook, TikTok", icon: Smartphone    },
  { value: "whatsapp",       label: "WhatsApp",        sub: "Mensajería directa",          icon: MessageCircle },
  { value: "referidos",      label: "Referidos",       sub: "Boca a boca",                 icon: Users         },
  { value: "local",          label: "Local físico",    sub: "Tienda o negocio presencial", icon: Store         },
  { value: "web",            label: "Sitio web",       sub: "Tienda en línea",             icon: Globe         },
  { value: "otro",           label: "Otro canal",      sub: "",                            icon: Plus          },
];

const NEEDS: { value: string; label: string; sub: string; icon: IconType }[] = [
  { value: "facturacion",      label: "Facturación electrónica", sub: "Hacienda CR",                 icon: Receipt      },
  { value: "atencion_cliente", label: "Atención al cliente",     sub: "Chats y mensajes",            icon: MessageCircle},
  { value: "ventas",           label: "Seguimiento de ventas",   sub: "CRM y pipeline",              icon: TrendingUp   },
  { value: "pedidos",          label: "Pedidos y entregas",      sub: "Órdenes y logística",         icon: Package      },
  { value: "inventario",       label: "Inventario",              sub: "Stock y productos",           icon: ClipboardList},
  { value: "citas",            label: "Citas y agenda",          sub: "Reservaciones",               icon: Calendar     },
  { value: "cobros",           label: "Cobros y pagos",          sub: "Recordatorios y seguimiento", icon: CreditCard   },
];

function MultiChip({ icon: Icon, label, sub, selected, onClick }: {
  icon: IconType; label: string; sub?: string; selected: boolean; onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex w-full items-center gap-3 rounded-lg border px-3.5 py-2.5 text-left transition-colors",
        selected
          ? "border-accent bg-accent/8 hover:bg-accent/10"
          : "border-border bg-card hover:border-border-strong hover:bg-muted/40",
      )}
    >
      <div className={cn(
        "flex h-8 w-8 shrink-0 items-center justify-center rounded-md border",
        selected ? "border-accent/30 bg-accent/10" : "border-border bg-muted/40",
      )}>
        <Icon className={cn("h-4 w-4", selected ? "text-accent" : "text-muted-foreground")} strokeWidth={1.75} />
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-[13px] font-medium text-foreground">{label}</div>
        {sub && <div className="mt-0.5 text-[11px] text-muted-foreground">{sub}</div>}
      </div>
      {selected && <CheckCircle2 className="h-4 w-4 shrink-0 text-accent" />}
    </button>
  );
}

function RadioChip({ label, sub, selected, onClick }: {
  label: string; sub?: string; selected: boolean; onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex w-full items-center justify-between gap-3 rounded-lg border px-3.5 py-2.5 text-left transition-colors",
        selected
          ? "border-accent bg-accent/8 hover:bg-accent/10"
          : "border-border bg-card hover:border-border-strong hover:bg-muted/40",
      )}
    >
      <div>
        <div className="text-[13px] font-medium text-foreground">{label}</div>
        {sub && <div className="mt-0.5 text-[11px] text-muted-foreground">{sub}</div>}
      </div>
      <div className={cn(
        "flex h-4 w-4 shrink-0 items-center justify-center rounded-full border-2 transition-colors",
        selected ? "border-accent bg-accent" : "border-border bg-transparent",
      )}>
        {selected && <div className="h-1.5 w-1.5 rounded-full bg-white" />}
      </div>
    </button>
  );
}

export default function BusinessProfilePage() {
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const [step, setStep] = useState(0);
  const [categories, setCategories] = useState<string[]>([]);
  const [teamSize, setTeamSize] = useState("");
  const [channels, setChannels] = useState<string[]>([]);
  const [needs, setNeeds] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  const totalSteps = 4;

  const toggle = (arr: string[], set: (v: string[]) => void, val: string) =>
    set(arr.includes(val) ? arr.filter((v) => v !== val) : [...arr, val]);

  const canNext = [
    categories.length > 0,
    teamSize !== "",
    channels.length > 0,
    needs.length > 0,
  ];

  const finish = async () => {
    setSaving(true);
    try {
      await api.saveBusinessProfile({ categories, team_size: teamSize, channels, needs });
      navigate("/");
    } catch {
      toast({ title: "No se pudo guardar el perfil", description: "Intente nuevamente.", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const STEPS = [
    {
      title: "¿En qué sector opera su negocio?",
      sub: "Seleccione todas las que apliquen",
      content: CATEGORIES.map((c) => (
        <MultiChip key={c.value} icon={c.icon} label={c.label}
          selected={categories.includes(c.value)}
          onClick={() => toggle(categories, setCategories, c.value)} />
      )),
    },
    {
      title: "¿Cuántas personas trabajan en su negocio?",
      sub: "Seleccione una opción",
      content: TEAM_SIZES.map((t) => (
        <RadioChip key={t.value} label={t.label} sub={t.sub}
          selected={teamSize === t.value}
          onClick={() => setTeamSize(t.value)} />
      )),
    },
    {
      title: "¿Cómo llegan sus clientes principalmente?",
      sub: "Seleccione todos los que apliquen",
      content: CHANNELS.map((c) => (
        <MultiChip key={c.value} icon={c.icon} label={c.label} sub={c.sub}
          selected={channels.includes(c.value)}
          onClick={() => toggle(channels, setChannels, c.value)} />
      )),
    },
    {
      title: "¿Qué necesita gestionar con PymesHub?",
      sub: "Seleccione las herramientas que más necesita",
      content: NEEDS.map((n) => (
        <MultiChip key={n.value} icon={n.icon} label={n.label} sub={n.sub}
          selected={needs.includes(n.value)}
          onClick={() => toggle(needs, setNeeds, n.value)} />
      )),
    },
  ];

  const s = STEPS[step];

  return (
    <div className="flex min-h-screen items-start justify-center bg-canvas px-6 py-10">
      <div className="w-full max-w-[520px]">
        {/* Header */}
        <div className="mb-8 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="flex h-7 w-7 items-center justify-center rounded bg-accent text-white">
              <span className="text-[11px] font-bold">P</span>
            </div>
            <span className="text-sm font-semibold text-foreground">PymesHub</span>
          </div>
          <span className="text-xs text-muted-foreground">
            Paso {step + 1} de {totalSteps}
          </span>
        </div>

        {/* Progress bar */}
        <div className="mb-7 h-1 overflow-hidden rounded-full bg-border">
          <div
            className="h-full rounded-full bg-accent transition-all duration-300 ease-out"
            style={{ width: `${((step + 1) / totalSteps) * 100}%` }}
          />
        </div>

        <h2 className="mb-1 text-lg font-semibold tracking-tight text-foreground">{s.title}</h2>
        <p className="mb-5 text-[13px] text-muted-foreground">{s.sub}</p>

        <div className="flex flex-col gap-2">{s.content}</div>

        <div className="mt-6 flex items-center gap-2.5">
          {step > 0 && (
            <Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs" onClick={() => setStep((s) => s - 1)}>
              <ChevronLeft className="h-3.5 w-3.5" />
              Atrás
            </Button>
          )}

          {step < totalSteps - 1 ? (
            <Button size="sm" className="h-8 text-xs" disabled={!canNext[step]} onClick={() => setStep((s) => s + 1)}>
              Continuar
            </Button>
          ) : (
            <Button size="sm" className="h-8 gap-1.5 text-xs" disabled={!canNext[step] || saving} onClick={finish}>
              {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              Guardar perfil
            </Button>
          )}

          <button
            type="button"
            onClick={() => navigate("/")}
            className="ml-auto text-xs text-muted-foreground underline-offset-2 hover:text-foreground hover:underline transition-colors"
          >
            Cancelar
          </button>
        </div>
      </div>
    </div>
  );
}
