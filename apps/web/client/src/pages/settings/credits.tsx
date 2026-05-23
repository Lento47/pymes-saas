import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { SettingsLayout } from "@/components/settings/settings-layout";
import { useToast } from "@/hooks/use-toast";
import { Coins, History, ShoppingCart, Zap, TrendingUp, CheckCircle2, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { es } from "date-fns/locale";

const PACK_ICONS: Record<string, string> = {
  pack_100:  "⚡",
  pack_500:  "🔥",
  pack_1500: "💎",
  pack_5000: "🚀",
};

const PACK_POPULAR = "pack_500";

function CreditPackCard({
  pack,
  onBuy,
  isPending,
}: {
  pack: { id: string; credits: number; price_usd: number; label: string };
  onBuy: (packId: string) => void;
  isPending: boolean;
}) {
  const isPopular = pack.id === PACK_POPULAR;
  const pricePerCredit = (pack.price_usd / pack.credits).toFixed(3);

  return (
    <div
      className={cn(
        "relative rounded-xl border p-5 flex flex-col gap-3 transition-all",
        isPopular
          ? "border-primary/40 bg-primary/[0.06]"
          : "border-border/60 bg-card/40 hover:border-border",
      )}
    >
      {isPopular && (
        <div className="absolute -top-2.5 left-1/2 -translate-x-1/2">
          <span className="bg-primary text-primary-foreground text-[10px] font-semibold px-2.5 py-0.5 rounded-full">
            Popular
          </span>
        </div>
      )}

      <div className="flex items-start justify-between">
        <div>
          <span className="text-2xl">{PACK_ICONS[pack.id] ?? "✦"}</span>
          <p className="text-sm font-semibold text-foreground mt-1">{pack.label}</p>
          <p className="text-[11px] text-muted-foreground">${pricePerCredit} USD / día</p>
        </div>
        <div className="text-right">
          <p className="text-xl font-bold text-foreground">${pack.price_usd}</p>
          <p className="text-[10px] text-muted-foreground">USD</p>
        </div>
      </div>

      <ul className="space-y-1 text-[11px] text-muted-foreground">
        <li className="flex items-center gap-1.5">
          <CheckCircle2 className="w-3 h-3 text-emerald-400 shrink-0" />
          {pack.credits.toLocaleString()} días de memoria
        </li>
        <li className="flex items-center gap-1.5">
          <CheckCircle2 className="w-3 h-3 text-emerald-400 shrink-0" />
          1 crédito = 1 contacto activo por día
        </li>
        <li className="flex items-center gap-1.5">
          <CheckCircle2 className="w-3 h-3 text-emerald-400 shrink-0" />
          Sin vencimiento del saldo
        </li>
      </ul>

      <Button
        onClick={() => onBuy(pack.id)}
        disabled={isPending}
        className={cn(
          "w-full h-8 text-xs mt-auto",
          isPopular ? "bg-primary hover:bg-primary/90" : "bg-card border border-border hover:bg-sidebar-accent/40 text-foreground",
        )}
        variant={isPopular ? "default" : "outline"}
      >
        <ShoppingCart className="w-3.5 h-3.5 mr-1.5" />
        Comprar con PayPal
      </Button>
    </div>
  );
}

function TransactionRow({ tx }: { tx: any }) {
  const isPositive = tx.amount > 0;
  return (
    <div className="flex items-center justify-between py-2.5 border-b border-border/30 last:border-0">
      <div className="flex items-center gap-2.5">
        <div
          className={cn(
            "w-7 h-7 rounded-full flex items-center justify-center shrink-0",
            isPositive ? "bg-emerald-500/10" : "bg-zinc-500/10",
          )}
        >
          {isPositive ? (
            <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />
          ) : (
            <Zap className="w-3.5 h-3.5 text-zinc-400" />
          )}
        </div>
        <div>
          <p className="text-xs text-foreground">{tx.description ?? tx.type}</p>
          <p className="text-[10px] text-muted-foreground">
            {format(new Date(tx.created_at), "d MMM yyyy · HH:mm", { locale: es })}
          </p>
        </div>
      </div>
      <span
        className={cn(
          "text-sm font-semibold tabular-nums",
          isPositive ? "text-emerald-400" : "text-muted-foreground",
        )}
      >
        {isPositive ? "+" : ""}{tx.amount.toLocaleString()}
      </span>
    </div>
  );
}

export default function CreditsSettingsPage() {
  const { toast } = useToast();
  const [buyingPack, setBuyingPack] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["/api/memory/credits"],
    queryFn: () => api.getCredits(),
  });

  const balance: number = data?.balance ?? 0;
  const history: any[] = data?.history ?? [];
  const packs: any[] = data?.packs ?? [];

  function handleBuy(packId: string) {
    // PayPal integration coming — show toast for now
    setBuyingPack(packId);
    toast({
      title: "PayPal próximamente",
      description: "La integración con PayPal está en camino. Pronto podrás comprar créditos aquí.",
    });
    setTimeout(() => setBuyingPack(null), 2000);
  }

  const daysEstimate = balance > 0
    ? `~${balance} día${balance !== 1 ? "s" : ""} para 1 contacto activo`
    : null;

  return (
    <SettingsLayout>
      <div className="space-y-8 max-w-3xl">

        {/* Balance card */}
        <div className="rounded-xl border border-primary/20 bg-primary/[0.04] p-6 flex items-center justify-between gap-6">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-primary/15 flex items-center justify-center shrink-0">
              <Coins className="w-6 h-6 text-primary" />
            </div>
            <div>
              <p className="text-[11px] text-muted-foreground uppercase tracking-wider mb-0.5">
                Saldo de créditos
              </p>
              <p className="text-3xl font-bold text-foreground tabular-nums">
                {isLoading ? "—" : balance.toLocaleString()}
              </p>
              {daysEstimate && (
                <p className="text-[11px] text-muted-foreground mt-0.5 flex items-center gap-1">
                  <Clock className="w-3 h-3" />{daysEstimate}
                </p>
              )}
              {balance === 0 && !isLoading && (
                <p className="text-[11px] text-amber-400 mt-0.5">
                  Sin créditos — las memorias pausadas se reactivan al comprar
                </p>
              )}
            </div>
          </div>
          <div className="text-right shrink-0 hidden sm:block">
            <p className="text-[10px] text-muted-foreground">1 crédito =</p>
            <p className="text-xs text-foreground font-medium">1 contacto activo por día</p>
            <p className="text-[10px] text-muted-foreground mt-1">Sin vencimiento del saldo</p>
          </div>
        </div>

        {/* Packs */}
        <div>
          <h2 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
            <ShoppingCart className="w-4 h-4 text-primary" />
            Comprar créditos
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {packs.map((pack) => (
              <CreditPackCard
                key={pack.id}
                pack={pack}
                onBuy={handleBuy}
                isPending={buyingPack === pack.id}
              />
            ))}
          </div>
          <p className="text-[11px] text-muted-foreground mt-3">
            Los créditos se comparten entre todos los contactos del workspace. No tienen fecha de vencimiento.
            Pagos procesados con PayPal — próximamente disponible.
          </p>
        </div>

        {/* Transaction history */}
        <div>
          <h2 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
            <History className="w-4 h-4 text-primary" />
            Historial de transacciones
          </h2>
          {isLoading ? (
            <div className="rounded-xl border border-border/60 bg-card/40 p-8 text-center">
              <p className="text-xs text-muted-foreground">Cargando...</p>
            </div>
          ) : history.length === 0 ? (
            <div className="rounded-xl border border-border/60 bg-card/40 p-8 text-center">
              <Coins className="w-8 h-8 text-muted-foreground/30 mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">Sin transacciones aún</p>
              <p className="text-[11px] text-muted-foreground/60 mt-1">
                Aquí aparecerán tus compras y el consumo diario de créditos.
              </p>
            </div>
          ) : (
            <div className="rounded-xl border border-border/60 bg-card/40 px-4 py-1">
              {history.map((tx) => (
                <TransactionRow key={tx.id} tx={tx} />
              ))}
            </div>
          )}
        </div>

        {/* How it works */}
        <div className="rounded-xl border border-border/60 bg-card/40 p-5">
          <h3 className="text-xs font-semibold text-foreground mb-3">¿Cómo funcionan los créditos?</h3>
          <ul className="space-y-2 text-[11px] text-muted-foreground">
            <li className="flex items-start gap-2">
              <span className="text-primary mt-0.5">1.</span>
              <span>Cada contacto tiene <strong className="text-foreground">14 días de memoria gratuita</strong> desde que el agente IA lo atiende por primera vez.</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-primary mt-0.5">2.</span>
              <span>Al día 15, el perfil se <strong className="text-foreground">pausa</strong> (se guarda, pero el agente deja de usarlo).</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-primary mt-0.5">3.</span>
              <span>Comprá créditos para <strong className="text-foreground">extender la memoria</strong>. Cada día que un contacto tiene memoria activa consume 1 crédito.</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-primary mt-0.5">4.</span>
              <span>Si los créditos se agotan, las memorias extendidas se pausan automáticamente. Los perfiles <strong className="text-foreground">no se borran</strong>.</span>
            </li>
          </ul>
        </div>

      </div>
    </SettingsLayout>
  );
}
