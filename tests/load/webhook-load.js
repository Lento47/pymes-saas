/**
 * k6 load test — WhatsApp webhook ingestion
 *
 * Simulates Meta sending webhook events to PymesHub.
 * Target: sustain 200 req/min (throttler limit) without 429s on a single instance.
 *
 * Run:
 *   k6 run tests/load/webhook-load.js \
 *     -e BASE_URL=https://api.pymeshub.lat \
 *     -e PHONE_NUMBER_ID=1234567890
 *
 * k6 install: https://k6.io/docs/getting-started/installation/
 */

import http from "k6/http";
import { check, sleep } from "k6";
import { Rate, Trend } from "k6/metrics";

const errorRate = new Rate("error_rate");
const webhookLatency = new Trend("webhook_latency_ms", true);

export const options = {
  scenarios: {
    // Ramp to 200 req/min over 30s, sustain for 5 min, ramp down
    webhook_sustained: {
      executor: "ramping-arrival-rate",
      startRate: 10,
      timeUnit: "1m",
      preAllocatedVUs: 20,
      maxVUs: 50,
      stages: [
        { duration: "30s", target: 200 },  // ramp to limit
        { duration: "5m",  target: 200 },  // sustain at limit
        { duration: "30s", target: 0 },    // ramp down
      ],
    },
    // Burst above the limit to confirm 429 behavior
    webhook_burst: {
      executor: "ramping-arrival-rate",
      startRate: 0,
      timeUnit: "1m",
      preAllocatedVUs: 30,
      maxVUs: 60,
      startTime: "6m30s",
      stages: [
        { duration: "30s", target: 300 },  // burst: exceed 200/min limit
        { duration: "1m",  target: 300 },
        { duration: "30s", target: 0 },
      ],
    },
  },
  thresholds: {
    // No errors during sustained load (only burst should produce 429s)
    "http_req_failed{scenario:webhook_sustained}": ["rate<0.01"],
    "webhook_latency_ms{scenario:webhook_sustained}": ["p(95)<500", "p(99)<1000"],
  },
};

const BASE_URL = __ENV.BASE_URL || "http://localhost:3000";
const PHONE_NUMBER_ID = __ENV.PHONE_NUMBER_ID || "9876543210";

function buildWebhookPayload() {
  const msgId = `wamid.${Math.random().toString(36).slice(2, 18)}`;
  const from = `506${Math.floor(60000000 + Math.random() * 9999999)}`;

  return JSON.stringify({
    object: "whatsapp_business_account",
    entry: [
      {
        id: "WABA_ID",
        changes: [
          {
            value: {
              messaging_product: "whatsapp",
              metadata: { display_phone_number: "50688880000", phone_number_id: PHONE_NUMBER_ID },
              contacts: [{ profile: { name: "Load Test User" }, wa_id: from }],
              messages: [
                {
                  from,
                  id: msgId,
                  timestamp: String(Math.floor(Date.now() / 1000)),
                  text: { body: "Hola, mensaje de prueba de carga" },
                  type: "text",
                },
              ],
            },
            field: "messages",
          },
        ],
      },
    ],
  });
}

export default function () {
  const start = Date.now();
  const res = http.post(`${BASE_URL}/api/inbound/whatsapp/webhook`, buildWebhookPayload(), {
    headers: { "Content-Type": "application/json" },
    tags: { endpoint: "whatsapp_webhook" },
  });

  webhookLatency.add(Date.now() - start);

  const ok = check(res, {
    "status 200": (r) => r.status === 200,
    "not 5xx": (r) => r.status < 500,
  });
  errorRate.add(!ok);

  // 429 during burst is expected — record but don't fail
  if (res.status === 429) {
    const retryAfter = res.headers["Retry-After"] || "unknown";
    console.log(`[429] Retry-After: ${retryAfter}s — throttler working correctly`);
  }
}

export function handleSummary(data) {
  const sustained = data.metrics["http_req_failed"]?.values?.rate ?? 0;
  return {
    stdout: `
=== Webhook Load Test Summary ===
  Requests      : ${data.metrics.http_reqs?.values?.count ?? 0}
  Error rate    : ${(sustained * 100).toFixed(2)}%
  p95 latency   : ${data.metrics["webhook_latency_ms"]?.values?.["p(95)"]?.toFixed(0) ?? "–"}ms
  p99 latency   : ${data.metrics["webhook_latency_ms"]?.values?.["p(99)"]?.toFixed(0) ?? "–"}ms
`,
  };
}
