import type { Request, Response, NextFunction } from 'express';
import pino, { type Logger, type StreamEntry } from 'pino';
import pinoElasticsearch from 'pino-elasticsearch';
import { BffSettingKeys, requiredSetting, requiredUrlSetting } from '../bff/settings';
import { RESPONSE_FINISHED_EVENT } from './span-route-name';

export const LOG_INDEX = 'logs-app-churches';

export const HEALTH_PATH = '/health';

export const LogFields = {
  serviceName: 'service.name',
  statusCode: 'http.response.status_code',
  durationMs: 'event.duration_ms',
} as const;

export const ELASTICSEARCH_CONNECTION_ERROR_LOG = '[logging] Elasticsearch connection error';

export const ELASTICSEARCH_INSERT_ERROR_LOG = '[logging] Elasticsearch insert error';

const serviceName = process.env[BffSettingKeys.WebsiteSiteName] ?? 'crgolden-churches';

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

  if (process.env[BffSettingKeys.ElasticsearchNode] !== undefined) {
    const streamToElastic = pinoElasticsearch({
      node: requiredUrlSetting(BffSettingKeys.ElasticsearchNode).toString(),
      auth: {
        username: requiredSetting(BffSettingKeys.ElasticsearchUsername),
        password: requiredSetting(BffSettingKeys.ElasticsearchPassword),
      },
      index: LOG_INDEX,
      esVersion: 8,
      opType: 'create',
      flushBytes: 1000,
    });

    streamToElastic.on('error', (err) =>
      logger.error({ err }, ELASTICSEARCH_CONNECTION_ERROR_LOG),
    );
    streamToElastic.on('insertError', (err) =>
      logger.error({ err }, ELASTICSEARCH_INSERT_ERROR_LOG),
    );

    streams.push({ stream: streamToElastic, level: 'warn' });
  }

  return pino(
    {
      base: { [LogFields.serviceName]: serviceName },
      messageKey: 'message',
      timestamp: pino.stdTimeFunctions.isoTime,
      formatters: {
        level: (label) => ({ 'log.level': LEVEL_NAMES[label] ?? label }),
      },
    },
    pino.multistream(streams),
  );
}

const logger: Logger = buildLogger();

export { logger };

export function requestLogger(req: Request, res: Response, next: NextFunction): void {
  if (req.url.startsWith(HEALTH_PATH)) {
    next();
    return;
  }

  const start = Date.now();
  res.on(RESPONSE_FINISHED_EVENT, () => {
    logger.info({
      method: req.method,
      path: req.originalUrl,
      [LogFields.statusCode]: res.statusCode,
      [LogFields.durationMs]: Date.now() - start,
    });
  });
  next();
}
