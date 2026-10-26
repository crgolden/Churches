import { randomInt } from 'node:crypto';
import type { Express } from 'express';
import session from 'express-session';
import { ConnectionTimeoutError, createClient, SocketClosedUnexpectedlyError, SocketTimeoutError } from 'redis';
import { RedisStore } from 'connect-redis';
import { logger } from '../telemetry/logging';
import {
  BffSettingKeys,
  InvalidSettingError,
  isProductionEnvironment,
  MEMORY_SESSION_STORE,
  requiredIntegerSetting,
  requiredPositiveIntegerSetting,
  requiredSetting,
} from './settings';

declare module 'express-session' {
  interface SessionData {
    pkceCodeVerifier?: string;
    oauthState?: string;
    accessToken?: string;
    refreshToken?: string;
    idToken?: string;
    tokenExpiresAt?: number;
    claims?: { type: string; value: string }[];
  }
}

export const SESSION_COOKIE_NAME = 'churches.sid';


export const MEMORY_STORE_IN_PRODUCTION_WARNING =
  `[Session] WARNING: using MemoryStore in production. Remove ${BffSettingKeys.SessionStore}=${MEMORY_SESSION_STORE} to switch to Redis.`;

export const REDIS_CONNECTION_ERROR_LOG = '[Redis] Connection error';

export const REDIS_DROP_RECONNECTED_LOG = '[Redis] Connection dropped and reconnected';

type StoreCallback = (err?: unknown, data?: session.SessionData | null) => unknown;

function isConnectionDrop(err: unknown): boolean {
  return err instanceof SocketTimeoutError || err instanceof SocketClosedUnexpectedlyError || err instanceof ConnectionTimeoutError;
}

async function retryOnceOnDrop(attempt: () => Promise<session.SessionData | null>, cb?: StoreCallback): Promise<unknown> {
  let data: session.SessionData | null;
  try {
    data = await attempt();
  } catch (error) {
    if (!isConnectionDrop(error)) {
      if (cb) return cb(error, null);
      throw error;
    }
    try {
      data = await attempt();
    } catch (error_) {
      if (cb) return cb(error_, null);
      throw error_;
    }
  }
  return cb ? cb(null, data) : data;
}

export class ReconnectingRedisStore extends RedisStore {
  override get(sid: string, cb?: StoreCallback): Promise<unknown> {
    return retryOnceOnDrop(() => super.get(sid), cb);
  }

  override touch(sid: string, sess: session.SessionData, cb?: StoreCallback): Promise<unknown> {
    return retryOnceOnDrop(() => super.touch(sid, sess), cb);
  }
}

export const RedisClientEvents = {
  error: 'error',
  ready: 'ready',
} as const;

export const SESSION_COOKIE_SAME_SITE = 'lax';

function reconnectStrategyFromSettings(hasBeenReady: () => boolean): (retries: number, cause: Error) => number | Error {
  const stepMs = requiredPositiveIntegerSetting(BffSettingKeys.RedisReconnectStepMs);
  const maxDelayMs = requiredPositiveIntegerSetting(BffSettingKeys.RedisReconnectMaxDelayMs);
  const jitterMs = requiredPositiveIntegerSetting(BffSettingKeys.RedisReconnectJitterMs);
  return (retries: number, cause: Error) =>
    hasBeenReady() ? Math.min(retries * stepMs, maxDelayMs) + randomInt(jitterMs) : cause;
}

export function applySession(app: Express): Promise<void> {
  const isProd = isProductionEnvironment();

  const secret = requiredSetting(BffSettingKeys.SessionSecret);
  const useMemory = process.env[BffSettingKeys.SessionStore] === MEMORY_SESSION_STORE;

  let store: session.Store;
  let ready: Promise<void>;

  if (useMemory) {
    store = new session.MemoryStore();
    ready = Promise.resolve();
    if (isProd) {
      logger.warn(MEMORY_STORE_IN_PRODUCTION_WARNING);
    }
  } else {
    const host = requiredSetting(BffSettingKeys.RedisHost);
    const port = requiredIntegerSetting(BffSettingKeys.RedisPort);
    const password = process.env[BffSettingKeys.RedisPassword];
    const socketTimeout = requiredPositiveIntegerSetting(BffSettingKeys.RedisSocketTimeoutMs);
    const pingInterval = requiredPositiveIntegerSetting(BffSettingKeys.RedisPingIntervalMs);
    if (pingInterval >= socketTimeout) {
      throw new InvalidSettingError(BffSettingKeys.RedisPingIntervalMs);
    }
    let redisHasBeenReady = false;
    const reconnectStrategy = reconnectStrategyFromSettings(() => redisHasBeenReady);

    const redisClient = isProd
      ? createClient({
          socket: {
            host,
            port,
            tls: true as const,
            socketTimeout,
            reconnectStrategy,
          },
          password,
          pingInterval,
        })
      : createClient({
          socket: {
            host,
            port,
            socketTimeout,
            reconnectStrategy,
          },
          password,
          pingInterval,
        });

    let pendingDrop: { err: unknown; errors: number; timer: ReturnType<typeof setTimeout> } | undefined;
    redisClient.on(RedisClientEvents.error, (err: unknown) => {
      if (pendingDrop) {
        pendingDrop.errors += 1;
        return;
      }
      if (!redisHasBeenReady) {
        logger.error({ err }, REDIS_CONNECTION_ERROR_LOG);
        return;
      }
      const timer = setTimeout(() => {
        const unrecovered = pendingDrop;
        pendingDrop = undefined;
        logger.error({ err, errors: unrecovered?.errors }, REDIS_CONNECTION_ERROR_LOG);
      }, socketTimeout);
      timer.unref();
      pendingDrop = { err, errors: 1, timer };
    });
    redisClient.on(RedisClientEvents.ready, () => {
      redisHasBeenReady = true;
      if (pendingDrop) {
        clearTimeout(pendingDrop.timer);
        logger.warn({ err: pendingDrop.err, errors: pendingDrop.errors }, REDIS_DROP_RECONNECTED_LOG);
        pendingDrop = undefined;
      }
    });

    ready = redisClient.connect().then(() => undefined);
    store = new ReconnectingRedisStore({ client: redisClient });
  }

  app.use(
    session({
      store,
      secret,
      name: SESSION_COOKIE_NAME,
      resave: false,
      saveUninitialized: false,
      cookie: {
        httpOnly: true,
        sameSite: SESSION_COOKIE_SAME_SITE,
        secure: isProd,
      },
    }),
  );

  return ready;
}
