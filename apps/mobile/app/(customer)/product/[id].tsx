import Ionicons from "@expo/vector-icons/Ionicons";
import { localizedName, type MessageKey } from "@pymeshub/i18n";
import {
	type Cart,
	MAX_LINE_QUANTITY,
	type ProductBadge,
} from "@pymeshub/shared";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { router, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { StyleSheet, View } from "react-native";
import { ActionBar, useActionBarClearance } from "@/components/action-bar";
import { AnimateIn } from "@/components/animate-in";
import { BackButton } from "@/components/back-button";
import { Button } from "@/components/button";
import { EmptyState } from "@/components/empty-state";
import { ErrorState } from "@/components/error-state";
import { Fact, Facts } from "@/components/facts";
import { FavoriteButton } from "@/components/favorite-button";
import { Field } from "@/components/field";
import { Gallery } from "@/components/gallery";
import { OptionCardRow } from "@/components/option-card";
import { Price } from "@/components/price";
import { QuantityStepper } from "@/components/quantity-stepper";
import { Rating } from "@/components/rating";
import { Screen } from "@/components/screen";
import { Sheet } from "@/components/sheet";
import { useSkeletonHold } from "@/components/skeleton";
import { ProductDetailSkeleton } from "@/components/skeletons";
import { Text } from "@/components/text";
import { useToast } from "@/components/toast";
import { toApiFailure } from "@/lib/api-error";
import { useSession } from "@/lib/auth/session";
import { useAddToCart } from "@/lib/cart-mutations";
import { light } from "@/lib/haptics";
import { useT } from "@/lib/i18n";
import { leaveScreen } from "@/lib/leave";
import { useTRPC } from "@/lib/trpc/context";
import { icon, space, useTheme } from "@/theme";

/**
 * The badges that are *words*, as dictionary keys rather than as the API's labels.
 *
 * `badgesOf` (`apps/api/src/services/mappers.ts:241-269`) derives each badge from a column and
 * sends `{ type, label }` with the label written in Spanish at the server — "Nuevo",
 * "Popular", `-25%`, "Domicilio". Three of those four are interface words about a product and
 * not the product's own name, so drawing `badge.label` would be a page that stays Spanish on a
 * phone set to English.
 *
 * The fourth is `discount`, and it deliberately keeps the API's label, because that label is
 * not a word: it is the computed percentage (`mappers.ts:253` pushes `` `-${discountPercent}%`
 * ``), which is the same number `compareAtPriceMinor` and `discountPercent` encode. A key
 * would have to read "Descuento" and drop the figure, or take a `{percent}` parameter this
 * component would have to recompute from two prices the API has already subtracted. So the map
 * holds the three words, the two data badges (`discount`, `custom`) keep their own text, and
 * the union below is what makes a fifth derived badge a compile error here rather than an
 * untranslated chip on a screen.
 */
const BADGE_KEYS = {
	new: "product.badge.new",
	popular: "product.badge.popular",
	shipping: "product.badge.shipping",
} as const satisfies Record<"new" | "popular" | "shipping", MessageKey>;

/**
 * One glyph per badge type — the second signal, never the only one, which is why every chip
 * also carries its word.
 *
 * The map is total over `ProductBadge["type"]`, so every badge draws with a mark and none of
 * them is a bare chip standing beside marked ones. `custom` is the case that needs the
 * argument: the neutral bookmark is the honest glyph for a badge whose meaning only the shop
 * knows, where a flame or a pricing tag would be this screen guessing at what the shop meant.
 */
const BADGE_ICONS: Record<
	ProductBadge["type"],
	React.ComponentProps<typeof Ionicons>["name"]
> = {
	new: "sparkles-outline",
	popular: "flame-outline",
	discount: "pricetag-outline",
	shipping: "bicycle-outline",
	custom: "bookmark-outline",
};

/**
 * The notes ceiling, and it is the schema's rather than this screen's.
 *
 * `cart.addToCartInput.notes` is `z.string().trim().max(300).optional()`. Typing a fourth
 * hundred characters and being refused by the API is a refusal the field can prevent, and
 * `maxLength` is the platform's own way of preventing it — the box stops taking input rather
 * than the request failing.
 */
const NOTES_MAX_LENGTH = 300;

/**
 * One dish, and the button that puts it in the cart.
 *
 * The hero is `./gallery`, which is `./image` page by page: the 4:3 box is the right size from
 * the first frame and each photograph fades in over it rather than the page rebuilding itself
 * around a late image. It draws `productDetailSchema.imageUrl` first and the shop's `images`
 * after it — this page used to draw `imageUrl ?? images[0]`, which left seven of the eight
 * photographs a shop may upload (`productCreateInput.images` is `max(8)`) unreachable — and a
 * product with no photograph at all gets the composed placeholder rather than a grey
 * rectangle. The wait before it is `ProductDetailSkeleton`, whose first block is the same 4:3
 * box, because on a page whose shape is already decided a spinner is a rectangle that answers
 * a question nobody asked.
 *
 * ## The bar, and what it is for
 *
 * The add button and the quantity used to be the last block of the scroll, which put the
 * page's one action below twenty option buttons: a customer who had decided had to scroll
 * to act. The action is now an `./action-bar` pinned over the scroll, carrying the CTA and
 * the price of the line as it stands — the product's price plus every chosen option's
 * delta, times the quantity, which is the arithmetic `apps/api`'s `effectiveUnitPriceMinor`
 * does, so the number on this screen and the number the cart stores are the same number.
 *
 * The **stepper stayed in the scroll.** The brief was for it to move into the bar, and it
 * cannot: `./quantity-stepper` is 156 points wide at rest (two 44pt targets and a 44pt
 * value with the token gaps), and with the pill CTA beside it the bar needs 287 points of
 * content width — more than the 256 an iPhone SE gives it after the float margin and the
 * bar's padding — and at 200% Dynamic Type the CTA's label alone grows past that on a 375pt
 * phone. A control that clips is worse than a control that scrolls, so the stepper sits
 * directly above the bar as the last block of the page, and the bar's price moves with it.
 * See the report.
 *
 * ## The required groups block the add, and the bar says why in words
 *
 * A group the shop marked required and the customer has not answered disables the CTA, and the
 * disabled button carries an `accessibilityHint` naming the groups that are still empty — a
 * group is named rather than counted, because "falta elegir en 2 grupos" leaves the reader to
 * go and find which two. The visible half is the ` · Obligatorio` marker on each group's own
 * heading, which is where the rule is.
 *
 * An `accessibilityHint` is not visible, though, and a disabled pill with nothing beside it is
 * a dead end: the reader is at the bottom of the page, two groups up and out of sight. So the
 * bar's summary slot — the place the line's total normally sits, which is where the decision
 * is made — carries the state instead of the money while the add is blocked, and only when the
 * pill beside it does not already say it: `product.requiresOptions` when the block is a group's,
 * and nothing at all while the product is out of stock — the pill reads `product.soldOut`
 * itself, and a summary repeating the control's own word is one word twice in one bar.
 * `docs/design-mobile.md`'s Rule 2 draws that line (a state is a sentence) and Rule 1 is not
 * broken by it: the total is the bar's loud number *because* it is what commits, and while
 * nothing can be committed the number would be a price for an order that cannot be placed.
 *
 * What the block is **not** is a client standing in for a server rule. Measured by reading
 * `apps/api/src/services/cart.ts`: `addItem` resolves the chosen ids with `chosenOptionsOf`
 * (which refuses an id that is not an option of this product) and reads neither `isRequired`
 * nor `minSelect` nor `maxSelect` — a short selection is stored as given. The floor is the
 * shop's rule and the only two places it is expressed are the group's heading
 * (`./option-card` draws it) and this bar.
 *
 * ## The badges and the sold count, in the dictionary's words
 *
 * `badgesOf` (`apps/api/src/services/mappers.ts`) derives up to four badges from columns and
 * sends `{type, label}` with the label written in Spanish at the server. A component that
 * printed `badge.label` would be a page that stays Spanish when the customer's phone is in
 * English, so the three *word* badges are looked up in `BADGE_KEYS` instead. The other two keep
 * the API's own text and for the same reason in each case: `custom` is the shop's free text and
 * has no key to be given, and `discount` is not a word but the computed percentage ("-25%"),
 * which a key would either drop or have to recompute from two prices the API has already
 * subtracted.
 *
 * They are drawn as `./facts` chips rather than as a second badge primitive, because that is
 * what Rule 2 says a fact is, and two more facts join them: `soldCount`, a real column the
 * payload has always carried and this page never drew, and the remaining stock when that count
 * is the ceiling on what can be ordered (`lowStock`, and `./product-row` makes the same
 * measurement for the same reason). Every one appears only when it exists — `Facts` returns
 * nothing for a row whose children all filtered out, and a product nobody has bought prints no
 * count rather than "0 vendidos". The tags are a second row of the same chips, next to the
 * description they belong to: a badge is derived from a column and moves with the product's
 * state, while a tag is a word the shop chose and reads as part of what the dish *is*.
 *
 * ## The notes are the customer's, and go with the line
 *
 * `cart.addToCartInput` has carried `notes` — `trim().max(300)` — since the cart was built,
 * and `lib/cart-mutations.ts` already draws a provisional line with a `notes` field, so the
 * one thing missing was a field to type in. It goes in the tail above the stepper, it is
 * `notes.trim()`-ed at both ends (the input's `notes` and the drawn line's), and it is empty
 * by default: `product.notes` and `product.notes.placeholder` were in the dictionary with no
 * caller until this field. `maxLength` is the schema's 300 rather than a number of the
 * field's own, so the refusal the API would make cannot be typed.
 *
 * The field is why this screen passes `keyboardInsets` to `./screen` — it is the last thing in
 * the scroll, which is where a keyboard opens over. It also means the note is per *add* and not
 * per line: `cart.addItem` stores the note on the line and overwrites it when a later add
 * resolves to the same `optionsHash` (`apps/api/src/services/cart.ts`), so typing a second note
 * and adding again replaces the first. See the report.
 *
 * ## The haptics
 *
 * Two, and both are `light()`, and both fire at the tap rather than at the answer.
 * `docs/design-mobile.md` assigns `impactLight` to this set by name — "add-to-cart,
 * favourite, quantity" — and the cart already fired it that way: stepping a quantity there
 * buzzes from `lib/cart-mutations.ts` before the request leaves. The add is now the same
 * story from the same file — this screen calls `useAddToCart`, which fires `light()` on the
 * tap and only then sends `cart.addItem` — so the page's two commits answer the thumb, and
 * neither reports the network. Stepping the quantity on *this* page was the one place calling
 * `selection()`, the haptic the spec reserves for a tab, segment or picker settling, so the
 * same gesture answered differently on two screens. Choosing an option *is* a picker
 * settling, and that haptic lives in `./option-card` next to the choice it answers.
 *
 * ## The add is optimistic
 *
 * Adding to the cart is in the spec's optimistic set by name — "adding to the cart, changing
 * a quantity, toggling a favourite" — so the line is drawn in the cart before `cart.addItem`
 * answers, and a refusal rolls it back and says so in the API's own sentence; the trade, and
 * the four ways this call can be refused, are argued in `lib/cart-mutations.ts`. The
 * `CONFLICT` is the one refusal this screen owns: another shop's cart is a question rather
 * than a failure, and only the customer can answer it.
 *
 * ## The confirmation, and where it lands
 *
 * A successful add is a write, and `docs/design-mobile.md`'s Rule 5 says a write is confirmed
 * where it happened: the screen calls `useToast()` once, with what was added and the cart it
 * landed in — "Pizza en el carrito · 3 artículos". The count is read straight out of the query
 * cache, which `lib/cart-mutations.ts` writes *before* it calls its `onSuccess`, and it is the
 * dictionary's existing `order.itemCount` — the same key that hook announces a cart change with,
 * so the spoken count and the drawn one cannot disagree about how many things are in the basket.
 *
 * The failure deliberately does not go there. `./toast` takes a sentence and nothing else, on
 * purpose: a refusal needs a reason and often a retry, and a message the customer must act on
 * cannot be allowed to leave on its own after 3.2 seconds. This screen's two failures are the
 * `ErrorState` under the stepper and the cross-shop `Alert`.
 *
 * The page still opens the cart on success, as it did before the toast existed, so the toast
 * arrives over the cart — the surface the write just changed, and where the line it is talking
 * about is now sitting.
 *
 * ## The price does not move
 *
 * Quantity changes the total, and animating money is on the list of things this app does
 * not do: a number that counts up is a number the customer has to read twice to be sure of.
 * The total is recomputed and drawn, in full, immediately.
 *
 * ## What arrives, and what does not
 *
 * The page is a column of blocks and they enter as one (`./animate-in`), in the order they are
 * read: the name, the badges and the sold count, the rating, the price, the shop, the
 * description, the tags, then the choices. The hero is deliberately **not** one of them. It is
 * `./gallery`, whose every page is `./image` — fading the photograph in over a box that is
 * already the right size, which is what the 4:3 box above is for — and a rise on the box would
 * be a second entrance for one arrival: the block would move while the picture inside it was
 * still fading in, which is the "page rebuilding itself around a late image" this page's
 * docblock above says the box exists to prevent.
 *
 * Nothing on this page carries `reorder`, and that is not an omission. `products.byId` is read
 * once — there is no polling here — the option groups are fixed for a product, and the one thing
 * that changes while the reader is on the page, the chosen options and the quantity, changes
 * *because the reader just tapped it*: it arrives on the frame of the tap, from the control that
 * owns that feedback (`./button`, `./option-card`, `./quantity-stepper`). A layout spring is for
 * movement the reader did not cause — the total on the cart, the rail on an order — and a page
 * whose only movement is the reader's own hand does not need one. The price is the case this
 * file already argues about below, and it stays put.
 *
 * ## The shop's reviews are not this dish's
 *
 * The rating under the title is the product's own — `rating` and `reviewCount`, columns on the
 * product row, drawn by `./rating` — and nothing here presents the shop's as if it were the
 * item's. There is no per-item review list behind that number and this page does not promise
 * one: the only public reviews read is keyed by `businessId`
 * (`apps/api/src/routers/reviews.ts` — `list: publicProcedure` over `reviewListInput`, which
 * has no product field). The shop's score is therefore not drawn here either, at any size:
 * `sellerSummaryOf` sends the shop's `rating` with no count behind it, and `./review-summary`
 * without a count is a headline that cannot be checked. The way to the shop's reviews is the
 * shop control under the price, which opens the storefront and its reviews block — the shop's
 * numbers under the shop's name, where they are true.
 *
 * ## What this page does not show
 *
 * The related list. `product.related` arrives in the payload and `product.related` is a word in
 * the dictionary, but the rail it would want is a card primitive this page does not have:
 * `./product-row` is a full-width row, and a horizontal rail of them is a menu drawn sideways
 * under a page that is already one dish. It is a screen of its own rather than a strip, and a
 * second product card invented here would be a second product card in the app. See the report.
 */
export default function Product() {
	const { id } = useLocalSearchParams<{ id: string }>();
	const trpc = useTRPC();
	const { t, tp, locale } = useT();
	const { colors } = useTheme();
	const { status } = useSession();
	const { show } = useToast();
	const cache = useQueryClient();
	const bar = useActionBarClearance();
	const [quantity, setQuantity] = useState(1);
	const [options, setOptions] = useState<string[]>([]);
	const [notes, setNotes] = useState("");
	const [conflictOpen, setConflictOpen] = useState(false);

	const product = useQuery(trpc.products.byId.queryOptions({ id }));
	const waiting = useSkeletonHold(product.isPending);

	/**
	 * The add, and the three things this screen does with its answer.
	 *
	 * The write itself — the drawn line, the rollback, the announcement and the `light()`
	 * haptic at the tap — is `lib/cart-mutations.ts`'s, which is the whole reason the add can
	 * commit before the API answers. What cannot be inferred there is what the answer means
	 * *here*: the sentence rule 5 asks for, the cart it opens, and the cross-shop question when
	 * the API refused with `CONFLICT` — the one refusal on this screen the customer can answer,
	 * and the reason the `ErrorState` below the stepper renders everything else.
	 */
	const {
		add: addToCart,
		error: addError,
		isPending: adding,
	} = useAddToCart({
		onSuccess: () => {
			/**
			 * The cart the hook just wrote, read out of the cache rather than awaited.
			 *
			 * `lib/cart-mutations.ts` sets the response before it calls this, so this is the
			 * server's own figure and not a mirror, and reading it costs no second request.
			 *
			 * It can be absent — a customer who has never opened the cart has no entry under
			 * that key — and that is the case the toast must not guess at: "0 artículos" is a
			 * claim about a basket nobody read. So the count is printed only when there is one,
			 * and the sentence falls back to the half it can prove: what was added.
			 */
			const cart = cache.getQueryData<Cart>(trpc.cart.get.queryKey(undefined));
			const units = cart?.items.reduce((sum, item) => sum + item.quantity, 0);
			// `data` is defined wherever this can run: `addItem` returns before it sends
			// anything when the product has not arrived, and nothing can succeed after that.
			if (!data) return;
			show(
				units === undefined
					? t("product.added", { name: data.title })
					: `${t("product.added", { name: data.title })} · ${tp("order.itemCount", units)}`,
			);
			// The note went with the line it was written for. Leaving it in the box would send
			// it again on the next add, and `cart.addItem` overwrites the stored note with the
			// input's on any add that resolves to the same line (`apps/api/src/services/cart.ts`
			// — `notes: input.notes ?? line[0].notes`), so a note nobody retyped would still
			// rewrite the line. Cleared here, the customer types a new one or sends none.
			setNotes("");
			router.push("/cart");
		},
		onError: (error) => {
			// The one refusal that is a question rather than a report, so it opens the sheet at
			// the foot of this screen instead of the `ErrorState` in the tail. `addItem` sends
			// `"reject"` until the customer has answered, so what arrived here is the API
			// declining to empty somebody's basket at another shop on its own initiative.
			if (toApiFailure(error).code === "CONFLICT") setConflictOpen(true);
		},
	});

	function addItem(replace = false) {
		if (status !== "signed-in") {
			router.push("/sign-in");
			return;
		}
		// The bar renders only once the product has arrived, so `data` is defined wherever
		// this can be reached; the compiler cannot see that, and narrowing once is cheaper
		// than an optional chain on every field of the line below.
		if (!data) return;

		addToCart(
			{
				productId: id,
				quantity,
				optionIds: options,
				// `|| undefined` rather than the raw string: `addToCartInput.notes` is
				// `.trim().max(300).optional()`, so a box holding three spaces would pass the
				// schema as an empty string and be stored as one, and an empty note is the same
				// thing as no note. Sent as absent, the API stores null. The `.trim()` is here
				// as well so the drawn line below and the request agree on the text.
				notes: notes.trim() || undefined,
				onBusinessConflict: replace ? "replace" : "reject",
			},
			// The line as this screen has already drawn it: the name and price it is showing,
			// the options chosen in the rails above, and the note typed in the field, so the
			// row that appears in the cart is the row the customer was just looking at rather
			// than a blank waiting for an answer. Every figure is an integer in the currency's
			// minor unit.
			{
				name: data.title,
				unitPriceMinor: data.priceMinor,
				effectiveUnitPriceMinor: data.priceMinor + optionsDeltaMinor,
				options: chosen.map((option) => ({
					id: option.id,
					name: option.name,
					priceDeltaMinor: option.priceDeltaMinor,
				})),
				imageUrl: cover,
				notes: notes.trim() || null,
			},
		);
	}

	const data = product.data;
	// The cover, and the one the cart row shows: the first page of the pager, which is what
	// the customer was looking at when they added it. `./gallery` dedupes the two fields, so
	// this is that same first page rather than a second reading of them.
	const cover = data?.imageUrl ?? data?.images[0] ?? null;
	const ready = !product.isError && !waiting && !!data;

	// The category, in the reader's language. `categoryNameEn` is nullable — the six demo
	// categories `packages/db/src/seed.ts` writes carry Spanish only — so the fallback is
	// `@pymeshub/i18n`'s `localizedName` and not a second reading of `nameEn` here.
	const categoryName = data?.categoryName
		? localizedName(
				{ name: data.categoryName, nameEn: data.categoryNameEn },
				locale,
			)
		: null;

	/**
	 * The chosen option rows, out of every group on the page — in the order the shop wrote
	 * them.
	 *
	 * One list with two readers: the sum below, and the provisional line the optimistic add
	 * hands to `lib/cart-mutations.ts`. Both have to name the same set — a drawn line whose
	 * options differed from the ones being charged for would be the receipt disagreeing with
	 * the button, which is the failure the sum below exists to prevent.
	 */
	const chosen = (data?.optionGroups ?? [])
		.flatMap((group) => group.options)
		.filter((option) => options.includes(option.id));

	/**
	 * The unit price as the API will store it: the product's price plus every chosen
	 * option's delta.
	 *
	 * The same sum `apps/api`'s `services/mappers.ts` does for `effectiveUnitPriceMinor`, and
	 * it has to be the same one — a bar that showed the bare product price while the cart
	 * charged for the options is the receipt disagreeing with the button. Nothing is divided
	 * and nothing is rounded: every figure here is an integer in the currency's minor unit
	 * and it is handed to `formatMoney` untouched.
	 */
	const optionsDeltaMinor = chosen.reduce(
		(total, option) => total + option.priceDeltaMinor,
		0,
	);
	const lineTotalMinor = data
		? (data.priceMinor + optionsDeltaMinor) * quantity
		: 0;

	/**
	 * The groups whose floor is not met yet — the shop's rule, counted rather than guessed.
	 *
	 * The floor is `minSelect`, and `isRequired` only ever raises it: the schema refines
	 * `isRequired` to `minSelect >= 1`, so a required group without a stated floor needs one
	 * choice and a `MULTI` group may need two (`./option-card` draws that number on the
	 * group's own heading, which is the visible half of the same sentence). Counting against
	 * the group's *own* floor rather than against "is anything chosen" is what makes a group
	 * that needs two choices block an add that has one — the case the old flag could not see.
	 *
	 * This is the visible half of a rule and not a client guard standing in for a server one:
	 * measured by reading `apps/api/src/services/cart.ts`, `addItem` resolves the chosen ids
	 * and reads neither `isRequired` nor `minSelect`, so there is no 400 behind this — the
	 * block is the only place the floor is enforced at the moment of the add.
	 */
	const unmetGroups = (data?.optionGroups ?? [])
		.filter((group) => {
			const floor = Math.max(group.minSelect, group.isRequired ? 1 : 0);
			if (floor === 0) return false;
			const chosenHere = group.options.filter((option) =>
				options.includes(option.id),
			).length;
			return chosenHere < floor;
		})
		.map((group) => group.name);

	/**
	 * How many are left, when that number is the ceiling on the order — and only then.
	 *
	 * The same measurement `./product-row` makes and for the same reason: `availabilityOf`
	 * (`packages/shared/src/schemas/catalog.ts`) sets `maxOrderQuantity` to
	 * `min(MAX_LINE_QUANTITY, stockQuantity)` when a shop tracks inventory, so stock at or
	 * above the line ceiling can satisfy any order a customer can build and the count says
	 * nothing the stepper's own maximum does not. Below it the ceiling *is* the stock, and
	 * this page is where the stepper the customer will hit it on is drawn.
	 *
	 * Two more conditions, and both exist to stop the row contradicting itself. `null` stock
	 * is a shop that does not track inventory, so there is no count to print; a count of zero
	 * is the absence of stock, which the "Agotado" chip and the bar's own sentence already
	 * say — "Quedan 0" beside "Agotado" is one fact written twice, in the form that reads as
	 * an error; and a dish that is not orderable at all is exactly the case where a remaining
	 * count is a lie, because the shop can hold stock of something it has switched off. So the
	 * count is drawn only while the product is actually orderable.
	 */
	const stockQuantity = data?.availability.quantity ?? null;
	const lowStock =
		data?.availability.inStock &&
		stockQuantity !== null &&
		stockQuantity > 0 &&
		stockQuantity < MAX_LINE_QUANTITY
			? stockQuantity
			: null;

	/**
	 * Why the add cannot be made, in the dictionary's words, or `null` when it can.
	 *
	 * Out of stock wins over an empty group, because it is the one the customer cannot fix:
	 * naming a group on a dish nobody can order today would send them up the page to answer a
	 * question that does not open the button. This is the bar's sentence — the total steps
	 * aside for it, which is `docs/design-mobile.md`'s Rule 2 read on the one slot the bar has —
	 * and it is drawn only while the pill does not already carry the same word. Sold out is
	 * `product.soldOut` on the control itself, and a summary repeating it is one word twice.
	 */
	const blockedReason = data
		? !data.availability.inStock
			? t("product.soldOut")
			: unmetGroups.length > 0
				? t("product.requiresOptions")
				: null
		: null;

	// Shared by the header button and the not-found screen — `lib/leave` owns the pair.

	return (
		<View style={styles.root}>
			<Screen
				padded={false}
				scroll
				// Opted in by its exact prop name, because this is the screen that grew a text
				// field: the note sits at the foot of the scroll, which is where a keyboard
				// opens over. `./screen` owns the platform branch, so no screen decides one for
				// itself — iOS is given `automaticallyAdjustKeyboardInsets`, and Android needs
				// nothing: `apps/mobile/android/app/src/main/AndroidManifest.xml:21` carries
				// `android:windowSoftInputMode="adjustResize"` (the prebuild default —
				// `app.config.ts` does not set `softwareKeyboardLayoutMode`), so the window the
				// scroll view lives in is already shorter than the keyboard. The iOS branch is
				// a documented behaviour of that prop, not a claim about a run: this host has
				// no iOS simulator.
				keyboardInsets
				// The room the bar needs, measured off the bar rather than predicted: at 200% text
				// the label wraps, the row breaks, and the bar is about twice `ACTION_BAR_CLEARANCE`.
				// Never add the inset to this — it is already in the number; see the hook.
				contentStyle={{ paddingBottom: bar.clearance }}
			>
				<View style={styles.pad}>
					<BackButton to="/" />
				</View>

				{product.isError ? (
					// An id we do not have is a dead link, not a broken page: the sentence, the
					// request id and the Retry all belong to the other branch. `category/[slug].tsx`
					// draws the same distinction, and `product.notFound` was sitting in the
					// dictionary unused until this branch read it.
					toApiFailure(product.error).code === "NOT_FOUND" ? (
						<View style={styles.pad}>
							<EmptyState
								icon="cube-outline"
								title={t("product.notFound")}
								body={t("product.notFound.body")}
								actionLabel={t("action.back")}
								onAction={() => leaveScreen("/")}
							/>
						</View>
					) : (
						<View style={styles.pad}>
							<ErrorState
								error={product.error}
								onRetry={() => void product.refetch()}
							/>
						</View>
					)
				) : waiting || !data ? (
					<ProductDetailSkeleton />
				) : (
					// Edge-to-edge, because the option rails bleed: each block pays the horizontal
					// padding the page has, and the rails pay their own — so the padding is on the
					// blocks and *not* on this container, which would inset a rail twice and stop it
					// reaching the screen's edge. `./option-card` explains why the rail owns it.
					<View style={styles.sections}>
						{/* Always drawn, and never conditionally: `./gallery` composes the
						    placeholder itself when the shop uploaded nothing, so a branch here
						    would be a second, differently-shaped empty state for the same
						    absence. It is outside `./animate-in` — see the docblock. */}
						<View style={styles.pad}>
							<Gallery
								coverUrl={data.imageUrl}
								images={data.images}
								style={styles.hero}
							/>
						</View>

						<AnimateIn index={0} style={styles.pad}>
							<Text variant="title" bold>
								{data.title}
							</Text>
						</AnimateIn>

						{/* The badges, the sold count and the remaining stock, in the dictionary's
						    words. `./facts` draws nothing at all when every child is filtered out,
						    so a new product with no badge and no sale leaves no gap behind. */}
						<AnimateIn index={1} style={styles.pad}>
							<Facts>
								{data.badges.map((badge) => (
									<Fact
										// The type, and not the label: `badgesOf` pushes each type at
										// most once (`mappers.ts:246-268` — four pushes, each behind its
										// own condition), while a label is the shop's own text for
										// `custom` and a `-25%` string for `discount`, so two labels can
										// collide where two types cannot.
										key={badge.type}
										// `custom` is the shop's own free text and `discount` is a
										// computed percentage, so the two of them bring their own
										// text; the three words are looked up. See `BADGE_KEYS`.
										value={
											badge.type === "custom" || badge.type === "discount"
												? badge.label
												: t(BADGE_KEYS[badge.type])
										}
										iconName={BADGE_ICONS[badge.type]}
									/>
								))}
								{/* A count of zero prints nothing: "0 vendidos" is a claim about a
								    product nobody has bought, drawn beside a button inviting the
								    first one. */}
								{data.soldCount > 0 ? (
									<Fact
										value={tp("product.sold", data.soldCount)}
										iconName="bag-check-outline"
									/>
								) : null}
								{lowStock !== null ? (
									<Fact
										// `tp`: the count can be 1, and *quedar* agrees with it. See
										// `./product-row`, which draws the same fact on the menu row.
										value={tp("product.lowStock", lowStock)}
										iconName="alert-circle-outline"
									/>
								) : null}
							</Facts>
						</AnimateIn>

						<AnimateIn index={2} style={styles.pad}>
							<View style={styles.metaRow}>
								{/* The product's own average and the number of reviews behind it —
								    `rating` and `reviewCount` are columns on the product row. Nothing
								    is shown when nobody has reviewed the dish, and the shop's own
								    score is deliberately not drawn at this size: see the docblock. */}
								<Rating rating={data.rating} count={data.reviewCount} />
								{categoryName ? (
									<Text variant="label" tone="muted">
										{categoryName}
									</Text>
								) : null}
							</View>
						</AnimateIn>

						<AnimateIn index={3} style={styles.pad}>
							<Price
								amountMinor={data.priceMinor}
								currency={data.currency}
								compareAtMinor={data.compareAtPriceMinor}
							/>
						</AnimateIn>

						{/* The shop's own control, and — see the docblock — the only route from this
						    page to the shop's reviews. It is a `./button` and not a `./facts` chip
						    because it goes somewhere: a fact is a statement and this is a target, so
						    it carries the 44-point floor and a press state that a chip must not.

						    It is also where `./review-summary` would belong if this page could draw
						    it, and it cannot: `sellerSummaryOf` sends the shop's `rating` with no
						    count, and a summary without a count is a headline nobody can check. The
						    shop's numbers are drawn on the storefront, under the shop's name. */}
						<AnimateIn index={4} style={styles.pad}>
							<View style={styles.sellerRow}>
								<Button
									variant="ghost"
									label={data.seller.name}
									icon={
										<Ionicons
											name="storefront-outline"
											// `icon.control`: a glyph drawn inside a control's own target —
											// the shop's name is inside this button, so the mark is sized
											// against the control and not against the line of text beside it.
											size={icon.control}
											color={colors.foreground}
											accessibilityElementsHidden
											importantForAccessibility="no"
										/>
									}
									onPress={() =>
										router.push({
											pathname: "/store/[slug]",
											params: { slug: data.seller.slug },
										})
									}
									style={styles.sellerButton}
								/>
								<FavoriteButton target={{ kind: "product", card: data }} />
							</View>
						</AnimateIn>

						{data.description ? (
							<AnimateIn index={5} style={styles.pad}>
								<Text variant="body" tone="muted">
									{data.description}
								</Text>
							</AnimateIn>
						) : null}

						{/* The tags, as the same chip row the badges use, and only when the shop
						    wrote some — `productCreateInput.tags` defaults to an empty array, so
						    most products have none and `./facts` draws nothing for them. They sit
						    with the description rather than with the badges: a badge is derived
						    from a column and changes with the product's state, while a tag is a
						    word the shop chose and reads as part of what the dish *is*. */}
						{data.tags.length > 0 ? (
							<AnimateIn index={6} style={styles.pad}>
								<Facts>
									{data.tags.map((tag) => (
										<Fact
											// The word itself: tags are the shop's own and two
											// identical ones draw the identical chip, so there is no
											// second part to tell their keys apart by — a position
											// would be a key that changes when the shop reorders the
											// list, which is exactly what a key must not do.
											key={tag}
											value={tag}
										/>
									))}
								</Facts>
							</AnimateIn>
						) : null}

						{data.optionGroups.map((group, index) => (
							// Keyed on the outer wrapper, which is what React reconciles: a group keeps its
							// identity through the entrance and through its own `index`, and the index is
							// only a delay — the groups are read in the order the shop wrote them and they
							// do not move.
							<AnimateIn key={group.id} index={index + 7}>
								<OptionCardRow
									name={group.name}
									required={group.isRequired}
									// The group's own floor, so a group needing two choices says so on
									// its heading rather than at the button — `./option-card` draws it
									// only from two up, which is the only case the required marker
									// cannot already express.
									minSelect={group.minSelect}
									kind={group.kind}
									options={group.options}
									selectedIds={options}
									currency={data.currency}
									onToggle={(optionId) =>
										setOptions((current) => {
											const rest =
												group.kind === "SINGLE"
													? current.filter(
															(selected) =>
																!group.options.some(
																	(candidate) => candidate.id === selected,
																),
														)
													: current;
											return current.includes(optionId)
												? rest.filter((selected) => selected !== optionId)
												: [...rest, optionId];
										})
									}
								/>
							</AnimateIn>
						))}

						{/* The foot of the page, which is now everything that is not the bar: the note,
						    the stepper the bar cannot hold (see the docblock), and the failure if the
						    add was refused. Last because it is the last thing before the CTA, and the
						    `index` is past the option groups — the stagger caps at six, so anything
						    from there on arrives together, which is what a foot should do. */}
						<AnimateIn index={7 + data.optionGroups.length} style={styles.pad}>
							<View style={styles.tail}>
								{/* `cart.addToCartInput.notes` — `trim().max(300).optional()` — carried no
								    field anywhere in the app until this one, and `product.notes` /
								    `product.notes.placeholder` were in the dictionary with no caller.
								    `./field` and not a bare `TextInput`: the label above the box is what
								    a screen reader announces as the field's name, and a label that lives
								    only in the accessibility tree is invisible to everyone else.

								    `maxLength` is the schema's 300 rather than a number of this field's
								    own, so the refusal the API would make cannot be typed. `multiline`,
								    because a note is a sentence: a single-line box scrolls a long one
								    sideways, and the customer cannot read back what they wrote.

								    Empty by default and never required — an empty note is sent as absent
								    (`notes.trim() || undefined` in `addItem`), which is what the schema's
								    `.optional()` asks for. */}
								<Field
									label={t("product.notes")}
									value={notes}
									onChangeText={setNotes}
									placeholder={t("product.notes.placeholder")}
									multiline
									maxLength={NOTES_MAX_LENGTH}
									// No `style`: `./field` spreads its remaining props **last**, so a
									// `style` from here would replace the input's own box — its border,
									// its radius and the focus ring — rather than narrow it. The field
									// places itself, and it sits above the stepper rather than inside
									// the bar because the bar is one row with one number and one CTA,
									// and a box that grows with a sentence would move the button.
								/>

								{/* The shared stepper rather than two `Button`s drawn here. The hand-rolled
								    pair had the accessible *name* of each control set to its glyph — a reader
								    announced "−, botón" and then a hint about a quantity — and it re-decided
								    the 44-point target, the tabular digits and the floor/ceiling states that
								    `QuantityStepper` already owns. A screen places a component; it does not
								    restyle one, and this was the restyling. */}
								<QuantityStepper
									value={quantity}
									onChange={(next) => {
										light();
										setQuantity(next);
									}}
									label={t("product.quantity")}
									decreaseLabel={t("product.quantity.decrease")}
									increaseLabel={t("product.quantity.increase")}
									max={data.availability.maxOrderQuantity}
									disabled={!data.availability.inStock}
								/>

								{/* `CONFLICT` is the one refusal this block is not for: it is a
								    question, and the sheet at the foot of the screen asks it. Two
								    surfaces on one refusal would be one of them saying the wrong
								    thing — `lib/api-error.ts` reads an un-overridden `CONFLICT` as
								    "it is on our side", which is false for a cart that is the
								    customer's own. */}
								{addError && toApiFailure(addError).code !== "CONFLICT" ? (
									<ErrorState error={addError} />
								) : null}
							</View>
						</AnimateIn>
					</View>
				)}
			</Screen>

			{/*
			 * Outside `Screen`, because `Screen` renders its children inside its ScrollView and
			 * a bar that scrolls away is the button this replaced. Absolute, so it is a layer
			 * over the scroll rather than a row that takes height from it.
			 */}
			{ready && data ? (
				<View style={styles.bar}>
					<ActionBar
						onHeightChange={bar.onHeightChange}
						summary={
							/* Out of stock leaves the slot empty: the pill beside it already reads
							   `product.soldOut`, and a summary repeating the control's own word is
							   one word twice in one bar. */
							!data.availability.inStock ? null : blockedReason ? (
								/* The state, in words, in the slot the total normally holds.
								   `docs/design-mobile.md`'s Rule 2 — a fact is a chip, a state is a
								   sentence — and Rule 5's spirit: a refusal belongs where the tap
								   would have happened, not on a toast. The sentence is the same one
								   the CTA's `accessibilityHint` carries, so the reader who cannot see
								   the bar and the reader who can are told the same thing. */
								<Text variant="body" tone="muted">
									{blockedReason}
								</Text>
							) : (
								/* The bar's one number is what the add will cost: the product's price
								   plus the chosen options, times the quantity. `compareAt` is
								   deliberately not repeated here — the struck-through price belongs to
								   the product and not to the line, and a second one in the bar would be
								   a discount claim about options that do not have one. The figure is
								   `Price`, so it goes through `formatMoney` and is never divided. */
								<Price amountMinor={lineTotalMinor} currency={data.currency} />
							)
						}
						primary={{
							// Sold out is said in words on the control itself, disabled rather than
							// hidden: a customer who cannot order the dish still needs to see that it
							// is this dish, and a missing button reads as a page that failed. An
							// unanswered option group keeps the ordinary label — the control is not
							// broken, one question above it is open, and the bar's summary is where
							// that is said.
							label: data.availability.inStock
								? t("product.add")
								: t("product.soldOut"),
							loading: adding,
							disabled: blockedReason !== null,
							accessibilityHint:
								data.availability.inStock && unmetGroups.length > 0
									? t("storefront.option.required", {
											groups: unmetGroups.join(", "),
										})
									: undefined,
							onPress: () => addItem(),
						}}
					/>
				</View>
			) : null}

			{/*
			 * The cross-shop question, in the app's own panel rather than the OS alert that used
			 * to draw it.
			 *
			 * An `Alert` is platform chrome: it takes no theme token, so a screen that is
			 * entirely ours ends in two buttons drawn in the OS's colours. The three remaining
			 * ones in the app are all *pre-write* confirmations for exactly that reason
			 * (`app/account.tsx`, `app/addresses.tsx`, `app/order/[id].tsx`), and this
			 * was the only one used to report an answer the API had already given.
			 *
			 * The two reorder screens answering this same `CONFLICT` with an `ErrorState` are
			 * not a precedent against the shape: the difference is the strategy. They leave
			 * `onBusinessConflict` at its default `"reject"`, so the refusal is final and the
			 * reason *is* the whole message. This screen's second attempt sends `"replace"`,
			 * which is a decision the customer can still take — and a decision needs two
			 * answers, which `ErrorState` has nowhere to hold.
			 *
			 * `docs/api-surface.md:65` and `apps/api/src/services/cart.ts:37-45` both describe
			 * the client's answer to this refusal as a "start a new cart?" sheet, and
			 * `lib/cart-mutations.ts:248` names this screen as the one that can offer it. The
			 * two answers were already written and read by nothing: `cart.otherBusiness.confirm`
			 * and `cart.otherBusiness.keep` in both dictionaries. They are its two buttons now.
			 *
			 * Last in this screen's root, because `./sheet` has no portal and a later sibling
			 * paints over it — including the bar above, which is absolute. See that file.
			 */}
			<Sheet
				open={conflictOpen}
				onClose={() => setConflictOpen(false)}
				title={t("cart.otherBusiness.title")}
				closeLabel={t("action.close")}
				// `[1]`, the fraction that resolves to no translation on a panel shorter than the
				// screen — which this one is, and which is what keeps it drawn where it is: see
				// `app/cart.tsx`'s promo sheet and `./filter-sheet` for the same reading.
				snapPoints={[1]}
				footer={
					// The bar holds the one action the panel is for. Docked, because it is the
					// footer of a surface sized to its content — nothing scrolls under it.
					<ActionBar
						docked
						// `destructive` and not `primary`: what this tap does is *discard* the lines
						// the customer collected at the other shop, which is the case that variant
						// exists for. The OS alert this replaced drew its confirm button the same
						// way, and a fill that reads as the happy path would hide the loss.
						variant="destructive"
						primary={{
							label: t("cart.otherBusiness.confirm"),
							onPress: () => {
								setConflictOpen(false);
								addItem(true);
							},
						}}
					/>
				}
			>
				<View style={styles.prompt}>
					{/* The API's own words for the rule, in the panel's body: one business per
					    order, and the question the two controls below answer. */}
					<Text variant="body" tone="muted">
						{t("cart.otherBusiness.body")}
					</Text>
					{/* The other answer, in the body rather than beside the action in the bar: an
					    `ActionBar` is built to hold one control (`action-bar.tsx` — a ghost
					    button is deliberately unreachable there), and this is the second answer
					    rather than a second action. Dismissing the panel — the backdrop, the
					    close button — is the same answer, so nothing is reachable only here. */}
					<Button
						label={t("cart.otherBusiness.keep")}
						variant="secondary"
						size="sm"
						fullWidth
						onPress={() => setConflictOpen(false)}
					/>
				</View>
			</Sheet>
		</View>
	);
}

const styles = StyleSheet.create({
	// The bar is absolute inside this, so the screen needs a box of its own to be pinned to.
	root: { flex: 1 },
	// Edge-to-edge, because the option rails bleed; everything on this page that is a column
	// of blocks pays the same horizontal padding.
	pad: { paddingHorizontal: space.lg },
	sections: { gap: space.lg },
	// The foot's internal rhythm is the section gap its blocks had as siblings of `sections`.
	tail: { gap: space.lg },
	// The cross-shop panel's body: the sentence, then the answer that is not the bar's action.
	prompt: { gap: space.md },
	hero: { width: "100%", aspectRatio: 4 / 3 },
	metaRow: {
		flexDirection: "row",
		alignItems: "center",
		gap: space.md,
		flexWrap: "wrap",
	},
	sellerRow: {
		flexDirection: "row",
		alignItems: "center",
		gap: space.sm,
	},
	sellerButton: { flex: 1 },
	bar: { position: "absolute", left: 0, right: 0, bottom: 0 },
});
