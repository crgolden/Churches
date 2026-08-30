import { randomInt } from 'node:crypto';
import type { Express } from 'express';
import session from 'express-session';
import { createClient } from 'redis';
import { RedisStore } from 'connect-redis';
import { logger } from '../telemetry/logging';

declare module 'express-session' {
  interface SessionData {
    /** PKCE code verifier — present only during the login flow. */
    pkceCodeVerifier?: string;
    /** OAuth state — present only during the login flow. */
    oauthState?: string;
    /** OAuth 2.0 access token for the Directory API. */
    accessToken?: string;
    refreshToken?: string;
    /** OIDC ID token (used as id_token_hint for RP-initiated logout). */
    idToken?: string;
    /** Unix ms at which the access token expires (undefined = unknown). */
    tokenExpiresAt?: number;
    /** Claims returned by the userinfo endpoint, formatted for /bff/user. */
    claims?: { type: string; value: string }[];
  }
}

const SOCKET_TIMEOUT_MS = 90_000;
const PING_INTERVAL_MS = 30_000;

function reconnectStrategy(retries: number): number {
  return Math.min(retries * 100, 3_000) + randomInt(200);
}

export function applySession(app: Express): void {
  const isProd = process.env['NODE_ENV'] === 'production';

  const useMemory =
    !process.env['RedisHost'] || process.env['SessionStore'] === 'memory';

  let store: session.Store;

  if (useMemory) {
    store = new session.MemoryStore();
    if (isProd) {
      logger.warn(
        '[Session] WARNING: using MemoryStore in production. ' +
          'Set RedisHost (and optionally SessionStore) to switch to Redis.',
      );
    }
  } else {
    const host = process.env['RedisHost'] ?? 'localhost';
    const port = parseInt(process.env['RedisPort'] ?? '6380', 10);

    const redisClient = isProd
      ? createClient({
          socket: {
            host,
            port,
            tls: true as const,
            socketTimeout: SOCKET_TIMEOUT_MS,
            reconnectStrategy,
          },
          password: process.env['RedisPassword'],
          pingInterval: PING_INTERVAL_MS,
        })
      : createClient({
          socket: {
            host,
            port,
            socketTimeout: SOCKET_TIMEOUT_MS,
            reconnectStrategy,
          },
          password: process.env['RedisPassword'],
          pingInterval: PING_INTERVAL_MS,
        });

    redisClient.on('error', (err: unknown) => {
      logger.error({ err }, '[Redis] Connection error');
    });

    redisClient.connect().catch((err: unknown) => {
      logger.error({ err }, '[Redis] Initial connect failed');
    });

    store = new RedisStore({ client: redisClient });
  }

  const secret = process.env['SessionSecret'] ?? crypto.randomUUID();

  app.use(
    session({
      store,
      secret,
      name: 'churches.sid',
      resave: false,
      saveUninitialized: false,
      cookie: {
        httpOnly: true,
        sameSite: 'lax',
        secure: isProd,
      },
    }),
  );
}
