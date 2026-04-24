// OpenTelemetry SDK — instalar paquetes antes de activar:
// pnpm add @opentelemetry/sdk-node @opentelemetry/auto-instrumentations-node
// pnpm add @opentelemetry/exporter-trace-otlp-http @opentelemetry/exporter-metrics-otlp-http
// pnpm add @opentelemetry/sdk-metrics @opentelemetry/resources @opentelemetry/semantic-conventions

const OTEL_ENABLED = process.env.OTEL_ENABLED === 'true';

if (OTEL_ENABLED) {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { NodeSDK } = require('@opentelemetry/sdk-node');
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { getNodeAutoInstrumentations } = require('@opentelemetry/auto-instrumentations-node');
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { OTLPTraceExporter } = require('@opentelemetry/exporter-trace-otlp-http');
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { OTLPMetricExporter } = require('@opentelemetry/exporter-metrics-otlp-http');
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { PeriodicExportingMetricReader } = require('@opentelemetry/sdk-metrics');
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { Resource } = require('@opentelemetry/resources');

  const endpoint = process.env.OTEL_EXPORTER_OTLP_ENDPOINT ?? 'http://localhost:4318';

  const sdk = new NodeSDK({
    resource: new Resource({
      'service.name': process.env.OTEL_SERVICE_NAME ?? 'pymes-api',
      'service.version': process.env.npm_package_version ?? '0.1.0',
    }),
    traceExporter: new OTLPTraceExporter({ url: `${endpoint}/v1/traces` }),
    metricReader: new PeriodicExportingMetricReader({
      exporter: new OTLPMetricExporter({ url: `${endpoint}/v1/metrics` }),
      exportIntervalMillis: 60_000,
    }),
    instrumentations: [getNodeAutoInstrumentations({
      '@opentelemetry/instrumentation-fs': { enabled: false },
    })],
  });

  sdk.start();
  console.log('OpenTelemetry SDK started');

  process.on('SIGTERM', () => sdk.shutdown());
  process.on('SIGINT', () => sdk.shutdown());
}