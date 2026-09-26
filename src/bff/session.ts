import { randomInt } from 'node:crypto';
import type { Express } from 'express';
import session from 'express-session';
import { createClient } from 'redis';
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

    redisClient.on(RedisClientEvents.error, (err: unknown) => {
      logger.error({ err }, REDIS_CONNECTION_ERROR_LOG);
    });
    redisClient.on(RedisClientEvents.ready, () => {
      redisHasBeenReady = true;
    });

    ready = redisClient.connect().then(() => undefined);
    store = new RedisStore({ client: redisClient });
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
