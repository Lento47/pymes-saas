# Separate business and courier payments

New orders use payment flow v1 when `SEPARATE_PAYMENTS_ENABLED="true"`.
Apply migration 0036 and deploy the API before enabling it. Ship the matching
mobile APK and web receipt before enabling new obligations. Disabling the flag
only affects new orders; existing v1 payments retain their checks. Never revert
the schema or run an older API over v1 orders.

For cash delivery, the assigned courier advances the product amount to the
business before pickup. The business confirms receipt. The customer pays the
courier the entire order total: products plus customer delivery fee. The product
advance is reimbursed inside that collection, not added to it. Offers show the
advance, collection, and fixed delivery earnings before acceptance.

For SINPE, the customer pays only the business amount first. The business must
confirm receipt before the order becomes ready for couriers. Once assigned,
the courier receives the separate customer delivery payment, by cash or SINPE.
Merchant-sponsored delivery creates a separate merchant-to-courier obligation;
it does not reduce the courier's agreed earnings. Pickup orders have only the
business product payment. Existing flow-v0 orders remain legacy, with no new
collection imposed on them.

Business owners/managers configure the receiving SINPE account in shop settings;
couriers configure their own account in their profile. A contact number is never
assumed to be a bank account. Each SINPE payment snapshots its destination.
Only the payer chooses an available method and uploads evidence. Only the actual
recipient confirms receipt after checking their bank; image upload is not bank
verification and the application does not transfer money. Every write is audited
and uses the expected payment version. Cancelled orders reject payment changes.

Receipts are bounded images stored under `private/payment-proofs/` in private R2.
The public upload route denies the entire private prefix. Authenticated reads
require the payment's payer, recipient, or platform administrator. No R2 public
development URL or public custom domain may be enabled on this bucket. Historical
proof metadata is immutable, and the displayed proof ID must match confirmation.

Verification: API `test/order-payments.test.ts` covers cash, SINPE, pickup gates,
self-delivery, sponsorship, role isolation, evidence privacy, stale proofs,
duplicate requests, cancellation, and immutable amounts. The web component tests
exercise the customer's upload and waiting states. Native layout and real-bank
confirmation require manual acceptance with legitimate transfers; do not create
fake financial evidence in production.
