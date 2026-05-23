import { useState, useMemo, useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { SettingsLayout } from "@/components/settings/settings-layout";
import { useToast } from "@/hooks/use-toast";
import { Bot, Coins, History, ShoppingCart, Zap, TrendingUp, CheckCircle2, Clock, Sliders, Loader2, ArrowRightLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { PayPalScriptProvider, PayPalButtons } from "@paypal/react-paypal-js";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { es } from "date-fns/locale";

// Price tiers: the more you buy, the cheaper per credit
function calcCustomPrice(credits: number): number {
  if (credits >= 5000) return credits * 0.014;
  if (credits >= 1500) return credits * 0.0166;
  if (credits >= 500)  return credits * 0.02;
  return credits * 0.03;
}

function calcPricePerCredit(credits: number): number {
  if (credits >= 5000) return 0.014;
  if (credits >= 1500) return 0.0166;
  if (credits >= 500)  return 0.02;
  return 0.03;
}

const PACK_ICONS: Record<string, string> = {
  pack_100:  "⚡",
  pack_500:  "🔥",
  pack_1500: "💎",
  pack_5000: "🚀",
};

const PACK_POPULAR = "pack_500";
const AI_TOKEN_PACK_POPULAR = "ai_tokens_500k";

function formatTokens(value: number): string {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(value % 1_000_000 === 0 ? 0 : 1)}M`;
  if (value >= 1_000) return `${Math.round(value / 1_000)}k`;
  return value.toLocaleString();
}

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

function AiTokenPackCard({
  pack,
  onBuy,
  isPending,
}: {
  pack: { id: string; tokens: number; price_usd: number; label: string };
  onBuy: (packId: string) => void;
  isPending: boolean;
}) {
  const isPopular = pack.id === AI_TOKEN_PACK_POPULAR;
  const tokensPerDollar = Math.round(pack.tokens / pack.price_usd);

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

      <div className="flex items-start justify-between gap-3">
        <div>
          <Bot className="w-6 h-6 text-primary" />
          <p className="text-sm font-semibold text-foreground mt-2">{pack.label}</p>
          <p className="text-[11px] text-muted-foreground">
            {tokensPerDollar.toLocaleString()} tokens / USD
          </p>
        </div>
        <div className="text-right">
          <p className="text-xl font-bold text-foreground">${pack.price_usd}</p>
          <p className="text-[10px] text-muted-foreground">USD</p>
        </div>
      </div>

      <ul className="space-y-1 text-[11px] text-muted-foreground">
        <li className="flex items-center gap-1.5">
          <CheckCircle2 className="w-3 h-3 text-emerald-400 shrink-0" />
          {formatTokens(pack.tokens)} tokens para respuestas IA
        </li>
        <li className="flex items-center gap-1.5">
          <CheckCircle2 className="w-3 h-3 text-emerald-400 shrink-0" />
          Consumo por tokens reales del proveedor
        </li>
        <li className="flex items-center gap-1.5">
          <CheckCircle2 className="w-3 h-3 text-emerald-400 shrink-0" />
          Saldo separado de créditos de memoria
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
        Comprar tokens IA
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

function AiTokenTransactionRow({ tx }: { tx: any }) {
  const isPositive = tx.type !== "CONSUMPTION";
  const usage = tx.total_tokens
    ? `${tx.total_tokens.toLocaleString()} token${tx.total_tokens !== 1 ? "s" : ""}${tx.estimated ? " estimados" : ""}`
    : null;

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
            <Bot className="w-3.5 h-3.5 text-zinc-400" />
          )}
        </div>
        <div>
          <p className="text-xs text-foreground">{tx.description ?? tx.type}</p>
          <p className="text-[10px] text-muted-foreground">
            {format(new Date(tx.created_at), "d MMM yyyy · HH:mm", { locale: es })}
            {usage ? ` · ${usage}` : ""}
          </p>
        </div>
      </div>
      <span
        className={cn(
          "text-sm font-semibold tabular-nums",
          isPositive ? "text-emerald-400" : "text-muted-foreground",
        )}
      >
        {isPositive ? "+" : "-"}{formatTokens(tx.amount)}
      </span>
    </div>
  );
}

function CustomPackSection({
  onBuy,
  isPending,
}: {
  onBuy: (packId: string, credits: number, price: number) => void;
  isPending: boolean;
}) {
  const [rawInput, setRawInput] = useState("");
  const credits = useMemo(() => {
    const n = parseInt(rawInput, 10);
    return isNaN(n) ? 0 : Math.max(0, n);
  }, [rawInput]);

  const price = credits > 0 ? calcCustomPrice(credits) : 0;
  const ppc   = credits > 0 ? calcPricePerCredit(credits) : 0;
  const tier  = credits >= 5000 ? "5000+" : credits >= 1500 ? "1500+" : credits >= 500 ? "500+" : "base";

  const tierLabel: Record<string, string> = {
    "5000+": "Precio máximo descuento",
    "1500+": "Descuento avanzado",
    "500+":  "Descuento estándar",
    "base":  "Precio base",
  };

  return (
    <div className="rounded-xl border border-border/60 bg-card/40 p-5">
      <h3 className="text-xs font-semibold text-foreground mb-1 flex items-center gap-2">
        <Sliders className="w-3.5 h-3.5 text-primary" />
        Cantidad personalizada
      </h3>
      <p className="text-[11px] text-muted-foreground mb-4">
        Comprá la cantidad exacta que necesitás. Mejor precio a mayor volumen.
      </p>

      <div className="flex flex-col sm:flex-row gap-4">
        <div className="flex-1 space-y-1.5">
          <Label htmlFor="custom-credits" className="text-[11px] text-muted-foreground">
            Cantidad de créditos
          </Label>
          <Input
            id="custom-credits"
            type="number"
            min={1}
            placeholder="ej. 800"
            value={rawInput}
            onChange={(e) => setRawInput(e.target.value)}
            className="h-9 text-sm bg-background/50"
          />
        </div>

        {credits > 0 && (
          <div className="flex-1 rounded-lg border border-border/40 bg-background/30 px-4 py-3 space-y-1.5">
            <div className="flex justify-between items-center">
              <span className="text-[11px] text-muted-foreground">Total</span>
              <span className="text-sm font-bold text-foreground">${price.toFixed(2)} USD</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-[11px] text-muted-foreground">Por crédito</span>
              <span className="text-[11px] text-foreground">${ppc.toFixed(4)}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-[11px] text-muted-foreground">Nivel</span>
              <span className="text-[10px] text-primary font-medium">{tierLabel[tier]}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-[11px] text-muted-foreground">Estimado</span>
              <span className="text-[11px] text-foreground">
                ~{credits.toLocaleString()} días · 1 contacto activo
              </span>
            </div>
          </div>
        )}
      </div>

      <div className="mt-4 flex flex-col sm:flex-row gap-3 items-start sm:items-center">
        <Button
          onClick={() => onBuy("custom", credits, price)}
          disabled={isPending || credits < 1}
          className="h-8 text-xs px-4"
        >
          <ShoppingCart className="w-3.5 h-3.5 mr-1.5" />
          Comprar con PayPal
          {credits > 0 && <span className="ml-1.5 opacity-70">· ${price.toFixed(2)}</span>}
        </Button>

        {/* Tier threshold hints */}
        <div className="flex flex-wrap gap-2 text-[10px] text-muted-foreground/60">
          {credits < 500 && (
            <span>
              +{(500 - credits).toLocaleString()} para ${(0.02).toFixed(3)}/créd
            </span>
          )}
          {credits >= 500 && credits < 1500 && (
            <span>
              +{(1500 - credits).toLocaleString()} para ${(0.0166).toFixed(4)}/créd
            </span>
          )}
          {credits >= 1500 && credits < 5000 && (
            <span>
              +{(5000 - credits).toLocaleString()} para ${(0.014).toFixed(3)}/créd
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

const TOKENS_PER_CREDIT = 1_000;

function TransferCreditsDialog({
  open,
  onClose,
  creditBalance,
  onSuccess,
}: {
  open: boolean;
  onClose: () => void;
  creditBalance: number;
  onSuccess: () => void;
}) {
  const { toast } = useToast();
  const [rawInput, setRawInput] = useState("");
  const [isTransferring, setIsTransferring] = useState(false);

  const credits = useMemo(() => {
    const n = parseInt(rawInput, 10);
    return isNaN(n) || n < 0 ? 0 : n;
  }, [rawInput]);

  const tokensToGet = credits * TOKENS_PER_CREDIT;
  const isValid = credits >= 1 && credits <= creditBalance;

  const handleTransfer = async () => {
    if (!isValid) return;
    setIsTransferring(true);
    try {
      const result = await api.transferCreditsToTokens(credits);
      toast({
        title: "Transferencia exitosa",
        description: `Se convirtieron ${result.credits_used} créditos en ${formatTokens(result.tokens_added)} tokens IA.`,
      });
      onSuccess();
      onClose();
      setRawInput("");
    } catch (err: any) {
      toast({
        title: "Error en la transferencia",
        description: err?.message || "No se pudo completar la transferencia.",
        variant: "destructive",
      });
    } finally {
      setIsTransferring(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v && !isTransferring) { onClose(); setRawInput(""); } }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ArrowRightLeft className="w-4 h-4 text-primary" />
            Transferir créditos a tokens IA
          </DialogTitle>
          <DialogDescription>
            Convertí tus créditos de memoria en tokens IA. Tasa: 1 crédito = 1,000 tokens.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="flex items-center justify-between rounded-lg border border-border/40 bg-background/40 px-4 py-3">
            <span className="text-xs text-muted-foreground">Créditos disponibles</span>
            <span className="text-sm font-semibold text-foreground tabular-nums">
              {creditBalance.toLocaleString()}
            </span>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="transfer-credits" className="text-[11px] text-muted-foreground">
              Créditos a transferir
            </Label>
            <Input
              id="transfer-credits"
              type="number"
              min={1}
              max={creditBalance}
              placeholder="ej. 100"
              value={rawInput}
              onChange={(e) => setRawInput(e.target.value)}
              className="h-9 text-sm bg-background/50"
              disabled={isTransferring}
            />
          </div>

          {credits > 0 && (
            <div className="rounded-lg border border-primary/20 bg-primary/[0.04] px-4 py-3 space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-[11px] text-muted-foreground">Créditos a descontar</span>
                <span className="text-sm font-semibold text-foreground tabular-nums">
                  -{credits.toLocaleString()}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-[11px] text-muted-foreground">Tokens IA a recibir</span>
                <span className="text-sm font-semibold text-emerald-400 tabular-nums">
                  +{formatTokens(tokensToGet)}
                </span>
              </div>
              {credits > creditBalance && (
                <p className="text-[11px] text-destructive">
                  No tenés suficientes créditos.
                </p>
              )}
            </div>
          )}

          <Button
            onClick={handleTransfer}
            disabled={!isValid || isTransferring}
            className="w-full"
          >
            {isTransferring ? (
              <>
                <Loader2 className="w-3.5 h-3.5 mr-2 animate-spin" />
                Transfiriendo...
              </>
            ) : (
              <>
                <ArrowRightLeft className="w-3.5 h-3.5 mr-2" />
                Transferir {credits > 0 ? `${credits.toLocaleString()} créditos` : ""}
              </>
            )}
          </Button>

          <p className="text-[10px] text-muted-foreground/60 text-center">
            Esta acción no tiene reversión. Los créditos se convertirán de inmediato.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}

const PAYPAL_CLIENT_ID = import.meta.env.VITE_PAYPAL_CLIENT_ID || "";

function PayPalCheckoutDialog({
  open,
  onClose,
  orderId,
  onSuccess,
}: {
  open: boolean;
  onClose: () => void;
  orderId: string | null;
  onSuccess: (result: { credits: number; tokens?: number; newBalance: number }) => void;
}) {
  const { toast } = useToast();
  const [capturing, setCapturing] = useState(false);

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v && !capturing) onClose(); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Completar pago con PayPal</DialogTitle>
          <DialogDescription>
            Revisá los detalles y aprobá el pago en la ventana de PayPal.
          </DialogDescription>
        </DialogHeader>
        <div className="py-4 min-h-[200px] flex items-center justify-center">
          {capturing ? (
            <div className="flex flex-col items-center gap-2 text-muted-foreground">
              <Loader2 className="w-6 h-6 animate-spin text-primary" />
              <p className="text-xs">Procesando pago...</p>
            </div>
          ) : !PAYPAL_CLIENT_ID ? (
            <p className="text-xs text-amber-400 text-center">
              PayPal no está configurado. VITE_PAYPAL_CLIENT_ID no está definido.
            </p>
          ) : orderId ? (
            <PayPalScriptProvider options={{ clientId: PAYPAL_CLIENT_ID, currency: "USD" }}>
              <PayPalButtons
                style={{ layout: "vertical", shape: "rect", label: "pay" }}
                createOrder={() => Promise.resolve(orderId)}
                onApprove={async () => {
                  setCapturing(true);
                  try {
                    const result = await api.capturePayPalOrder({ orderId });
                    onSuccess(result);
                    if (result.tokens && result.tokens > 0) {
                      toast({
                        title: "Tokens IA agregados",
                        description: `Se agregaron ${formatTokens(result.tokens)} tokens IA a tu cuenta.`,
                      });
                    } else if (result.credits > 0) {
                      toast({
                        title: "¡Créditos agregados!",
                        description: `Se agregaron ${result.credits} créditos a tu cuenta.`,
                      });
                    } else {
                      toast({
                        title: "Pago recibido",
                        description: "Tus créditos se activarán en unos segundos.",
                      });
                    }
                  } catch (err: any) {
                    toast({
                      title: "Error al procesar el pago",
                      description: err?.message || "Ocurrió un error inesperado.",
                      variant: "destructive",
                    });
                  } finally {
                    setCapturing(false);
                    onClose();
                  }
                }}
                onError={() => {
                  toast({
                    title: "Error de PayPal",
                    description: "Ocurrió un error al procesar el pago.",
                    variant: "destructive",
                  });
                  onClose();
                }}
                onCancel={() => {
                  toast({ title: "Pago cancelado", description: "No se realizó ningún cargo." });
                  onClose();
                }}
              />
            </PayPalScriptProvider>
          ) : (
            <p className="text-xs text-muted-foreground">Creando orden...</p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default function CreditsSettingsPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [buyingPack, setBuyingPack] = useState<string | null>(null);
  const [currentOrderId, setCurrentOrderId] = useState<string | null>(null);
  const [showPayPal, setShowPayPal] = useState(false);
  const [isCreatingOrder, setIsCreatingOrder] = useState(false);
  const [showTransfer, setShowTransfer] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["/api/memory/credits"],
    queryFn: () => api.getCredits(),
  });

  const { data: aiTokenData, isLoading: isLoadingAiTokens } = useQuery({
    queryKey: ["/api/ai-tokens"],
    queryFn: () => api.getAiTokens(),
  });

  const balance: number = data?.balance ?? 0;
  const history: any[] = data?.history ?? [];
  const packs: any[] = data?.packs ?? [];
  const tokenBalance = {
    balance: Number(aiTokenData?.balance ?? 0),
    reserved: Number(aiTokenData?.reserved ?? 0),
    available: Number(aiTokenData?.available ?? 0),
  };
  const tokenHistory: any[] = aiTokenData?.history ?? [];
  const tokenPacks: any[] = aiTokenData?.packs ?? [];

  const handleBuy = useCallback(async (packId: string, credits?: number, price?: number) => {
    setBuyingPack(packId);
    setIsCreatingOrder(true);
    try {
      const { orderId } = await api.createPayPalOrder({ packId, credits, price });
      setCurrentOrderId(orderId);
      setShowPayPal(true);
    } catch (err: any) {
      toast({
        title: "Error al crear la orden",
        description: err?.message || "No se pudo iniciar el pago con PayPal.",
        variant: "destructive",
      });
    } finally {
      setIsCreatingOrder(false);
      setBuyingPack(null);
    }
  }, [toast]);

  const handleBuyTokens = useCallback(async (packId: string) => {
    setBuyingPack(packId);
    setIsCreatingOrder(true);
    try {
      const { orderId } = await api.createPayPalOrder({ packId, purchase_type: "AI_TOKENS" });
      setCurrentOrderId(orderId);
      setShowPayPal(true);
    } catch (err: any) {
      toast({
        title: "Error al crear la orden",
        description: err?.message || "No se pudo iniciar el pago con PayPal.",
        variant: "destructive",
      });
    } finally {
      setIsCreatingOrder(false);
      setBuyingPack(null);
    }
  }, [toast]);

  const handlePayPalSuccess = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ["/api/memory/credits"] });
    queryClient.invalidateQueries({ queryKey: ["/api/ai-tokens"] });
  }, [queryClient]);

  const closePayPal = useCallback(() => {
    setShowPayPal(false);
    setCurrentOrderId(null);
  }, []);

  const daysEstimate = balance > 0
    ? `~${balance} día${balance !== 1 ? "s" : ""} para 1 contacto activo`
    : null;

  return (
    <SettingsLayout>
      <div className="space-y-8 max-w-3xl">

        {/* AI token balance */}
        <div className="rounded-xl border border-primary/20 bg-primary/[0.04] p-6 flex items-center justify-between gap-6">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-primary/15 flex items-center justify-center shrink-0">
              <Bot className="w-6 h-6 text-primary" />
            </div>
            <div>
              <p className="text-[11px] text-muted-foreground uppercase tracking-wider mb-0.5">
                Tokens IA
              </p>
              <p className="text-3xl font-bold text-foreground tabular-nums">
                {isLoadingAiTokens ? "—" : formatTokens(tokenBalance.available)}
              </p>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                Disponible para Agente IA
                {tokenBalance.reserved > 0 ? ` · ${formatTokens(tokenBalance.reserved)} reservados` : ""}
              </p>
              {tokenBalance.available === 0 && !isLoadingAiTokens && (
                <p className="text-[11px] text-amber-400 mt-0.5">
                  Sin tokens IA — el agente no responderá hasta recargar saldo
                </p>
              )}
            </div>
          </div>
          <div className="flex flex-col items-end gap-3 shrink-0">
            <div className="text-right hidden sm:block">
              <p className="text-[10px] text-muted-foreground">Cobro por uso real</p>
              <p className="text-xs text-foreground font-medium">Prompt + respuesta</p>
              <p className="text-[10px] text-muted-foreground mt-1">Separado de memoria</p>
            </div>
            {balance > 0 && (
              <Button
                variant="outline"
                size="sm"
                className="h-8 text-xs gap-1.5"
                onClick={() => setShowTransfer(true)}
              >
                <ArrowRightLeft className="w-3.5 h-3.5" />
                Transferir créditos
              </Button>
            )}
          </div>
        </div>

        {/* AI token packs */}
        <div>
          <h2 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
            <Bot className="w-4 h-4 text-primary" />
            Comprar tokens IA
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {tokenPacks.map((pack) => (
              <AiTokenPackCard
                key={pack.id}
                pack={pack}
                onBuy={handleBuyTokens}
                isPending={buyingPack === pack.id || isCreatingOrder}
              />
            ))}
          </div>
          <p className="text-[11px] text-muted-foreground mt-3">
            Los tokens IA se consumen solo cuando el modelo genera una respuesta. Si el proveedor no reporta uso,
            PymesHub registra una estimación marcada como estimada.
          </p>
        </div>

        {/* AI token history */}
        <div>
          <h2 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
            <History className="w-4 h-4 text-primary" />
            Historial de tokens IA
          </h2>
          {isLoadingAiTokens ? (
            <div className="rounded-xl border border-border/60 bg-card/40 p-8 text-center">
              <p className="text-xs text-muted-foreground">Cargando...</p>
            </div>
          ) : tokenHistory.length === 0 ? (
            <div className="rounded-xl border border-border/60 bg-card/40 p-8 text-center">
              <Bot className="w-8 h-8 text-muted-foreground/30 mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">Sin consumo de tokens aún</p>
              <p className="text-[11px] text-muted-foreground/60 mt-1">
                Aquí aparecerán las compras y respuestas generadas por el Agente IA.
              </p>
            </div>
          ) : (
            <div className="rounded-xl border border-border/60 bg-card/40 px-4 py-1">
              {tokenHistory.map((tx) => (
                <AiTokenTransactionRow key={tx.id} tx={tx} />
              ))}
            </div>
          )}
        </div>

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
                isPending={buyingPack === pack.id || isCreatingOrder}
              />
            ))}
          </div>
          <p className="text-[11px] text-muted-foreground mt-3">
            Los créditos se comparten entre todos los contactos del workspace. No tienen fecha de vencimiento.
            Pagos procesados con PayPal.
          </p>
        </div>

        {/* Custom pack */}
        <CustomPackSection
          onBuy={handleBuy}
          isPending={buyingPack === "custom" || isCreatingOrder}
        />

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

      <PayPalCheckoutDialog
        open={showPayPal}
        onClose={closePayPal}
        orderId={currentOrderId}
        onSuccess={handlePayPalSuccess}
      />

      <TransferCreditsDialog
        open={showTransfer}
        onClose={() => setShowTransfer(false)}
        creditBalance={balance}
        onSuccess={() => {
          queryClient.invalidateQueries({ queryKey: ["/api/memory/credits"] });
          queryClient.invalidateQueries({ queryKey: ["/api/ai-tokens"] });
        }}
      />
    </SettingsLayout>
  );
}
