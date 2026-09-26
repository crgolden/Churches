import { randomInt, randomUUID } from 'node:crypto';
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
import {
  MEMORY_STORE_IN_PRODUCTION_WARNING,
  REDIS_CONNECTION_ERROR_LOG,
  RedisClientEvents,
  SESSION_COOKIE_NAME,
  SESSION_COOKIE_SAME_SITE,
  applySession,
} from './session';
import { BffSettingKeys, InvalidSettingError, MEMORY_SESSION_STORE, PRODUCTION_ENVIRONMENT } from './settings';

const NODE_ENV = BffSettingKeys.NodeEnv;
const PRODUCTION = PRODUCTION_ENVIRONMENT;

function makeApp(): { use: ReturnType<typeof vi.fn> } {
  return { use: vi.fn() };
}

function newRedisPort(): number {
  return randomInt(1024, 65536);
}

const REDIS_TUNABLE_KEYS = [
  BffSettingKeys.RedisSocketTimeoutMs,
  BffSettingKeys.RedisPingIntervalMs,
  BffSettingKeys.RedisReconnectStepMs,
  BffSettingKeys.RedisReconnectMaxDelayMs,
  BffSettingKeys.RedisReconnectJitterMs,
] as const;

type RedisTunables = Record<(typeof REDIS_TUNABLE_KEYS)[number], number>;

type RedisReconnectStrategy = (retries: number, cause: Error) => number | Error;

function reconnectStrategy(): RedisReconnectStrategy {
  const callArg = vi.mocked(createClient).mock.calls[0][0] as { socket: { reconnectStrategy: RedisReconnectStrategy } };
  return callArg.socket.reconnectStrategy;
}

function emitRedisEvent(event: string): void {
  const client = vi.mocked(createClient).mock.results[0].value as { on: ReturnType<typeof vi.fn> };
  client.on.mock.calls
    .filter(([name]) => name === event)
    .forEach(([, listener]) => (listener as () => void)());
}

function newTunableMs(): number {
  return randomInt(1, 100_000);
}

function useRedis(host: string, port: number): RedisTunables {
  const socketTimeout = newTunableMs() + 1;
  const tunables: RedisTunables = {
    [BffSettingKeys.RedisSocketTimeoutMs]: socketTimeout,
    [BffSettingKeys.RedisPingIntervalMs]: randomInt(1, socketTimeout),
    [BffSettingKeys.RedisReconnectStepMs]: newTunableMs(),
    [BffSettingKeys.RedisReconnectMaxDelayMs]: newTunableMs(),
    [BffSettingKeys.RedisReconnectJitterMs]: newTunableMs(),
  };
  delete process.env[BffSettingKeys.SessionStore];
  process.env[BffSettingKeys.RedisHost] = host;
  process.env[BffSettingKeys.RedisPort] = String(port);
  REDIS_TUNABLE_KEYS.forEach(key => {
    process.env[key] = String(tunables[key]);
  });
  return tunables;
}

