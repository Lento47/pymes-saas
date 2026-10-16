import {
  type OrderPayment,
  type OrderPayments,
  MAX_UPLOAD_BYTES,
} from "@pymeshub/shared";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { trpc } from "@/lib/marketplace";
import { CustomerOrderPayments } from "./order-payments";

vi.mock("@/lib/marketplace", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/marketplace")>()),
  trpc: {
    orders: {
      payments: { query: vi.fn() },
      choosePaymentMethod: { mutate: vi.fn() },
      submitPaymentProof: { mutate: vi.fn() },
      paymentProof: { query: vi.fn() },
    },
  },
}));
const payment = (changes: Partial<OrderPayment> = {}): OrderPayment => ({
  id: "opay_merchant",
  purpose: "MERCHANT_ORDER",
  amountMinor: 2500,
  currency: "CRC",
  payer: "CUSTOMER",
  payee: "MERCHANT",
  method: "SINPE_MOVIL",
  status: "AWAITING_PAYMENT",
  payeeName: "Comercio de prueba",
  sinpePhone: "+50688881111",
  version: 0,
  proofId: null,
  reference: null,
  rejectionReason: null,
  canPay: true,
  canVerify: false,
  canViewProof: false,
  unlocked: true,
  confirmedAt: null,
  sinpeAvailable: true,
  ...changes,
});
function renderPayments(payments: OrderPayment[], cash = false) {
  const data: OrderPayments = {
    orderId: "ord_fixture",
    cashAdvance: cash,
    merchantAmountMinor: 2500,
    courierChargeMinor: 850,
    customerTotalMinor: 3350,
    courierEarningsMinor: 850,
    currency: "CRC",
    legacy: false,
    payments,
  };
  vi.mocked(trpc.orders.payments.query).mockResolvedValue(data);
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <CustomerOrderPayments orderId="ord_fixture" />
    </QueryClientProvider>,
  );
}
beforeEach(() => vi.clearAllMocks());
describe("customer payment instructions", () => {
  it("cash makes the courier the product payer and the collector of products plus delivery", async () => {
    renderPayments(
      [
        payment({
          payer: "COURIER",
          method: "CASH",
          canPay: false,
          unlocked: false,
        }),
        payment({
          id: "opay_courier",
          purpose: "COURIER_COLLECTION",
          payer: "CUSTOMER",
          payee: "COURIER",
          amountMinor: 3350,
          method: "CASH",
          canPay: true,
          unlocked: false,
        }),
      ],
      true,
    );
    expect(
      await screen.findByRole("heading", { name: "Adelanto al comercio" }),
    ).toBeTruthy();
    expect(
      screen.getByRole("heading", {
        name: "Al repartidor: productos + entrega",
      }),
    ).toBeTruthy();
    expect(screen.getByText(/adelanto ya está incluido/)).toBeTruthy();
    expect(screen.queryByLabelText("Subir comprobante SINPE")).toBeNull();
  });
  it("SINPE exposes only the business upload until its payment is confirmed and a courier is assigned", async () => {
    renderPayments([
      payment(),
      payment({
        id: "opay_courier",
        purpose: "COURIER_COLLECTION",
        payee: "COURIER",
        amountMinor: 850,
        method: "CASH",
        unlocked: false,
      }),
    ]);
    expect(
      await screen.findByLabelText("Subir comprobante SINPE"),
    ).toBeTruthy();
    expect(screen.getAllByLabelText("Subir comprobante SINPE")).toHaveLength(1);
    expect(screen.getByText("+50688881111")).toBeTruthy();
    expect(screen.getByText(/Disponible cuando el comercio/)).toBeTruthy();
  });
  it("a submitted image remains awaiting verification and the private preview is bound to its proof ID", async () => {
    vi.mocked(trpc.orders.paymentProof.query).mockResolvedValue({
      mimeType: "image/png",
      base64: "aW1hZ2U=",
    });
    renderPayments([
      payment({
        status: "AWAITING_VERIFICATION",
        proofId: "payproof_current",
        canViewProof: true,
      }),
    ]);
    expect(
      await screen.findByText("Comprobante enviado · por verificar"),
    ).toBeTruthy();
    expect(screen.queryByLabelText("Subir comprobante SINPE")).toBeNull();
    fireEvent.click(
      screen.getByRole("button", { name: "Ver comprobante privado" }),
    );
    await screen.findByRole("img", { name: "Comprobante SINPE de este pago" });
    expect(trpc.orders.paymentProof.query).toHaveBeenCalledWith({
      orderId: "ord_fixture",
      purpose: "MERCHANT_ORDER",
      proofId: "payproof_current",
    });
    expect(
      screen.queryByRole("button", { name: "Confirmar abono recibido" }),
    ).toBeNull();
  });
  it("rejects oversized or non-image files before sending payment evidence", async () => {
    renderPayments([payment()]);
    const input = await screen.findByLabelText("Subir comprobante SINPE");
    const file = new File(
      [new Uint8Array(MAX_UPLOAD_BYTES + 1)],
      "receipt.png",
      { type: "image/png" },
    );
    fireEvent.change(input, { target: { files: [file] } });
    await waitFor(() =>
      expect(screen.getByRole("alert")).toHaveTextContent("Adjunta una imagen"),
    );
    expect(trpc.orders.submitPaymentProof.mutate).not.toHaveBeenCalled();
  });
});
