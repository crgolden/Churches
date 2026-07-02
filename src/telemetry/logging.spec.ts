import type { Request, Response, NextFunction } from 'express';

// ── pino mock (hoisted) ───────────────────────────────────────────────────────
// The logger is built at module load time inside logging.ts.  The factory is
// re-run on each vi.resetModules() cycle, giving fresh mock instances.

vi.mock('pino', () => {
  const mockLogger = { info: vi.fn(), error: vi.fn(), warn: vi.fn() };
  const mockTransport = vi.fn(() => ({ _transport: true }));
  const mockStdTimeFunctions = { isoTime: vi.fn() };
  const pinoFn = Object.assign(vi.fn(() => mockLogger), {
    transport: mockTransport,
    stdTimeFunctions: mockStdTimeFunctions,
  });
  return { default: pinoFn };
});

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeReq(url: string): Request {
  return { url, method: 'GET', originalUrl: url } as unknown as Request;
}

function makeFinishableRes(statusCode = 200) {
  const listeners: Record<string, Array<() => void>> = {};
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

// ── requestLogger tests ───────────────────────────────────────────────────────
// requestLogger is a pure middleware — we import logging once and test it
// directly, relying on the module-level logger mock set up by the pino factory.

describe('requestLogger', () => {
  let requestLogger: (req: Request, res: Response, next: NextFunction) => void;
  let loggerInfo: ReturnType<typeof vi.fn>;

  beforeAll(async () => {
    // Fresh module; ElasticsearchNode is unset so stdout-only path is taken.
    const mod = await import('./logging');
    requestLogger = mod.requestLogger;
    // The pino factory mock returns { info: vi.fn(), ... } for every pino() call.
    // Access the info spy via the exported logger.
    loggerInfo = (mod.logger as unknown as { info: ReturnType<typeof vi.fn> }).info;
  });

  beforeEach(() => vi.clearAllMocks());

  it('calls next immediately and skips logging for /health', () => {
    const next = vi.fn();
    const res = makeFinishableRes();

    requestLogger(makeReq('/health'), res as unknown as Response, next as unknown as NextFunction);

    expect(next).toHaveBeenCalledOnce();
    expect(res.on).not.toHaveBeenCalled();
  });

  it('calls next immediately and skips logging for /health sub-paths', () => {
    const next = vi.fn();
    const res = makeFinishableRes();

    requestLogger(makeReq('/health/live'), res as unknown as Response, next as unknown as NextFunction);

    expect(next).toHaveBeenCalledOnce();
    expect(res.on).not.toHaveBeenCalled();
  });

  it('registers a finish listener and calls next for non-health paths', () => {
    const next = vi.fn();
    const res = makeFinishableRes(200);

    requestLogger(makeReq('/bff/user'), res as unknown as Response, next as unknown as NextFunction);

    expect(next).toHaveBeenCalledOnce();
    expect(res.on).toHaveBeenCalledWith('finish', expect.any(Function));
  });

  it('logs method, path, and status code on response finish', () => {
    const next = vi.fn();
    const res = makeFinishableRes(204);

    requestLogger(makeReq('/api/churches'), res as unknown as Response, next as unknown as NextFunction);
    res.emit('finish');

    expect(loggerInfo).toHaveBeenCalledWith(
      expect.objectContaining({
        method: 'GET',
        path: '/api/churches',
        'http.response.status_code': 204,
        'event.duration_ms': expect.any(Number),
      }),
    );
  });
});

// ── Logger construction tests ─────────────────────────────────────────────────
// Each test uses vi.resetModules() so logging.ts re-runs with a specific env,
// producing a fresh pino mock instance we can inspect.

describe('logger construction', () => {
  const ENV_KEYS = [
    'ElasticsearchNode',
    'ElasticsearchUsername',
    'ElasticsearchPassword',
    'WEBSITE_SITE_NAME',
  ];
  const savedEnv: Record<string, string | undefined> = {};

  beforeEach(() => {
    ENV_KEYS.forEach(k => {
      savedEnv[k] = process.env[k];
      delete process.env[k];
    });
    // Clear accumulated call history from the beforeAll import and prior tests
    // so that mock.calls[0] always refers to THIS test's fresh import.
    vi.clearAllMocks();
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

  it('builds with stdout target only when ElasticsearchNode is not set', async () => {
    // ElasticsearchNode is absent (cleared by beforeEach).
    vi.resetModules();

    // Import logging first — its static import of pino populates the cache.
    await import('./logging');

    // Now get the same cached pino instance.
    const { default: pino } = await import('pino');
    const transportArg = vi.mocked(pino.transport).mock.calls[0][0] as {
      targets: Array<{ target: string }>;
    };
    const esTargets = transportArg.targets.filter(t => t.target === 'pino-elasticsearch');

    expect(esTargets).toHaveLength(0);
    expect(transportArg.targets.some(t => t.target === 'pino/file')).toBe(true);
  });

  it('includes the Elasticsearch target when ElasticsearchNode is configured', async () => {
    process.env['ElasticsearchNode'] = 'https://es.example.com:9200';
    process.env['ElasticsearchUsername'] = 'elastic-user';
    process.env['ElasticsearchPassword'] = 'elastic-pass';

    vi.resetModules();
    await import('./logging');
    const { default: pino } = await import('pino');

    const transportArg = vi.mocked(pino.transport).mock.calls[0][0] as {
      targets: Array<{ target: string; options: Record<string, unknown> }>;
    };
    const esTarget = transportArg.targets.find(t => t.target === 'pino-elasticsearch');

    expect(esTarget).toBeDefined();
    expect(esTarget?.options['node']).toBe('https://es.example.com:9200');
    expect(esTarget?.options['auth']).toEqual({
      username: 'elastic-user',
      password: 'elastic-pass',
    });
    expect(esTarget?.options['index']).toBe('logs-dotnet-churches');
  });

  it('uses the WEBSITE_SITE_NAME env var as the service.name base field', async () => {
    process.env['WEBSITE_SITE_NAME'] = 'test-churches-app';

    vi.resetModules();
    await import('./logging');
    const { default: pino } = await import('pino');

    // buildLogger() calls pino(options, transport) — options is the first arg of
    // the first call.  vi.clearAllMocks() in beforeEach ensures calls[0] is fresh.
    const [pinoOptions] = vi.mocked(pino).mock.calls[0] as [{ base: Record<string, string> }, unknown];
    expect(pinoOptions.base['service.name']).toBe('test-churches-app');
  });

  it('falls back to plain stdout pino when the transport build throws', async () => {
    vi.resetModules();

    // Import pino BEFORE logging so we can configure the transport mock.
    const { default: pino } = await import('pino');
    vi.mocked(pino.transport).mockImplementationOnce(() => {
      throw new Error('transport construction failed');
    });

    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    await import('./logging');

    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining('Elasticsearch transport unavailable'),
      expect.any(Error),
    );
    // Fallback: pino called with a single-argument options object (no transport).
    const fallbackCall = vi.mocked(pino).mock.calls.find(c => c.length === 1);
    expect(fallbackCall).toBeDefined();
    consoleSpy.mockRestore();
  });
});
