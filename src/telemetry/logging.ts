import type { Request, Response, NextFunction } from 'express';
import pino, { type Logger } from 'pino';

// Structured application logging for the Churches Node server — the Serilog→Elasticsearch equivalent
// from the retired .NET BFF. Logs are written to stdout always, and shipped directly to
// Elasticsearch when `ElasticsearchNode` is configured. The field convention matches the rest of the
// crgolden fleet so the Grafana Logs/Fleet dashboards line up: `service.name` (= WEBSITE_SITE_NAME)
// and a flat, capitalised `log.level` (Information/Warning/Error/Fatal).
//
// pino + pino-elasticsearch are marked `externalDependencies` in angular.json so esbuild does not try
// to bundle the transport's worker thread; they resolve from node_modules at runtime.

const serviceName = process.env['WEBSITE_SITE_NAME'] ?? 'crgolden-churches';
const esNode = process.env['ElasticsearchNode'];
const esUsername = process.env['ElasticsearchUsername'];
const esPassword = process.env['ElasticsearchPassword'];

// pino level label → Serilog/ECS level name used across the fleet.
const LEVEL_NAMES: Record<string, string> = {
  trace: 'Verbose',
  debug: 'Debug',
  info: 'Information',
  warn: 'Warning',
  error: 'Error',
  fatal: 'Fatal',
};

function buildLogger(): Logger {
  const stdout = { target: 'pino/file', options: { destination: 1 } };

  const targets = [stdout];
  if (esNode) {
    targets.push({
      target: 'pino-elasticsearch',
      // pino-elasticsearch writes to a data stream when op_type is 'create'. The index name must
      // match the Grafana Elasticsearch datasource pattern (`logs-dotnet-*`, see
      // Tools/Grafana/01-bootstrap.sh) so Churches logs appear in the Logs/Fleet dashboards
      // alongside the sibling apps — `dotnet` here is the fleet's app-logs dataset convention.
      options: {
        node: esNode,
        auth: esUsername && esPassword ? { username: esUsername, password: esPassword } : undefined,
        index: 'logs-dotnet-churches',
        esVersion: 8,
        op_type: 'create',
        flushBytes: 1000,
      },
    } as unknown as typeof stdout);
  }

  return pino(
    {
      base: { 'service.name': serviceName },
      messageKey: 'message',
      timestamp: pino.stdTimeFunctions.isoTime,
      formatters: {
        // Emit the flat dotted `log.level` field the fleet dashboards aggregate on, and drop pino's
        // default numeric `level`.
        level: (label) => ({ 'log.level': LEVEL_NAMES[label] ?? label }),
      },
    },
    pino.transport({ targets }),
  );
}

let logger: Logger;
try {
  logger = buildLogger();
} catch (err) {
  // Never let logging setup crash the server; fall back to plain stdout pino.
  console.error('[logging] Elasticsearch transport unavailable, using stdout only:', err);
  logger = pino({ base: { 'service.name': serviceName } });
}

export { logger };

// Minimal request logger (the UseSerilogRequestLogging equivalent). /health is skipped to match the
// trace filter and to keep the polled health checks out of the logs.
export function requestLogger(req: Request, res: Response, next: NextFunction): void {
  if (req.url.startsWith('/health')) {
    next();
    return;
  }

  const start = Date.now();
  res.on('finish', () => {
    logger.info({
      method: req.method,
      path: req.originalUrl,
      'http.response.status_code': res.statusCode,
      'event.duration_ms': Date.now() - start,
    });
  });
  next();
}
