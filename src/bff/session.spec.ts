import type { Express } from 'express';

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

vi.mock('../telemetry/logging', () => ({
  logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn() },
}));

import session from 'express-session';
import { createClient } from 'redis';
import { RedisStore } from 'connect-redis';
import { logger } from '../telemetry/logging';
import { applySession } from './session';

function makeApp(): { use: ReturnType<typeof vi.fn> } {
  return { use: vi.fn() };
}

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

    applySession(makeApp() as unknown as Express);

    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringContaining('MemoryStore in production'),
    );
  });

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

  it('bounds socket inactivity so a half-open connection cannot hang requests forever', () => {
    process.env['RedisHost'] = 'redis.dev.local';

    applySession(makeApp() as unknown as Express);

    const [callArg] = vi.mocked(createClient).mock.calls[0];
    const socket = (callArg as Record<string, unknown>)['socket'] as Record<string, unknown>;
    expect(socket['socketTimeout']).toBeTypeOf('number');
    expect(socket['socketTimeout'] as number).toBeLessThan(240_000);
  });

  it('reconnects after a socket timeout', () => {
    process.env['RedisHost'] = 'redis.dev.local';

    applySession(makeApp() as unknown as Express);

    const [callArg] = vi.mocked(createClient).mock.calls[0];
    const socket = (callArg as Record<string, unknown>)['socket'] as Record<string, unknown>;
    const strategy = socket['reconnectStrategy'] as (retries: number) => number | false;

    expect(strategy).toBeTypeOf('function');
    expect(strategy(0)).toBeTypeOf('number');
    expect(strategy(50)).toBeTypeOf('number');
    expect(strategy(1000) as number).toBeLessThanOrEqual(3_200);
  });

  it('defaults RedisPort to 6380 when RedisPort is not set', () => {
    process.env['RedisHost'] = 'redis.dev.local';

    applySession(makeApp() as unknown as Express);

    const [callArg] = vi.mocked(createClient).mock.calls[0];
    expect((callArg as Record<string, unknown>)['socket']).toMatchObject({ port: 6380 });
  });

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

    expect(logger.error).toHaveBeenCalledWith({ err: connectionError }, '[Redis] Connection error');
  });

  it('logs a connect error when Redis initial connect rejects', async () => {
    process.env['RedisHost'] = 'redis.dev.local';
    const connectError = new Error('initial connect failed');

    vi.mocked(createClient).mockReturnValue({
      on: vi.fn().mockReturnThis(),
      connect: vi.fn().mockRejectedValue(connectError),
    } as never);

    applySession(makeApp() as unknown as Express);

    await new Promise<void>(resolve => setTimeout(resolve, 0));

    expect(logger.error).toHaveBeenCalledWith({ err: connectError }, '[Redis] Initial connect failed');
  });
});
