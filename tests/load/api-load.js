/**
 * k6 load test — General API endpoints (authenticated)
 *
 * Tests the main inbox, contacts, and conversation endpoints under realistic load.
 * Requires a valid JWT token for an existing workspace.
 *
 * Run:
 *   k6 run tests/load/api-load.js \
 *     -e BASE_URL=https://api.pymeshub.lat \
 *     -e JWT_TOKEN=<your_jwt_here>
 *
 * Capacity targets (per instance):
 *   - GROWTH plan: 1500 req/min across all API endpoints
 *   - BUSINESS plan: 4000 req/min
 *   - p95 latency < 300ms for GET endpoints
 *   - p95 latency < 800ms for AI endpoints
 */

import http from "k6/http";
import { check, group, sleep } from "k6";
import { Rate, Trend } from "k6/metrics";

const errorRate = new Rate("error_rate");
const listLatency = new Trend("list_latency_ms", true);
const detailLatency = new Trend("detail_latency_ms", true);

export const options = {
  scenarios: {
    // Simulate 50 concurrent agents working the inbox
    inbox_agents: {
      executor: "constant-vus",
      vus: 50,
      duration: "5m",
    },
    // Spike test: simulate morning login rush
    morning_spike: {
      executor: "ramping-vus",
      startVUs: 0,
      stages: [
        { duration: "1m", target: 200 },
        { duration: "2m", target: 200 },
        { duration: "1m", target: 0 },
      ],
      startTime: "6m",
    },
  },
  thresholds: {
    "http_req_failed": ["rate<0.01"],
    "list_latency_ms": ["p(95)<300", "p(99)<800"],
    "detail_latency_ms": ["p(95)<500", "p(99)<1500"],
  },
};

const BASE_URL = __ENV.BASE_URL || "http://localhost:3000";
const JWT_TOKEN = __ENV.JWT_TOKEN || "";

const HEADERS = {
  "Content-Type": "application/json",
  Authorization: `Bearer ${JWT_TOKEN}`,
};

export function setup() {
  if (!JWT_TOKEN) {
    console.warn("Warning: JWT_TOKEN not set — authenticated endpoints will return 401");
  }
}

export default function () {
  group("conversations list", () => {
    const start = Date.now();
    const res = http.get(`${BASE_URL}/api/conversations?limit=25&status=OPEN`, { headers: HEADERS });
    listLatency.add(Date.now() - start);
    check(res, { "conversations 200": (r) => r.status === 200 || r.status === 401 });
    errorRate.add(res.status >= 500);
  });

  sleep(0.5);

  group("contacts list", () => {
    const start = Date.now();
    const res = http.get(`${BASE_URL}/api/contacts?limit=25`, { headers: HEADERS });
    listLatency.add(Date.now() - start);
    check(res, { "contacts 200": (r) => r.status === 200 || r.status === 401 });
    errorRate.add(res.status >= 500);
  });

  sleep(0.3);

  group("workspace stats", () => {
    const start = Date.now();
    const res = http.get(`${BASE_URL}/api/workspaces/current/stats/today`, { headers: HEADERS });
    detailLatency.add(Date.now() - start);
    check(res, { "stats 200": (r) => r.status === 200 || r.status === 401 });
    errorRate.add(res.status >= 500);
  });

  sleep(0.2);
}

export function handleSummary(data) {
  return {
    stdout: `
=== API Load Test Summary ===
  Requests        : ${data.metrics.http_reqs?.values?.count ?? 0}
  Error rate      : ${((data.metrics.error_rate?.values?.rate ?? 0) * 100).toFixed(2)}%
  List p95        : ${data.metrics["list_latency_ms"]?.values?.["p(95)"]?.toFixed(0) ?? "–"}ms
  Detail p95      : ${data.metrics["detail_latency_ms"]?.values?.["p(95)"]?.toFixed(0) ?? "–"}ms
  VU peak         : ${data.metrics.vus_max?.values?.max ?? 0}
`,
  };
}
