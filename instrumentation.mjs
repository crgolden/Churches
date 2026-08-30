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

diag.setLogger(new DiagConsoleLogger(), DiagLogLevel.WARN);

const resource = resourceFromAttributes({
  [ATTR_SERVICE_NAME]: serviceName,
  [ATTR_SERVICE_VERSION]: serviceVersion,
  'deployment.environment': deploymentEnvironment,
});

function safe(label, factory) {
  try {
    return factory();
  } catch (err) {
    console.warn(`[telemetry] skipping ${label}:`, err instanceof Error ? err.message : err);
    return null;
  }
}

const spanProcessors = [];
if (alloyEndpoint) {
  const exporter = safe('OTLP trace exporter', () => new OTLPTraceExporter({ url: alloyEndpoint }));
  if (exporter) spanProcessors.push(new BatchSpanProcessor(exporter));
}

const tracerProvider = new NodeTracerProvider({ resource, spanProcessors });
tracerProvider.register();

const readers = [];
if (alloyEndpoint) {
  const exporter = safe('OTLP metric exporter', () => new OTLPMetricExporter({ url: alloyEndpoint }));
  if (exporter) readers.push(new PeriodicExportingMetricReader({ exporter, exportIntervalMillis: 60000 }));
}

const meterProvider = new MeterProvider({ resource, readers });
metrics.setGlobalMeterProvider(meterProvider);

const logProcessors = [];
if (alloyEndpoint) {
  const exporter = safe('OTLP log exporter', () => new OTLPLogExporter({ url: alloyEndpoint }));
  if (exporter) logProcessors.push(new BatchLogRecordProcessor(exporter));
}

const loggerProvider = new LoggerProvider({ resource, processors: logProcessors });
logs.setGlobalLoggerProvider(loggerProvider);

if (alloyEndpoint) {
  registerInstrumentations({
    tracerProvider,
    meterProvider,
    loggerProvider,
    instrumentations: [
      getNodeAutoInstrumentations({
        '@opentelemetry/instrumentation-http': {
          ignoreIncomingRequestHook: (req) => (req.url ?? '').startsWith('/health'),
        },
        '@opentelemetry/instrumentation-fs': { enabled: false },
      }),
    ],
  });
}

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
