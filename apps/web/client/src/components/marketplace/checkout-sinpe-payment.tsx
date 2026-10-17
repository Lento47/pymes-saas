import {
  checkoutPaymentProofInput,
  checkoutPaymentProofRefSchema,
  MAX_UPLOAD_BYTES,
  PAYMENT_ERROR_KEYS,
  UPLOAD_MIME_TYPES,
  type Currency,
} from "@pymeshub/shared";
import { createTranslator, type MessageKey } from "@pymeshub/i18n";
import { useMutation } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import type { z } from "zod";
import { trpc } from "@/lib/marketplace";
import { money } from "./cards";

const { t } = createTranslator("es");

export function CheckoutSinpePayment({
  businessId,
  amountMinor,
  currency,
  account,
  scope,
  ready,
  onUploaded,
  onBusyChange,
}: {
  businessId: string;
  amountMinor: number;
  currency: Currency;
  account: { phone: string; recipientName: string };
  scope: string;
  ready: boolean;
  onUploaded: (proofId: string, scope: string) => void;
  onBusyChange: (busy: boolean) => void;
}) {
  const [reading, setReading] = useState(false);
  const [localError, setLocalError] = useState("");
  const [preview, setPreview] = useState<{
    data: string;
    scope: string;
  } | null>(null);
  const upload = useMutation({
    mutationFn: async (input: z.infer<typeof checkoutPaymentProofInput>) =>
      checkoutPaymentProofRefSchema.parse(
        await trpc.orders.uploadCheckoutProof.mutate(
          checkoutPaymentProofInput.parse(input),
        ),
      ),
  });
  const busy = reading || upload.isPending;
  useEffect(() => {
    onBusyChange(busy);
    return () => onBusyChange(false);
  }, [busy, onBusyChange]);

  async function pick(file: File | undefined) {
    if (!file || busy) return;
    upload.reset();
    setLocalError("");
    const mimeType = UPLOAD_MIME_TYPES.find((type) => type === file.type);
    if (file.size > MAX_UPLOAD_BYTES || !mimeType) {
      setLocalError("Adjunta una imagen JPG, PNG o WebP de hasta 5 MB.");
      return;
    }
    const selectedScope = scope;
    onUploaded("", selectedScope);
    setReading(true);
    try {
      const data = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = () => reject(new Error("No pudimos leer la imagen."));
        reader.readAsDataURL(file);
      });
      const result = await upload.mutateAsync({
        businessId,
        amountMinor,
        account,
        mimeType,
        base64: data.slice(data.indexOf(",") + 1),
      });
      setPreview({ data, scope: selectedScope });
      onUploaded(result.proofId, selectedScope);
    } catch (error) {
      const message = error instanceof Error ? error.message : "";
      setLocalError((PAYMENT_ERROR_KEYS as readonly string[]).includes(message)
        ? t(message as MessageKey)
        : "No pudimos subir el comprobante. Intenta de nuevo antes de confirmar el pedido.");
    } finally {
      setReading(false);
    }
  }

  return (
    <section
      aria-label="Comprobante SINPE antes del pedido"
      className="mt-4 space-y-3 border-t border-border pt-4"
    >
      <p className="text-sm text-foreground">
        Paga los productos al comercio y sube el comprobante antes de confirmar
        el pedido. La entrega se paga por separado.
      </p>
      <p className="text-sm font-semibold">{money(amountMinor, currency)}</p>
      <p className="text-sm text-foreground">
        {account.recipientName} · {account.phone}
      </p>
      <label className="block space-y-2 text-sm">
        <span>Subir comprobante SINPE</span>
        <input
          className="block w-full max-w-full text-sm"
          type="file"
          accept="image/jpeg,image/png,image/webp"
          disabled={busy}
          onChange={(event) => {
            void pick(event.target.files?.[0]);
            event.target.value = "";
          }}
        />
      </label>
      {busy ? (
        <p role="status" className="text-sm text-muted-foreground">
          Subiendo comprobante…
        </p>
      ) : null}
      {ready ? (
        <p role="status" className="text-sm text-foreground">
          Comprobante subido. Ya puedes confirmar el pedido.
        </p>
      ) : null}
      {ready && preview?.scope === scope ? (
        <img
          src={preview.data}
          alt="Comprobante SINPE seleccionado"
          className="max-h-52 w-full rounded-lg object-contain"
        />
      ) : null}
      {localError ? (
        <p role="alert" className="text-sm text-destructive">
          {localError}
        </p>
      ) : null}
    </section>
  );
}
