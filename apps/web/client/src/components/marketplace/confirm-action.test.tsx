import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { ConfirmAction } from "./confirm-action";

function setup(onConfirm: () => Promise<unknown>) {
  render(
    <ConfirmAction
      title="¿Vaciar tu carrito?"
      description="Se quitarán todos los productos."
      confirmLabel="Vaciar carrito"
      cancelLabel="Seguir comprando"
      errorMessage="No se pudo vaciar el carrito."
      onConfirm={onConfirm}
    >
      <button type="button">Vaciar carrito</button>
    </ConfirmAction>,
  );
  return userEvent.setup();
}

describe("marketplace action confirmation", () => {
  it("requires a separate confirmation and restores focus when cancelled", async () => {
    const confirm = vi.fn().mockResolvedValue(undefined);
    const user = setup(confirm);
    const trigger = screen.getByRole("button", { name: "Vaciar carrito" });
    await user.click(trigger);
    const dialog = screen.getByRole("alertdialog");
    expect(confirm).not.toHaveBeenCalled();
    await user.click(
      within(dialog).getByRole("button", { name: "Seguir comprando" }),
    );
    await waitFor(() => expect(screen.queryByRole("alertdialog")).toBeNull());
    expect(trigger).toHaveFocus();
  });

  it("prevents duplicate requests and dismissal while pending", async () => {
    let finish!: () => void;
    const confirm = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          finish = resolve;
        }),
    );
    const user = setup(confirm);
    await user.click(screen.getByRole("button", { name: "Vaciar carrito" }));
    const dialog = screen.getByRole("alertdialog");
    await user.click(
      within(dialog).getByRole("button", { name: "Vaciar carrito" }),
    );
    expect(confirm).toHaveBeenCalledOnce();
    expect(
      within(dialog).getByRole("button", { name: "Procesando…" }),
    ).toBeDisabled();
    expect(
      within(dialog).getByRole("button", { name: "Seguir comprando" }),
    ).toBeDisabled();
    await user.keyboard("{Escape}");
    expect(screen.getByRole("alertdialog")).toBeVisible();
    await act(async () => finish());
    await waitFor(() => expect(screen.queryByRole("alertdialog")).toBeNull());
  });

  it("keeps failures open and allows a retry", async () => {
    const confirm = vi
      .fn()
      .mockRejectedValueOnce(new Error("offline"))
      .mockResolvedValueOnce(undefined);
    const user = setup(confirm);
    await user.click(screen.getByRole("button", { name: "Vaciar carrito" }));
    const dialog = screen.getByRole("alertdialog");
    await user.click(
      within(dialog).getByRole("button", { name: "Vaciar carrito" }),
    );
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "No se pudo vaciar el carrito.",
    );
    expect(screen.getByRole("alertdialog")).toBeVisible();
    await user.click(
      within(dialog).getByRole("button", { name: "Vaciar carrito" }),
    );
    await waitFor(() => expect(screen.queryByRole("alertdialog")).toBeNull());
    expect(confirm).toHaveBeenCalledTimes(2);
  });
});
