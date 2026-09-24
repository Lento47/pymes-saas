import type { ProductCard } from "@pymeshub/shared";

import { ProductTile } from "./product-tile";
import { Rail } from "./rail";

/**
 * A shelf: products side by side, scrolling sideways.
 *
 * `./category-rail`'s sibling and its opposite. That one scrolls chips because a strip of
 * twenty categories wrapped over four lines pushes the content below the fold; this one
 * scrolls *surfaces*, and the reason is the same but the cost is higher — a tile carries a
 * photograph, so a wrapped rail of them would put four screens of imagery above whatever the
 * reader came to the screen for. That is `docs/design-mobile.md`'s Rule 3 argument for
 * composing with imagery at a gallery's confidence, applied to the one axis a phone has.
 *
 * This file is only the row: which card it maps and how wide that card is. The shell — the
 * gutter, the gap, the peek — is `./rail`'s, and the card's own argument is
 * `./product-tile`'s.
 *
 * Nothing is drawn for an empty list — a shelf with nothing on it under a heading is a
 * heading with a shrug under it, which is `./category-rail`'s rule and holds here too.
 */
export function ProductRail({
	products,
	onQuickAdd,
}: {
	products: ProductCard[];
	/**
	 * The shelf's "+", handed straight to `./product-tile`'s opt-in target. Omitted by every
	 * rail whose reader has not bought the thing before — see that file's docblock for why
	 * the default is no button at all.
	 */
	onQuickAdd?: (product: ProductCard) => void;
}) {
	if (products.length === 0) return null;

	return (
		<Rail ratio={TILE_RATIO}>
			{(width) =>
				products.map((product, index) => (
					<ProductTile
						key={product.id}
						product={product}
						index={index}
						onQuickAdd={onQuickAdd}
						style={{ width }}
					/>
				))
			}
		</Rail>
	);
}

/**
 * Under a half, so the next tile peeks — see `./rail`. Four `space.xs` steps' worth of a
 * phone at 390 points is a 172-point tile, which holds a 4:3 crop, a two-line name and a
 * price without the name being truncated by the box rather than by a `numberOfLines` cap.
 */
const TILE_RATIO = 0.44;
