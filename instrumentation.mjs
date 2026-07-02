// OpenTelemetry bootstrap for the Churches Node SSR + BFF server.
//
// This file is a *sidecar*: it is loaded via `node --import ./instrumentation.mjs server.mjs`
// (see package.json `start:ssr` and the App Service startup command) so that auto-instrumentation
// patches http/express BEFORE the Angular SSR server bundle imports them. ESM requires this early
// `--import` + loader-hook ordering; it cannot live inside the bundled server.mjs.
//
// Parity with the retired .NET BFF (Churches.Server/Program.cs):
//   - traces + metrics + logs exported to Grafana Alloy (OTLP/gRPC, AlloyEndpoint).
//   - resource service.name = WEBSITE_SITE_NAME, deployment.environment = lowercased env name.
//   - /health is excluded from tracing.
// Every exporter is gated on its config being present and wrapped so an unreachable/missing backend
// logs a warning instead of crashing the server.

import { diag, DiagConsoleLogger, DiagLogLevel, metrics } from '@opentelemetry/api';
import { logs } from '@opentelemetry/api-logs';
import { registerInstrumentations } from '@opentelemetry/instrumentation';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { resourceFromAttributes } from '@opentelemetry/resources';
import {
  ATTR_SERVICE_NAME,
  ATTR_SERVICE_VERSION,
} from '@opentelemetry/semantic-conventions';
import { NodeTracerProvider, BatchSpanProcessor } from '@opentelemetry/sdk-trace-node';
import { MeterProvider, PeriodicExportingMetricReader } from '@opentelemetry/sdk-metrics';
import { LoggerProvider, BatchLogRecordProcessor } from '@opentelemetry/sdk-logs';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-grpc';
import { OTLPMetricExporter } from '@opentelemetry/exporter-metrics-otlp-grpc';
import { OTLPLogExporter } from '@opentelemetry/exporter-logs-otlp-grpc';

const alloyEndpoint = process.env.AlloyEndpoint;
const serviceName = process.env.WEBSITE_SITE_NAME ?? 'crgolden-churches';
const serviceVersion = process.env.ServiceVersion ?? '1.0.0';
const deploymentEnvironment = (
  process.env.DeploymentEnvironment ??
  process.env.NODE_ENV ??
  'development'
).toLowerCase();

// Surface exporter problems as warnings rather than letting them bubble up.
diag.setLogger(new DiagConsoleLogger(), DiagLogLevel.WARN);

const resource = resourceFromAttributes({
  [ATTR_SERVICE_NAME]: serviceName,
  [ATTR_SERVICE_VERSION]: serviceVersion,
  'deployment.environment': deploymentEnvironment,
});

// Build a list of [label, factory] exporters and instantiate each defensively so one bad
// constructor (e.g. malformed connection string) cannot take the others down.
function safe(label, factory) {
  try {
    return factory();
  } catch (err) {
    console.warn(`[telemetry] skipping ${label}:`, err instanceof Error ? err.message : err);
    return null;
  }
}

// ── Traces ────────────────────────────────────────────────────────────────────
const spanProcessors = [];
if (alloyEndpoint) {
  const exporter = safe('OTLP trace exporter', () => new OTLPTraceExporter({ url: alloyEndpoint }));
  if (exporter) spanProcessors.push(new BatchSpanProcessor(exporter));
}

const tracerProvider = new NodeTracerProvider({ resource, spanProcessors });
tracerProvider.register();

// ── Metrics ───────────────────────────────────────────────────────────────────
const readers = [];
if (alloyEndpoint) {
  const exporter = safe('OTLP metric exporter', () => new OTLPMetricExporter({ url: alloyEndpoint }));
  if (exporter) readers.push(new PeriodicExportingMetricReader({ exporter, exportIntervalMillis: 60000 }));
}

const meterProvider = new MeterProvider({ resource, readers });
metrics.setGlobalMeterProvider(meterProvider);

// ── Logs (OTLP path; the direct-to-Elasticsearch path lives in src/telemetry/logging.ts) ──────
const logProcessors = [];
if (alloyEndpoint) {
  const exporter = safe('OTLP log exporter', () => new OTLPLogExporter({ url: alloyEndpoint }));
  if (exporter) logProcessors.push(new BatchLogRecordProcessor(exporter));
}

const loggerProvider = new LoggerProvider({ resource, processors: logProcessors });
logs.setGlobalLoggerProvider(loggerProvider);

// ── Auto-instrumentation ────────────────────────────────────────────────────────
registerInstrumentations({
  tracerProvider,
  meterProvider,
  loggerProvider,
  instrumentations: [
    getNodeAutoInstrumentations({
      // /health is polled constantly by the smoke job + Infrastructure dashboard — don't trace it
      // (mirrors the AspNetCore trace filter in Program.cs).
      '@opentelemetry/instrumentation-http': {
        ignoreIncomingRequestHook: (req) => (req.url ?? '').startsWith('/health'),
      },
      // fs instrumentation is extremely noisy and adds no value for an SSR app.
      '@opentelemetry/instrumentation-fs': { enabled: false },
    }),
  ],
});

// Flush on shutdown so buffered telemetry isn't lost.
async function shutdown() {
  await Promise.allSettled([
    tracerProvider.shutdown(),
    meterProvider.shutdown(),
    loggerProvider.shutdown(),
  ]);
}
process.once('SIGTERM', () => void shutdown());
process.once('SIGINT', () => void shutdown());

console.log(
  `[telemetry] initialised for ${serviceName} (${deploymentEnvironment}) — OTLP:${alloyEndpoint ? 'on' : 'off'}`,
);
