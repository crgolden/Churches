import type { Express } from 'express';

// ── Mocks (hoisted before imports) ────────────────────────────────────────────
// vi.fn() (no implementation) produces a real function usable as a constructor.
// Avoid arrow functions in implementations when the mock is called with `new`.

vi.mock('express-session', () => {
  const MemoryStore = vi.fn();
  const sessionMiddleware = vi.fn();
  const sessionFactory = Object.assign(vi.fn().mockReturnValue(sessionMiddleware), {
    MemoryStore,
  });
  return { default: sessionFactory };
});

vi.mock('redis', () => ({
  createClient: vi.fn().mockReturnValue({
    on: vi.fn().mockReturnThis(),
    connect: vi.fn().mockResolvedValue(undefined),
  }),
}));

vi.mock('connect-redis', () => ({
  RedisStore: vi.fn(),
}));

import session from 'express-session';
import { createClient } from 'redis';
import { RedisStore } from 'connect-redis';
import { applySession } from './session';

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeApp(): { use: ReturnType<typeof vi.fn> } {
  return { use: vi.fn() };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('applySession', () => {
  const savedEnv: Record<string, string | undefined> = {};
  const ENV_KEYS = [
    'NODE_ENV',
    'RedisHost',
    'RedisPort',
    'RedisPassword',
    'SessionStore',
    'SessionSecret',
  ];

  beforeEach(() => {
    ENV_KEYS.forEach(k => {
      savedEnv[k] = process.env[k];
      delete process.env[k];
    });
    vi.clearAllMocks();
    // Restore implementations cleared by clearAllMocks
    vi.mocked(session).mockReturnValue(vi.fn() as never);
    vi.mocked(createClient).mockReturnValue({
      on: vi.fn().mockReturnThis(),
      connect: vi.fn().mockResolvedValue(undefined),
    } as never);
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

  // ── MemoryStore selection ──────────────────────────────────────────────────

  it('uses MemoryStore when RedisHost is absent', () => {
    applySession(makeApp() as unknown as Express);

    expect(vi.mocked(session).MemoryStore).toHaveBeenCalledOnce();
    expect(createClient).not.toHaveBeenCalled();
  });

  it('uses MemoryStore when SessionStore is "memory" even if RedisHost is set', () => {
    process.env['RedisHost'] = 'redis.dev.local';
    process.env['SessionStore'] = 'memory';

    applySession(makeApp() as unknown as Express);

    expect(vi.mocked(session).MemoryStore).toHaveBeenCalledOnce();
    expect(createClient).not.toHaveBeenCalled();
  });

  it('logs a warning when MemoryStore is used in production', () => {
    process.env['NODE_ENV'] = 'production';
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined);

    applySession(makeApp() as unknown as Express);

    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('MemoryStore in production'),
    );
    warnSpy.mockRestore();
  });

  // ── RedisStore selection ───────────────────────────────────────────────────

  it('creates Redis client without TLS in development', () => {
    process.env['RedisHost'] = 'redis.dev.local';
    process.env['RedisPort'] = '6379';

    applySession(makeApp() as unknown as Express);

    expect(createClient).toHaveBeenCalledWith(
      expect.objectContaining({
        socket: expect.objectContaining({ host: 'redis.dev.local', port: 6379 }),
      }),
    );
    const callArg = vi.mocked(createClient).mock.calls[0][0] as Record<string, unknown>;
    expect((callArg['socket'] as Record<string, unknown>)['tls']).toBeUndefined();
    expect(RedisStore).toHaveBeenCalledOnce();
  });

  it('creates Redis client with TLS in production', () => {
    process.env['NODE_ENV'] = 'production';
    process.env['RedisHost'] = 'redis.azure.com';
    process.env['RedisPort'] = '6380';
    process.env['RedisPassword'] = 'secret-password';

    applySession(makeApp() as unknown as Express);

    expect(createClient).toHaveBeenCalledWith(
      expect.objectContaining({
        socket: expect.objectContaining({
          host: 'redis.azure.com',
          port: 6380,
          tls: true,
        }),
        password: 'secret-password',
      }),
    );
    expect(RedisStore).toHaveBeenCalledOnce();
  });

  // ── Connection liveness ────────────────────────────────────────────────────
  // A half-open socket (Azure SNAT silently dropping an idle flow) otherwise hangs every request
  // that touches the session store — which is every route — until the platform 504s at ~240s.

  it('bounds socket inactivity so a half-open connection cannot hang requests forever', () => {
    process.env['RedisHost'] = 'redis.dev.local';

    applySession(makeApp() as unknown as Express);

    const [callArg] = vi.mocked(createClient).mock.calls[0];
    const socket = (callArg as Record<string, unknown>)['socket'] as Record<string, unknown>;
    expect(socket['socketTimeout']).toBeTypeOf('number');
    // Must stay under the ~240s at which Azure App Service abandons the request.
    expect(socket['socketTimeout'] as number).toBeLessThan(240_000);
  });

  it('reconnects after a socket timeout', () => {
    // node-redis's default strategy returns false (no reconnect) for SocketTimeoutError, which would
    // leave the client permanently closed and fail every later session lookup. Setting socketTimeout
    // without overriding this is a footgun — guard against the override being dropped.
    process.env['RedisHost'] = 'redis.dev.local';

    applySession(makeApp() as unknown as Express);

    const [callArg] = vi.mocked(createClient).mock.calls[0];
    const socket = (callArg as Record<string, unknown>)['socket'] as Record<string, unknown>;
    const strategy = socket['reconnectStrategy'] as (retries: number) => number | false;

    expect(strategy).toBeTypeOf('function');
    expect(strategy(0)).toBeTypeOf('number');
    expect(strategy(50)).toBeTypeOf('number');
    // Backoff stays bounded so an outage doesn't become an ever-lengthening stall.
    expect(strategy(1000) as number).toBeLessThanOrEqual(3_200);
  });

  it('defaults RedisPort to 6380 when RedisPort is not set', () => {
    process.env['RedisHost'] = 'redis.dev.local';

    applySession(makeApp() as unknown as Express);

    const [callArg] = vi.mocked(createClient).mock.calls[0];
    expect((callArg as Record<string, unknown>)['socket']).toMatchObject({ port: 6380 });
  });

  // ── Cookie flags ───────────────────────────────────────────────────────────

  it('sets secure=false cookie flag in development', () => {
    const app = makeApp();

    applySession(app as unknown as Express);

    expect(session).toHaveBeenCalledWith(
      expect.objectContaining({
        cookie: expect.objectContaining({ secure: false, httpOnly: true, sameSite: 'lax' }),
      }),
    );
    expect(app.use).toHaveBeenCalledOnce();
  });

  it('sets secure=true cookie flag in production', () => {
    process.env['NODE_ENV'] = 'production';

    applySession(makeApp() as unknown as Express);

    expect(session).toHaveBeenCalledWith(
      expect.objectContaining({
        cookie: expect.objectContaining({ secure: true }),
      }),
    );
  });

  // ── Session options ────────────────────────────────────────────────────────

  it('uses the provided SessionSecret', () => {
    process.env['SessionSecret'] = 'my-long-random-secret';

    applySession(makeApp() as unknown as Express);

    expect(session).toHaveBeenCalledWith(
      expect.objectContaining({ secret: 'my-long-random-secret' }),
    );
  });

  it('uses the cookie name "churches.sid"', () => {
    applySession(makeApp() as unknown as Express);

    expect(session).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'churches.sid' }),
    );
  });

  it('logs a connection error when Redis emits an "error" event', () => {
    process.env['RedisHost'] = 'redis.dev.local';
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    // Capture the listener registered via redisClient.on('error', listener)
    let errorListener: ((err: unknown) => void) | undefined;
    vi.mocked(createClient).mockReturnValue({
      on: vi.fn().mockImplementation((event: string, listener: (err: unknown) => void) => {
        if (event === 'error') errorListener = listener;
        return { on: vi.fn(), connect: vi.fn().mockResolvedValue(undefined) };
      }),
      connect: vi.fn().mockResolvedValue(undefined),
    } as never);

    applySession(makeApp() as unknown as Express);

    const connectionError = new Error('ECONNREFUSED');
    errorListener?.(connectionError);

    expect(errorSpy).toHaveBeenCalledWith('[Redis] Connection error:', connectionError);
    errorSpy.mockRestore();
  });

  it('logs a connect error when Redis initial connect rejects', async () => {
    process.env['RedisHost'] = 'redis.dev.local';
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const connectError = new Error('initial connect failed');

    vi.mocked(createClient).mockReturnValue({
      on: vi.fn().mockReturnThis(),
      connect: vi.fn().mockRejectedValue(connectError),
    } as never);

    applySession(makeApp() as unknown as Express);

    // Allow the rejected connect promise to propagate to the .catch handler.
    await new Promise<void>(resolve => setTimeout(resolve, 0));

    expect(errorSpy).toHaveBeenCalledWith('[Redis] Initial connect failed:', connectError);
    errorSpy.mockRestore();
  });
});
