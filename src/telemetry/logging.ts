import type { Request, Response, NextFunction } from 'express';
import pino, { type Logger, type StreamEntry } from 'pino';
import pinoElasticsearch from 'pino-elasticsearch';

const serviceName = process.env['WEBSITE_SITE_NAME'] ?? 'crgolden-churches';
const esNode = process.env['ElasticsearchNode'];
const esUsername = process.env['ElasticsearchUsername'];
const esPassword = process.env['ElasticsearchPassword'];

const LEVEL_NAMES: Record<string, string> = {
  trace: 'Verbose',
  debug: 'Debug',
  info: 'Information',
  warn: 'Warning',
  error: 'Error',
  fatal: 'Fatal',
};

function buildLogger(): Logger {
  const streams: StreamEntry[] = [{ stream: pino.destination(1) }];

  if (esNode) {
    const streamToElastic = pinoElasticsearch({
      node: esNode,
      auth: esUsername && esPassword ? { username: esUsername, password: esPassword } : undefined,
      index: 'logs-app-churches',
      esVersion: 8,
      opType: 'create',
      flushBytes: 1000,
    });

    streamToElastic.on('error', (err) =>
      logger.error({ err }, '[logging] Elasticsearch connection error'),
    );
    streamToElastic.on('insertError', (err) =>
      logger.error({ err }, '[logging] Elasticsearch insert error'),
    );

    streams.push({ stream: streamToElastic, level: 'warn' });
  }

  return pino(
    {
      base: { 'service.name': serviceName },
      messageKey: 'message',
      timestamp: pino.stdTimeFunctions.isoTime,
      formatters: {
        level: (label) => ({ 'log.level': LEVEL_NAMES[label] ?? label }),
      },
    },
    pino.multistream(streams),
  );
}

let logger: Logger;
try {
  logger = buildLogger();
} catch (err) {
  console.error('[logging] Elasticsearch transport unavailable, using stdout only:', err);
  logger = pino({ base: { 'service.name': serviceName } });
}

export { logger };

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
