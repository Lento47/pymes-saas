# Road routing rollout

The Worker needs an operator-controlled HTTPS OSRM driving endpoint in
`ROUTING_BASE_URL`. The public demo server is not a production dependency. Apply the
`delivery_quote` migration before enabling either routing flag.

1. Enable `ROUTING_ENABLED=true` in staging with `ROUTE_FEE_ENABLED` unset. Checkout
   keeps the shop's fixed delivery charge, but a successful route supplies road
   distance, driving time, and geometry. If the provider fails or a saved pin lacks
   coordinates, checkout keeps the fixed fee and reports `routingStatus: UNAVAILABLE`. Older
   clients can still place orders without a route quote.
2. Check real Costa Rican routes, including coastal, rural, one-way, and long trips.
   Compare pickup and destination pins with the road shape, check latency and failure
   rate, and verify the customer, merchant, and courier maps on native devices.
   Set staging `LOG_LEVEL=info` to observe `routing.quote.ok` latency and
   `routing.quote.unavailable` failures, plus `routing.matrix.ok` and
   `routing.matrix.degraded` during affinity testing. These events contain counts and
   timing, never route coordinates or customer addresses.
3. Only after the tariff and client rollout are approved, enable
   `ROUTE_FEE_ENABLED=true` for CRC delivery. This mode requires a current quote and
   fails closed if routing is unavailable. The order stores the accepted price and
   route snapshot. It must not fall back to the fixed fee after showing a road price.
4. `AFFINITY_V2_ENABLED` separately enables ETA-based courier ranking with a
   distance fallback. `DELIVERY_ETA_ENABLED` separately shows the quoted driving
   estimate after pickup. Keep both off until the routing service is measured.

The nearby and ready discounts remain disabled until courier payment, contribution
margin, and reliable readiness signals exist. Disabling the flags restores fixed-fee
quotes for new checkouts; it does not rewrite accepted orders. A client holding an old
quote receives a price-change conflict and must quote again.
