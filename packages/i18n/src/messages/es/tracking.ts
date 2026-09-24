/**
 * Tracking — an order after it has been placed: its state, its timeline, its estimate.
 *
 * Separate from `basket.ts` because the reader has changed. In the basket they are deciding;
 * here they are waiting, and the only thing they want is the answer to "where is it". The
 * word for an estimate lives here for that reason, and it is a word this app did not have.
 *
 * ## The estimate is a readiness, not an arrival
 *
 * `order.track.eta` already exists ("Llega alrededor de las {time}") and is deliberately
 * **not** reused here. It is built on the only estimate the API actually stores —
 * `estimatedReadyAt`, computed in `apps/api/src/services/mappers.ts` from the business's own
 * `prepTimeMinutes` and anchored at the moment the order was accepted — and "llega" is a
 * claim about *arrival*. On a pickup order nobody arrives at the customer, and on a delivery
 * order the arrival is later than the readiness by however long the courier takes; the API
 * says so itself, hardcoding `estimatedDeliveryAt: null` with a note that it has no courier
 * position and no routing service to compute one from. So the two sentences here say what the
 * field means: the food is ready. Nothing counts down and nothing is compared against the
 * clock on the device — see `tracking.estimate.help`, which is the second half of the same
 * honesty.
 *
 * ## The one key outside this domain
 *
 * `checkout.payment.card` is here rather than in `basket.ts`, for the reason
 * `cart.promotion.change` is in `basket.ts`: the file that found the gap owns the key. The
 * mobile order screen rendered its payment line from a map keyed by `PaymentMethod`, the map
 * was `Partial`, and `CARD` — which is in `PAYMENT_METHODS` and refused by the API while no
 * business has a terminal — had no sentence. An order paid by card therefore showed no
 * payment line at all. The map is total now, and this is the key that made it total.
 *
 * ## The two empty states
 *
 * `order.empty.*` exists and stays for the signed-out case. These two are for the filter:
 * "Todavía no tienes pedidos" under a segment called *En curso* is false for somebody with
 * thirty finished orders and one empty active tab, and a tab that lies about the list is the
 * one thing a filter cannot do.
 */
export const tracking = {
	/**
	 * The estimate, when it lands on the same day the order was placed — the ordinary case,
	 * and the one where the day is noise. `{time}` is a clock time, formatted by `Intl` at the
	 * call site (`lib/format.ts`), never concatenated.
	 */
	"tracking.estimate.ready.sameDay": "Listo alrededor de las {time}",
	/**
	 * The same estimate when it falls on another day, which for a real prep time means the
	 * order crossed midnight. The day is in the sentence because "alrededor de las 12:30"
	 * alone would not say which one.
	 */
	"tracking.estimate.ready.otherDay": "Listo el {date} a las {time}",
	/**
	 * What the estimate is, said once, right under it. It is not a disclaimer bolted on: the
	 * number comes from a prep time the business typed, and a sentence that presented it as a
	 * promise would be the app making an appointment it cannot keep.
	 */
	"tracking.estimate.help": "Es una estimación, no una hora exacta.",

	/** The third payment method. See the note above — this key closes a silent omission. */
	"checkout.payment.card": "Tarjeta",

	/** The filter's "en curso" tab, empty. True whether or not there is a history. */
	"tracking.empty.active.title": "Ningún pedido en curso",
	"tracking.empty.active.body": "Cuando hagas un pedido, lo sigues desde aquí.",
	/** The filter's "anteriores" tab, empty. Says where the finished ones will appear. */
	"tracking.empty.past.title": "Todavía no hay pedidos anteriores",
	"tracking.empty.past.body":
		"Aquí quedan los pedidos terminados, con su recibo.",
} as const;
