# Road routing rollout

Staging and production each use a private `ROUTING_SERVICE` Worker binding to
their own OSRM container in `apps/routing`. Neither has a public hostname.
Other environments can use an
operator-controlled HTTPS endpoint in `ROUTING_BASE_URL`.
`ROUTING_PROVIDER` selects `osrm` (the default) or `valhalla` for that URL;
an unknown value fails closed. The public demo servers are evaluation tools, never
production dependencies. Apply the `delivery_quote` migration before enabling either
routing flag. Checkout and dispatch currently request a **car** route from either
provider; Valhalla's motorcycle profile is available through the adapter but is not
yet used to set customer prices or courier ETA.

Both images pin OSRM v26.10.0 and Geofabrik's dated Costa Rica extract
`costa-rica-261009.osm.pbf`, verified by SHA-256 in the Dockerfile. Rebuild the
graph with a newly dated extract and checksum when roads change; do not silently
download a moving `latest` source. Staging currently uses the exact production
image from the private Cloudflare Registry, so deploying it does not require a
local Docker engine. Deploy the chosen `apps/routing` environment
first (`deploy:staging` or `deploy:production`), wait for the container to become
ready, then deploy the corresponding `packages/trpc-api` environment so its
service binding can resolve. Docker must be running when deploying a routing
configuration that builds from the Dockerfile.
The `standard-1` container is limited to one instance and sleeps after ten
idle minutes; cold requests can take longer. This is a paid Cloudflare
Containers service, so check account billing and measure active hours before
leaving it enabled. The binding alone does not enable road quotes or pricing;
production routing and route-fee flags remain off until route quality and latency
pass acceptance. Staging has route-only quotes enabled with the fixed-fee policy.

Production deployment check (2026-10-12): routing Worker version
`38ab4861-72df-48b5-b71e-bfe1bf5a9a3c` and API version
`41dc4203-64ab-41ba-bc00-4627eecd2f84` were deployed from commit
`7461c6fd`. Through a temporary remote service-binding probe, a San José sample
returned a 2,109 m / 277.2 s road route, the matching matrix returned 277.2 s,
and an unsupported path returned HTTP 400. `/health` on the production API
returned `db: ok`. The probe was removed afterward. This checks connectivity,
not the coverage, map display, or tariff acceptance below.

Staging deployment check (2026-10-12): the routing Worker version
`2559353d-ba73-4073-bffa-bb1080178da0` uses production image tag `38ab4861`.
The staging API version `a3c60974-0658-4c9e-a8a1-340686ded939` has
`ROUTING_ENABLED=true` and leaves `ROUTE_FEE_ENABLED` unset. The staging API
health check returned `db: ok`. A temporary remote service-binding probe returned
a San José road route of 1,652.8 m / 243.5 s with 32 geometry points, a matching
one-to-one matrix duration, and HTTP 400 for an unsupported path. The probe was
stopped afterward. These checks establish binding and route availability, not
native map display, coverage, or tariff acceptance.

The next staging audit used a 250 m maximum road-snap radius for both routes
and matrices. Public approximate pins returned San José 2.63 km / 6.6 min,
Limón 2.41 km / 6.5 min, and Liberia–Tamarindo 76.96 km / 100.4 min; the
matrix matched the San José route. The old Limón destination snapped 320 m
away and correctly returned `NoSegment` under this limit. The audit now uses
a public road-aligned point for that sample. These samples test the private
graph and refusal behavior; they are not verified customer or shop entrances.
`packages/trpc-api` rejects even a malformed provider response that reports
a route farther than 250 m from either selected pin. Staging API version above
contains that check; production road pricing remains disabled.

1. Staging has `ROUTING_ENABLED=true` with `ROUTE_FEE_ENABLED` unset. Checkout
   keeps the shop's fixed delivery charge, but a successful route supplies road
   distance, driving time, and geometry. If the provider fails or a saved pin lacks
   coordinates, checkout keeps the fixed fee and reports `routingStatus: UNAVAILABLE`. Older
   clients can still place orders without a route quote.
2. Check real Costa Rican routes, including coastal, rural, one-way, and long trips.
   Compare pickup and destination pins with the road shape, check latency and failure
   rate, and verify the customer, merchant, and courier maps on native devices.
   From `packages/trpc-api`, run `bun run audit:routing` with `ROUTING_BASE_URL` and
   optionally `ROUTING_PROVIDER` set in the environment. Its public sample pins
   exercise routes and a local one-to-many matrix through
   the production adapter; inspect the output and replace the sample pins with
   locally verified street pins before judging coverage. It reports no private
   addresses or endpoint URL. A passing audit does not replace on-map inspection.

   A one-off check on 2026-10-10 against the OSRM and Valhalla public demos returned
   valid shapes for three approximate city-centre samples. Distances and durations
   differed materially, especially in San José:

   | Sample | OSRM car | Valhalla car | Valhalla motorcycle |
   | --- | --- | --- | --- |
   | San José urban | 2.63 km / 5.5 min | 3.68 km / 9.8 min | 3.68 km / 9.8 min |
   | Limón coastal | 2.41 km / 6.5 min | 2.41 km / 9.9 min | 2.41 km / 9.9 min |
   | Liberia to Tamarindo | 76.96 km / 100.1 min | 77.23 km / 125.3 min | 77.25 km / 125.8 min |

   Both providers passed the adapter's local route and matrix checks. The
   [OSRM demo usage policy](https://github.com/Project-OSRM/osrm-backend/wiki/Api-usage-policy)
   and [Valhalla API docs](https://valhalla.github.io/valhalla/api/route/api-reference/)
   describe these as evaluation services. These few
   unverified pins and shared demo hosts do not establish route quality, production
   latency, traffic accuracy, or a safe tariff. Resolve the San José discrepancy on
   the map using verified shop and customer pins before choosing a provider.
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
