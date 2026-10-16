import { DEFAULT_DELIVERY_PRICING_TERMS } from "@pymeshub/shared";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { adminApi } from "@/lib/admin";
import { ExpressPricingTab } from "./console-express-pricing";

vi.mock("@/lib/admin", () => ({
  adminApi: {
    pricingPolicy: vi.fn(),
    simulatePricingPolicy: vi.fn(),
    savePricingPolicyDraft: vi.fn(),
    updatePricingPolicy: vi.fn(),
  },
}));

const terms = DEFAULT_DELIVERY_PRICING_TERMS;
const draft = {
  id: "dpp_test",
  version: "express-next",
  previousVersion: "express-v1",
  marketCode: "CR" as const,
  revision: 0,
  status: "DRAFT" as const,
  terms,
  createdByAdminId: "admin",
  approvedReason: "Revisión de precios del piloto",
  createdAt: new Date(),
  activeFrom: new Date(),
};
function setup(canManage = true) {
  vi.mocked(adminApi.pricingPolicy).mockResolvedValue({
    active: { version: "express-v1", terms },
    headVersion: "express-v1",
    canManage,
    rows: [],
  });
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <ExpressPricingTab />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  vi.resetAllMocks();
});
describe("Express pricing editor", () => {
  it("shows current rates without editing controls to a general admin", async () => {
    setup(false);
    expect(await screen.findByText(/Solo Super Admin/)).toBeTruthy();
    expect(
      screen.queryByRole("button", { name: "Guardar borrador" }),
    ).toBeNull();
    expect(screen.queryByLabelText("Base (₡)")).toBeNull();
  });
  it("requires a saved draft and simulation before an explicit publish confirmation", async () => {
    vi.mocked(adminApi.savePricingPolicyDraft).mockResolvedValue(draft);
    vi.mocked(adminApi.simulatePricingPolicy).mockResolvedValue({
      policyVersion: "simulation",
      baseCRC: 850,
      perKmCRC: 230,
      perEstimatedMinuteCRC: 45,
      distanceCRC: 920,
      estimatedDrivingCRC: 540,
      roundingCRC: 0,
      roadFeeCRC: 2310,
      nearbyDiscountCRC: 0,
      readyDiscountCRC: 0,
      topUpCRC: 0,
      customerFeeCRC: 2310,
      courierPayoutCRC: 2310,
      fundingSource: "CUSTOMER",
      fundedCRC: 0,
      exceedsCap: false,
    });
    setup();
    const review = await screen.findByRole("button", {
      name: "Revisar y publicar",
    });
    expect((review as HTMLButtonElement).disabled).toBe(true);
    fireEvent.change(screen.getByLabelText("Motivo del cambio"), {
      target: { value: draft.approvedReason },
    });
    fireEvent.click(screen.getByRole("button", { name: "Guardar borrador" }));
    expect(await screen.findByText(/Borrador guardado/)).toBeTruthy();
    expect((review as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: "Simular" }));
    await waitFor(() =>
      expect((review as HTMLButtonElement).disabled).toBe(false),
    );
    fireEvent.click(review);
    expect(await screen.findByRole("alertdialog")).toBeTruthy();
    expect(adminApi.updatePricingPolicy).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Volver" }));
    await waitFor(() => expect(screen.queryByRole("alertdialog")).toBeNull());
    fireEvent.change(screen.getByLabelText("Base (₡)"), {
      target: { value: "900" },
    });
    expect((review as HTMLButtonElement).disabled).toBe(true);
  });
  it("keeps a failed save visible and does not publish it", async () => {
    vi.mocked(adminApi.savePricingPolicyDraft).mockRejectedValue(
      new Error("Las tarifas cambiaron. Actualiza antes de guardar."),
    );
    setup();
    fireEvent.change(await screen.findByLabelText("Motivo del cambio"), {
      target: { value: draft.approvedReason },
    });
    fireEvent.click(screen.getByRole("button", { name: "Guardar borrador" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Las tarifas cambiaron",
    );
    expect(
      (
        screen.getByRole("button", {
          name: "Revisar y publicar",
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(true);
  });
});
