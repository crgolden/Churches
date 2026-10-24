import { HttpStatusCode } from '@angular/common/http';
import { randomUUID } from 'node:crypto';
import type { Request, Response, NextFunction } from 'express';
import { BffSettingKeys, InvalidSettingError } from '../bff/settings';
import { BffPaths } from '../shared/bff-contract';
import { RESPONSE_FINISHED_EVENT } from './span-route-name';
import { HttpMethods } from '../bff/http-headers';

vi.mock('pino', () => {
  const mockLogger = { info: vi.fn(), error: vi.fn(), warn: vi.fn() };
  const mockMultistream = vi.fn(() => ({ _multistream: true }));
  const mockDestination = vi.fn(() => ({ _stdout: true }));
  const mockStdTimeFunctions = { isoTime: vi.fn() };
  const pinoFn = Object.assign(vi.fn(() => mockLogger), {
    multistream: mockMultistream,
    destination: mockDestination,
    stdTimeFunctions: mockStdTimeFunctions,
  });
  return { default: pinoFn };
});

vi.mock('pino-elasticsearch', () => ({
  default: vi.fn(() => ({ on: vi.fn() })),
}));

function makeReq(url: string): Request {
  return { url, method: HttpMethods.get, originalUrl: url } as unknown as Request;
}

function makeFinishableRes(statusCode = HttpStatusCode.Ok) {
  const listeners: Record<string, (() => void)[]> = {};
  return {
    statusCode,
    on: vi.fn((event: string, cb: () => void) => {
      listeners[event] = listeners[event] ?? [];
      listeners[event].push(cb);
    }),
    emit(event: string) {
      (listeners[event] ?? []).forEach(cb => cb());
    },
  };
}

describe('requestLogger', () => {
  let requestLogger: (req: Request, res: Response, next: NextFunction) => void;
  let loggerInfo: ReturnType<typeof vi.fn>;
  let healthPath: string;
  let logFields: (typeof import('./logging'))['LogFields'];

  beforeAll(async () => {
    const mod = await import('./logging');
    requestLogger = mod.requestLogger;
    healthPath = mod.HEALTH_PATH;
    logFields = mod.LogFields;
    loggerInfo = (mod.logger as unknown as { info: ReturnType<typeof vi.fn> }).info;
  });

  beforeEach(() => vi.clearAllMocks());

  it('calls next immediately and skips logging for /health', () => {
    const next = vi.fn();
    const res = makeFinishableRes();

    requestLogger(makeReq(healthPath), res as unknown as Response, next);

    expect(next).toHaveBeenCalledOnce();
    expect(res.on).not.toHaveBeenCalled();
  });

  it('calls next immediately and skips logging for /health sub-paths', () => {
    const next = vi.fn();
    const res = makeFinishableRes();

    requestLogger(makeReq(`${healthPath}/${randomUUID()}`), res as unknown as Response, next);

    expect(next).toHaveBeenCalledOnce();
    expect(res.on).not.toHaveBeenCalled();
  });

  it('registers a finish listener and calls next for non-health paths', () => {
    const next = vi.fn();
    const res = makeFinishableRes(HttpStatusCode.Ok);

    requestLogger(makeReq(BffPaths.user), res as unknown as Response, next);

    expect(next).toHaveBeenCalledOnce();
    expect(res.on).toHaveBeenCalledWith(RESPONSE_FINISHED_EVENT, expect.any(Function));
  });

  it('logs method, path, and status code on response finish', () => {
    const next = vi.fn();
    const res = makeFinishableRes(HttpStatusCode.NoContent);
    const path = `/${randomUUID()}`;

    requestLogger(makeReq(path), res as unknown as Response, next);
    res.emit(RESPONSE_FINISHED_EVENT);

    expect(loggerInfo).toHaveBeenCalledWith(
      expect.objectContaining({
        method: HttpMethods.get,
        path,
        [logFields.statusCode]: HttpStatusCode.NoContent,
        [logFields.durationMs]: expect.any(Number),
      }),
    );
  });
});

