import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { trpc } from "@/lib/marketplace";
import { CheckoutSinpePayment } from "./checkout-sinpe-payment";

vi.mock("@/lib/marketplace", () => ({
  trpc: { orders: { uploadCheckoutProof: { mutate: vi.fn() } } },
}));
const proofId = "payproof_00000000-0000-0000-0000-000000000001";
const props = {
  businessId: "biz_checkout",
  amountMinor: 2500,
  currency: "CRC" as const,
  account: { phone: "+50688881111", recipientName: "Titular comercio" },
  scope: "current-cart-and-quote",
  ready: false,
};
function setup() {
  const onUploaded = vi.fn();
  const onBusyChange = vi.fn();
  const cache = new QueryClient({
    defaultOptions: { mutations: { retry: false } },
  });
  render(
    <QueryClientProvider client={cache}>
      <CheckoutSinpePayment
        {...props}
        onUploaded={onUploaded}
        onBusyChange={onBusyChange}
      />
    </QueryClientProvider>,
  );
  return { onUploaded, onBusyChange };
}
const photo = () =>
  new File([new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10])], "receipt.png", {
    type: "image/png",
  });
beforeEach(() => vi.resetAllMocks());
describe("SINPE upload before ordering", () => {
  it("only marks the receipt ready after its upload finishes", async () => {
    let resolveUpload!: (value: { proofId: string }) => void;
    vi.mocked(trpc.orders.uploadCheckoutProof.mutate).mockReturnValue(
      new Promise((resolve) => {
        resolveUpload = resolve;
      }),
    );
    const { onUploaded, onBusyChange } = setup();
    fireEvent.change(screen.getByLabelText("Subir comprobante SINPE"), {
      target: { files: [photo()] },
    });
    await waitFor(() =>
      expect(trpc.orders.uploadCheckoutProof.mutate).toHaveBeenCalledWith(
        expect.objectContaining({
          businessId: props.businessId,
          amountMinor: 2500,
          account: props.account,
        }),
      ),
    );
    expect(onUploaded).toHaveBeenCalledWith("", props.scope);
    expect(onUploaded).not.toHaveBeenCalledWith(proofId, props.scope);
    expect(screen.getByLabelText("Subir comprobante SINPE")).toBeDisabled();
    expect(onBusyChange).toHaveBeenLastCalledWith(true);
    resolveUpload({ proofId });
    await waitFor(() =>
      expect(onUploaded).toHaveBeenCalledWith(proofId, props.scope),
    );
    await waitFor(() =>
      expect(
        screen.getByLabelText("Subir comprobante SINPE"),
      ).not.toBeDisabled(),
    );
  });
  it("leaves checkout without a usable receipt after a failed upload", async () => {
    vi.mocked(trpc.orders.uploadCheckoutProof.mutate).mockRejectedValue(
      new Error("Upload failed"),
    );
    const { onUploaded } = setup();
    fireEvent.change(screen.getByLabelText("Subir comprobante SINPE"), {
      target: { files: [photo()] },
    });
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "No pudimos subir el comprobante",
    );
    expect(onUploaded).toHaveBeenCalledTimes(1);
    expect(onUploaded).toHaveBeenCalledWith("", props.scope);
  });
  it("rejects unsupported files before uploading", async () => {
    const { onUploaded } = setup();
    fireEvent.change(screen.getByLabelText("Subir comprobante SINPE"), {
      target: {
        files: [new File(["pdf"], "receipt.pdf", { type: "application/pdf" })],
      },
    });
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "JPG, PNG o WebP",
    );
    expect(trpc.orders.uploadCheckoutProof.mutate).not.toHaveBeenCalled();
    expect(onUploaded).not.toHaveBeenCalled();
  });
});
