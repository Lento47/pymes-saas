import type { ProductCard } from "@pymeshub/shared";
import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { MarketplaceImage, ProductCardView } from "./cards";

vi.mock("@/lib/marketplace", () => ({
  MARKETPLACE_API_URL: "https://marketplace.test",
}));
vi.mock("./favorite-button", () => ({ FavoriteButton: () => null }));

const product: ProductCard = {
  id: "product_test",
  title: "Producto de prueba",
  description: null,
  imageUrl: "/uploads/product.webp",
  priceMinor: 2500,
  compareAtPriceMinor: 3000,
  discountPercent: 17,
  currency: "CRC",
  badges: [],
  rating: 4.5,
  reviewCount: 3,
  availability: {
    inStock: true,
    quantity: 5,
    maxOrderQuantity: 5,
    enabled: true,
    unavailableReason: null,
  },
  locationScope: "all_locations",
  prepTimeMinutes: 10,
  seller: {
    id: "shop_test",
    name: "Comercio de prueba",
    slug: "comercio",
    logoUrl: null,
    rating: 4.5,
  },
};

describe("marketplace product interactions", () => {
  it("keeps product navigation separate from a keyboard-operable add action", async () => {
    const add = vi.fn();
    const user = userEvent.setup();
    render(<ProductCardView product={product} onAdd={add} />);
    expect(screen.getAllByRole("link", { name: product.title })).toHaveLength(
      2,
    );
    for (const link of screen.getAllByRole("link", { name: product.title })) {
      expect(link).toHaveAttribute("href", `/product/${product.id}`);
      expect(link).not.toContainElement(screen.getByRole("button"));
    }
    screen.getByRole("button", { name: `Agregar ${product.title}` }).focus();
    await user.keyboard("{Enter}");
    expect(add).toHaveBeenCalledExactlyOnceWith(product);
  });

  it("prevents adding unavailable products and keeps their details reachable", async () => {
    const add = vi.fn();
    render(
      <ProductCardView
        product={{
          ...product,
          availability: { ...product.availability, inStock: false },
        }}
        onAdd={add}
      />,
    );
    expect(screen.getByText("Agotado")).toBeVisible();
    const button = screen.getByRole("button", {
      name: `Agregar ${product.title}`,
    });
    expect(button).toBeDisabled();
    fireEvent.click(button);
    expect(add).not.toHaveBeenCalled();
    expect(
      screen.getAllByRole("link", { name: product.title })[0],
    ).toHaveAttribute("href", `/product/${product.id}`);
  });

  it("guards duplicate additions while the request is pending", () => {
    const add = vi.fn();
    render(<ProductCardView product={product} adding onAdd={add} />);
    const button = screen.getByRole("button", {
      name: `Agregar ${product.title}`,
    });
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute("aria-busy", "true");
    fireEvent.click(button);
    expect(add).not.toHaveBeenCalled();
  });

  it("routes a protected add through the session action", () => {
    const add = vi.fn();
    const signIn = vi.fn();
    render(
      <ProductCardView
        product={product}
        onAdd={add}
        onProtectedAction={signIn}
      />,
    );
    fireEvent.click(
      screen.getByRole("button", { name: `Agregar ${product.title}` }),
    );
    expect(signIn).toHaveBeenCalledOnce();
    expect(add).not.toHaveBeenCalled();
  });
});

describe("marketplace image recovery", () => {
  it("replaces failed images and retries when the source changes", () => {
    const { rerender, container } = render(
      <MarketplaceImage src="/broken.webp" alt="Producto" />,
    );
    const image = screen.getByRole("img", { name: "Producto" });
    expect(image).toHaveAttribute("width", "640");
    fireEvent.error(image);
    expect(screen.queryByRole("img")).toBeNull();
    expect(
      container.querySelector(".market-image-fallback"),
    ).toBeInTheDocument();
    rerender(<MarketplaceImage src="/fixed.webp" alt="Producto" />);
    expect(screen.getByRole("img")).toHaveAttribute(
      "src",
      "https://marketplace.test/fixed.webp",
    );
  });
});
