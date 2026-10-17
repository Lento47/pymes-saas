import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { FavoriteButton } from "./favorite-button";

const state = vi.hoisted(() => ({
  session: {
    data: { userId: "customer", email: "customer@example.test" } as {
      userId: string;
      email: string;
    } | null,
    isLoading: false,
  },
  favorites: {
    data: {
      products: [] as { id: string }[],
      businesses: [] as { id: string }[],
    },
    isLoading: false,
    isError: false,
    refetch: vi.fn(),
  },
  toggle: { isPending: false, mutate: vi.fn() },
  navigate: vi.fn(),
  toast: vi.fn(),
}));
vi.mock("@/lib/marketplace", () => ({
  useMarketplaceSession: () => state.session,
  useFavorites: () => state.favorites,
  useToggleFavorite: () => state.toggle,
}));
vi.mock("wouter", () => ({ useLocation: () => ["/", state.navigate] }));
vi.mock("@/hooks/use-toast", () => ({
  useToast: () => ({ toast: state.toast }),
}));

beforeEach(() => {
  vi.clearAllMocks();
  state.session.data = { userId: "customer", email: "customer@example.test" };
  state.session.isLoading = false;
  state.favorites.data = { products: [], businesses: [] };
  state.favorites.isLoading = false;
  state.favorites.isError = false;
  state.toggle.isPending = false;
});

describe("marketplace favorites", () => {
  it("sends anonymous visitors to sign-in without a write", () => {
    state.session.data = null;
    render(<FavoriteButton productId="product" name="Producto" />);
    fireEvent.click(screen.getByRole("button"));
    expect(state.navigate).toHaveBeenCalledWith("/sign-in");
    expect(state.toggle.mutate).not.toHaveBeenCalled();
  });

  it("reflects the API favorite state and targets the product", () => {
    state.favorites.data.products = [{ id: "product" }];
    render(<FavoriteButton productId="product" name="Producto" />);
    const button = screen.getByRole("button", {
      name: "Quitar Producto de favoritos",
    });
    expect(button).toHaveAttribute("aria-pressed", "true");
    fireEvent.click(button);
    expect(state.toggle.mutate).toHaveBeenCalledWith(
      { productId: "product" },
      expect.anything(),
    );
  });

  it("targets the business independently of products", () => {
    render(<FavoriteButton businessId="shop" name="Tienda" />);
    fireEvent.click(
      screen.getByRole("button", { name: "Guardar Tienda en favoritos" }),
    );
    expect(state.toggle.mutate).toHaveBeenCalledWith(
      { businessId: "shop" },
      expect.anything(),
    );
  });

  it("waits for the favorite state before allowing a toggle", () => {
    state.favorites.isLoading = true;
    render(<FavoriteButton productId="product" name="Producto" />);
    expect(screen.getByRole("button")).toBeDisabled();
    expect(screen.getByRole("button")).not.toHaveAttribute("aria-pressed");
  });

  it("retries a failed read instead of guessing whether to toggle", () => {
    state.favorites.isError = true;
    render(<FavoriteButton productId="product" name="Producto" />);
    fireEvent.click(
      screen.getByRole("button", { name: "Reintentar favoritos de Producto" }),
    );
    expect(state.favorites.refetch).toHaveBeenCalledOnce();
    expect(state.toggle.mutate).not.toHaveBeenCalled();
  });

  it("prevents repeat presses while the write is pending", () => {
    state.toggle.isPending = true;
    render(<FavoriteButton productId="product" name="Producto" />);
    const button = screen.getByRole("button");
    expect(button).toHaveAttribute("aria-busy", "true");
    expect(button).toBeDisabled();
    fireEvent.click(button);
    expect(state.toggle.mutate).not.toHaveBeenCalled();
  });

  it("retains the API state and reports a failed write", () => {
    render(<FavoriteButton productId="product" name="Producto" />);
    fireEvent.click(screen.getByRole("button"));
    state.toggle.mutate.mock.calls[0][1].onError(new Error("Network failure"));
    expect(screen.getByRole("button")).toHaveAttribute("aria-pressed", "false");
    expect(state.toast).toHaveBeenCalledWith(
      expect.objectContaining({ variant: "destructive" }),
    );
  });
});