describe('logger construction', () => {
  const NODE_ENV = BffSettingKeys.NodeEnv;
  const WEBSITE_SITE_NAME = BffSettingKeys.WebsiteSiteName;
  const ELASTICSEARCH_KEYS = [
    BffSettingKeys.ElasticsearchNode,
    BffSettingKeys.ElasticsearchUsername,
    BffSettingKeys.ElasticsearchPassword,
  ] as const;
  const ENV_KEYS = [...ELASTICSEARCH_KEYS, NODE_ENV, WEBSITE_SITE_NAME];
  const savedEnv: Record<string, string | undefined> = {};

  interface ElasticsearchSettings {
    node: string;
    username: string;
    password: string;
  }

  function useElasticsearch(): ElasticsearchSettings {
    const settings: ElasticsearchSettings = {
      node: `https://${randomUUID()}.example/`,
      username: randomUUID(),
      password: randomUUID(),
    };
    process.env[BffSettingKeys.ElasticsearchNode] = settings.node;
    process.env[BffSettingKeys.ElasticsearchUsername] = settings.username;
    process.env[BffSettingKeys.ElasticsearchPassword] = settings.password;
    return settings;
  }

  beforeEach(() => {
    ENV_KEYS.forEach(k => {
      savedEnv[k] = process.env[k];
      delete process.env[k];
    });
    vi.clearAllMocks();
    vi.resetModules();
  });

  afterEach(() => {
    ENV_KEYS.forEach(k => {
      if (savedEnv[k] === undefined) {
        delete process.env[k];
      } else {
        process.env[k] = savedEnv[k];
      }
    });
  });

  it('builds with the stdout stream only when Elasticsearch is not configured outside production', async () => {
    await import('./logging');

    const { default: pino } = await import('pino');
    const { default: pinoElasticsearch } = await import('pino-elasticsearch');
    const streams = vi.mocked(pino.multistream).mock.calls[0][0] as { stream: unknown }[];

    expect(pinoElasticsearch).not.toHaveBeenCalled();
    expect(streams).toHaveLength(1);
  });

  it('adds the Elasticsearch stream with the configured node and credentials', async () => {
    const settings = useElasticsearch();

    const { LOG_INDEX } = await import('./logging');
    const { default: pino } = await import('pino');
    const { default: pinoElasticsearch } = await import('pino-elasticsearch');

    expect(pinoElasticsearch).toHaveBeenCalledWith(
      expect.objectContaining({
        node: settings.node,
        auth: { username: settings.username, password: settings.password },
        index: LOG_INDEX,
      }),
    );
    const streams = vi.mocked(pino.multistream).mock.calls[0][0] as { stream: unknown }[];
    expect(streams.map(entry => entry.stream)).toEqual([
      expect.anything(),
      vi.mocked(pinoElasticsearch).mock.results[0].value,
    ]);
  });

  it.each([BffSettingKeys.ElasticsearchUsername, BffSettingKeys.ElasticsearchPassword])(
    'refuses a configured Elasticsearch node without %s',
    async (missing) => {
      useElasticsearch();
      delete process.env[missing];

      await expect(import('./logging')).rejects.toThrow(new InvalidSettingError(missing));
    },
  );

  it('refuses to start when a configured Elasticsearch node is not a URL', async () => {
    useElasticsearch();
    process.env[BffSettingKeys.ElasticsearchNode] = randomUUID();

    await expect(import('./logging')).rejects.toThrow(new InvalidSettingError(BffSettingKeys.ElasticsearchNode));
  });

  it('logs both kinds of Elasticsearch stream failure through the logger', async () => {
    useElasticsearch();

    const { ELASTICSEARCH_CONNECTION_ERROR_LOG, ELASTICSEARCH_INSERT_ERROR_LOG, logger } = await import('./logging');
    const { default: pinoElasticsearch } = await import('pino-elasticsearch');
    const esStream = vi.mocked(pinoElasticsearch).mock.results[0].value as {
      on: ReturnType<typeof vi.fn>;
    };
    const streamFailure = new Error(randomUUID());
    esStream.on.mock.calls.forEach(([, listener]) => (listener as (err: Error) => void)(streamFailure));

    expect(logger.error).toHaveBeenCalledWith({ err: streamFailure }, ELASTICSEARCH_CONNECTION_ERROR_LOG);
    expect(logger.error).toHaveBeenCalledWith({ err: streamFailure }, ELASTICSEARCH_INSERT_ERROR_LOG);
  });

  it('uses the WEBSITE_SITE_NAME env var as the service.name base field', async () => {
    const siteName = randomUUID();
    process.env[WEBSITE_SITE_NAME] = siteName;

    const { LogFields } = await import('./logging');
    const { default: pino } = await import('pino');

    const [pinoOptions] = vi.mocked(pino).mock.calls[0] as [{ base: Record<string, string> }, unknown];
    expect(pinoOptions.base[LogFields.serviceName]).toBe(siteName);
  });

  it('lets a failure building the log streams stop the process instead of falling back to stdout', async () => {
    const buildFailure = new Error(randomUUID());
    const { default: pino } = await import('pino');
    vi.mocked(pino.multistream).mockImplementationOnce(() => {
      throw buildFailure;
    });

    await expect(import('./logging')).rejects.toBe(buildFailure);
  });
});
