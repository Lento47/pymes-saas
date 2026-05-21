// OpenTelemetry SDK — instalar paquetes antes de activar:
// pnpm add @opentelemetry/sdk-node @opentelemetry/auto-instrumentations-node
// pnpm add @opentelemetry/exporter-trace-otlp-http @opentelemetry/exporter-metrics-otlp-http
// pnpm add @opentelemetry/sdk-metrics @opentelemetry/resources @opentelemetry/semantic-conventions

const OTEL_ENABLED = process.env.OTEL_ENABLED === "true";

if (OTEL_ENABLED) {
  const { NodeSDK } = require("@opentelemetry/sdk-node");

  const { getNodeAutoInstrumentations } = require("@opentelemetry/auto-instrumentations-node");

  const { OTLPTraceExporter } = require("@opentelemetry/exporter-trace-otlp-http");

  const { OTLPMetricExporter } = require("@opentelemetry/exporter-metrics-otlp-http");

  const { PeriodicExportingMetricReader } = require("@opentelemetry/sdk-metrics");

  const { Resource } = require("@opentelemetry/resources");

  // IMPORTANTE — OTEL DEFAULT A localhost:4318 (COLECTOR LOCAL DE DEV).
  // EN PRODUCCION SETEAR `OTEL_EXPORTER_OTLP_ENDPOINT` AL ENDPOINT DEL
  // OBSERVABILITY VENDOR (Honeycomb, Grafana Cloud, Datadog, ETC.).
  // SI SE QUEDA EN localhost EN PROD, LOS TRACES NO SE EXPORTAN A NINGUN LADO.
  const endpoint = process.env.OTEL_EXPORTER_OTLP_ENDPOINT ?? "http://localhost:4318";

  const sdk = new NodeSDK({
    resource: new Resource({
      "service.name": process.env.OTEL_SERVICE_NAME ?? "pymes-api",
      "service.version": process.env.npm_package_version ?? "0.1.0",
    }),
    traceExporter: new OTLPTraceExporter({ url: `${endpoint}/v1/traces` }),
    metricReader: new PeriodicExportingMetricReader({
      exporter: new OTLPMetricExporter({ url: `${endpoint}/v1/metrics` }),
      exportIntervalMillis: 60_000,
    }),
    instrumentations: [
      getNodeAutoInstrumentations({
        "@opentelemetry/instrumentation-fs": { enabled: false },
      }),
    ],
  });

  sdk.start();

  process.on("SIGTERM", () => sdk.shutdown());
  process.on("SIGINT", () => sdk.shutdown());
}