describe('applySession', () => {
  const savedEnv: Record<string, string | undefined> = {};
  const ENV_KEYS = [
    NODE_ENV,
    BffSettingKeys.RedisHost,
    BffSettingKeys.RedisPort,
    BffSettingKeys.RedisPassword,
    BffSettingKeys.SessionStore,
    BffSettingKeys.SessionSecret,
    ...REDIS_TUNABLE_KEYS,
  ];

  beforeEach(() => {
    ENV_KEYS.forEach(k => {
      savedEnv[k] = process.env[k];
      delete process.env[k];
    });
    process.env[BffSettingKeys.SessionStore] = MEMORY_SESSION_STORE;
    process.env[BffSettingKeys.SessionSecret] = randomUUID();
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

  it('throws rather than falling back to MemoryStore when RedisHost is absent', () => {
    delete process.env[BffSettingKeys.SessionStore];
    process.env[BffSettingKeys.RedisPort] = String(newRedisPort());

    expect(() => applySession(makeApp() as unknown as Express)).toThrow(
      new InvalidSettingError(BffSettingKeys.RedisHost),
    );
    expect(vi.mocked(session).MemoryStore).not.toHaveBeenCalled();
  });

  it('throws rather than defaulting the port when RedisPort is absent', () => {
    delete process.env[BffSettingKeys.SessionStore];
    process.env[BffSettingKeys.RedisHost] = randomUUID();

    expect(() => applySession(makeApp() as unknown as Express)).toThrow(
      new InvalidSettingError(BffSettingKeys.RedisPort),
    );
    expect(createClient).not.toHaveBeenCalled();
  });

  it('throws when RedisPort is not an integer', () => {
    delete process.env[BffSettingKeys.SessionStore];
    process.env[BffSettingKeys.RedisHost] = randomUUID();
    process.env[BffSettingKeys.RedisPort] = randomUUID();

    expect(() => applySession(makeApp() as unknown as Express)).toThrow(
      new InvalidSettingError(BffSettingKeys.RedisPort),
    );
  });

  it.each(REDIS_TUNABLE_KEYS)('throws rather than defaulting %s when it is absent', (key) => {
    useRedis(randomUUID(), newRedisPort());
    delete process.env[key];

    expect(() => applySession(makeApp() as unknown as Express)).toThrow(new InvalidSettingError(key));
    expect(createClient).not.toHaveBeenCalled();
  });

  it.each(REDIS_TUNABLE_KEYS)('throws when %s is not a positive integer', (key) => {
    useRedis(randomUUID(), newRedisPort());
    process.env[key] = String(-newTunableMs());

    expect(() => applySession(makeApp() as unknown as Express)).toThrow(new InvalidSettingError(key));
  });

  it('throws when the ping interval would not keep a healthy idle socket inside the socket timeout', () => {
    const tunables = useRedis(randomUUID(), newRedisPort());
    process.env[BffSettingKeys.RedisPingIntervalMs] = String(tunables[BffSettingKeys.RedisSocketTimeoutMs]);

    expect(() => applySession(makeApp() as unknown as Express)).toThrow(
      new InvalidSettingError(BffSettingKeys.RedisPingIntervalMs),
    );
    expect(createClient).not.toHaveBeenCalled();
  });

  it('throws rather than generating a per-process secret when SessionSecret is absent', () => {
    delete process.env[BffSettingKeys.SessionSecret];

    expect(() => applySession(makeApp() as unknown as Express)).toThrow(
      new InvalidSettingError(BffSettingKeys.SessionSecret),
    );
    expect(session).not.toHaveBeenCalled();
  });

  it('uses MemoryStore when SessionStore selects it even if Redis is configured', async () => {
    process.env[BffSettingKeys.RedisHost] = randomUUID();
    process.env[BffSettingKeys.RedisPort] = String(newRedisPort());

    await applySession(makeApp() as unknown as Express);

    expect(vi.mocked(session).MemoryStore).toHaveBeenCalledOnce();
    expect(createClient).not.toHaveBeenCalled();
  });

  it('logs a warning when MemoryStore is used in production', async () => {
    process.env[NODE_ENV] = PRODUCTION;

    await applySession(makeApp() as unknown as Express);

    expect(logger.warn).toHaveBeenCalledWith(MEMORY_STORE_IN_PRODUCTION_WARNING);
  });

  it('creates Redis client without TLS in development', async () => {
    const host = randomUUID();
    const port = newRedisPort();
    useRedis(host, port);

    await applySession(makeApp() as unknown as Express);

    expect(createClient).toHaveBeenCalledWith(
      expect.objectContaining({
        socket: expect.objectContaining({ host, port }),
      }),
    );
    const callArg = vi.mocked(createClient).mock.calls[0][0] as Record<string, unknown>;
    expect((callArg['socket'] as Record<string, unknown>)['tls']).toBeUndefined();
    expect(RedisStore).toHaveBeenCalledOnce();
  });

  it('creates Redis client with TLS in production', async () => {
    const host = randomUUID();
    const port = newRedisPort();
    const password = randomUUID();
    process.env[NODE_ENV] = PRODUCTION;
    useRedis(host, port);
    process.env[BffSettingKeys.RedisPassword] = password;

    await applySession(makeApp() as unknown as Express);

    expect(createClient).toHaveBeenCalledWith(
      expect.objectContaining({
        socket: expect.objectContaining({
          host,
          port,
          tls: true,
        }),
        password,
      }),
    );
    expect(RedisStore).toHaveBeenCalledOnce();
  });

  it('bounds socket inactivity and keeps a healthy idle socket alive with the configured values', async () => {
    const tunables = useRedis(randomUUID(), newRedisPort());

    await applySession(makeApp() as unknown as Express);

    expect(createClient).toHaveBeenCalledWith(
      expect.objectContaining({
        socket: expect.objectContaining({ socketTimeout: tunables[BffSettingKeys.RedisSocketTimeoutMs] }),
        pingInterval: tunables[BffSettingKeys.RedisPingIntervalMs],
      }),
    );
  });

  it('reconnects after a socket timeout, backing off to the configured cap plus jitter', async () => {
    const tunables = useRedis(randomUUID(), newRedisPort());
    const retriesPastTheCap = tunables[BffSettingKeys.RedisReconnectMaxDelayMs];

    await applySession(makeApp() as unknown as Express);
    emitRedisEvent(RedisClientEvents.ready);

    const delay = reconnectStrategy()(retriesPastTheCap, new Error(randomUUID()));

    expect(delay).toBeGreaterThanOrEqual(tunables[BffSettingKeys.RedisReconnectMaxDelayMs]);
    expect(delay).toBeLessThan(tunables[BffSettingKeys.RedisReconnectMaxDelayMs] + tunables[BffSettingKeys.RedisReconnectJitterMs]);
  });

  it('gives up on the first failed connection before Redis has ever been ready, so startup fails instead of hanging', async () => {
    useRedis(randomUUID(), newRedisPort());
    const connectFailure = new Error(randomUUID());

    await applySession(makeApp() as unknown as Express);

    expect(reconnectStrategy()(randomInt(0, 100), connectFailure)).toBe(connectFailure);
  });

  it('sets secure=false cookie flag in development', async () => {
    const app = makeApp();

    await applySession(app as unknown as Express);

    expect(session).toHaveBeenCalledWith(
      expect.objectContaining({
        cookie: expect.objectContaining({ secure: false, httpOnly: true, sameSite: SESSION_COOKIE_SAME_SITE }),
      }),
    );
    expect(app.use).toHaveBeenCalledOnce();
  });

  it('sets secure=true cookie flag in production', async () => {
    process.env[NODE_ENV] = PRODUCTION;

    await applySession(makeApp() as unknown as Express);

    expect(session).toHaveBeenCalledWith(
      expect.objectContaining({
        cookie: expect.objectContaining({ secure: true }),
      }),
    );
  });

  it('uses the provided SessionSecret', async () => {
    const secret = randomUUID();
    process.env[BffSettingKeys.SessionSecret] = secret;

    await applySession(makeApp() as unknown as Express);

    expect(session).toHaveBeenCalledWith(
      expect.objectContaining({ secret }),
    );
  });

  it('names the session cookie with the app cookie name', async () => {
    await applySession(makeApp() as unknown as Express);

    expect(session).toHaveBeenCalledWith(
      expect.objectContaining({ name: SESSION_COOKIE_NAME }),
    );
  });

  it('logs a connection error when Redis emits an "error" event', async () => {
    useRedis(randomUUID(), newRedisPort());

    let errorListener: ((err: unknown) => void) | undefined;
    vi.mocked(createClient).mockReturnValue({
      on: vi.fn().mockImplementation((event: string, listener: (err: unknown) => void) => {
        if (event === RedisClientEvents.error) errorListener = listener;
        return { on: vi.fn(), connect: vi.fn().mockResolvedValue(undefined) };
      }),
      connect: vi.fn().mockResolvedValue(undefined),
    } as never);

    await applySession(makeApp() as unknown as Express);

    const connectionError = new Error(randomUUID());
    errorListener?.(connectionError);

    expect(logger.error).toHaveBeenCalledWith({ err: connectionError }, REDIS_CONNECTION_ERROR_LOG);
  });

  it('rejects rather than serving when Redis cannot be reached at startup', async () => {
    useRedis(randomUUID(), newRedisPort());
    const connectError = new Error(randomUUID());

    vi.mocked(createClient).mockReturnValue({
      on: vi.fn().mockReturnThis(),
      connect: vi.fn().mockRejectedValue(connectError),
    } as never);

    await expect(applySession(makeApp() as unknown as Express)).rejects.toBe(connectError);
  });
});
