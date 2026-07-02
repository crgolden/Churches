import type { Express } from 'express';
import session from 'express-session';
import { createClient } from 'redis';
import { RedisStore } from 'connect-redis';

// ── Session data shape ────────────────────────────────────────────────────────
// Tokens and claims are stored server-side in Redis; nothing is sent to the
// browser beyond the signed session cookie.
declare module 'express-session' {
  interface SessionData {
    /** PKCE code verifier — present only during the login flow. */
    pkceCodeVerifier?: string;
    /** OAuth state — present only during the login flow. */
    oauthState?: string;
    /** OAuth 2.0 access token for the Directory API. */
    accessToken?: string;
    /** OAuth 2.0 refresh token. */
    refreshToken?: string;
    /** OIDC ID token (used as id_token_hint for RP-initiated logout). */
    idToken?: string;
    /** Unix ms at which the access token expires (undefined = unknown). */
    tokenExpiresAt?: number;
    /** Claims returned by the userinfo endpoint, formatted for /bff/user. */
    claims?: { type: string; value: string }[];
  }
}

/**
 * Attaches express-session to the Express app.
 *
 * Store selection:
 *  - Production (NODE_ENV=production AND RedisHost is set AND SessionStore≠memory):
 *    connect-redis backed by a Redis client.
 *  - Otherwise (local dev, test, or explicit SessionStore=memory):
 *    express-session's built-in MemoryStore.  Sessions do not persist across
 *    restarts — acceptable for development and E2E tests, not for production.
 *
 * Call this before any BFF routes are registered.
 */
export function applySession(app: Express): void {
  const isProd = process.env['NODE_ENV'] === 'production';

  // Opt-out of Redis when RedisHost is absent or the caller explicitly requests
  // the in-memory store (useful for local dev and E2E tests).
  const useMemory =
    !process.env['RedisHost'] || process.env['SessionStore'] === 'memory';

  let store: session.Store;

  if (useMemory) {
    // express-session's built-in store — no external dependency required.
    store = new session.MemoryStore();
    if (isProd) {
      console.warn(
        '[Session] WARNING: using MemoryStore in production. ' +
          'Set RedisHost (and optionally SessionStore) to switch to Redis.',
      );
    }
  } else {
    const host = process.env['RedisHost'] ?? 'localhost';
    const port = parseInt(process.env['RedisPort'] ?? '6380', 10);

    // The `redis` package uses a discriminated union for socket options where
    // `tls: true` (literal) is required for TLS connections.
    const redisClient = isProd
      ? createClient({
          socket: { host, port, tls: true as const },
          password: process.env['RedisPassword'],
        })
      : createClient({
          socket: { host, port },
          password: process.env['RedisPassword'],
        });

    // Log connection errors without crashing.  In local dev Redis may be
    // absent; the session store will fail gracefully and log the issue.
    redisClient.on('error', (err: unknown) => {
      console.error('[Redis] Connection error:', err);
    });

    redisClient.connect().catch((err: unknown) => {
      console.error('[Redis] Initial connect failed:', err);
    });

    store = new RedisStore({ client: redisClient });
  }

  // SessionSecret must be a long random string set via App Service settings
  // (or environment variable) in production.  In dev we fall back to an
  // ephemeral random value — sessions won't survive restarts, which is fine.
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
        // Lax (not Strict): the OIDC callback is a top-level GET navigation initiated by a
        // redirect from Identity (a different origin). SameSite=Strict withholds the cookie on
        // that navigation, so pkceCodeVerifier/oauthState never reach /bff/callback and login
        // always 400s. Lax still blocks cross-site subrequests (CSRF protection intact) while
        // allowing the cookie on top-level GET redirects — the standard choice for OIDC/OAuth
        // correlation cookies.
        sameSite: 'lax',
        secure: isProd,
      },
    }),
  );
}
