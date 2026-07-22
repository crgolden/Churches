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

// ── Redis connection liveness ─────────────────────────────────────────────────
// Because `saveUninitialized: false` means anonymous traffic never touches the session store, this
// client can sit completely idle for minutes at a time. Azure App Service's outbound SNAT drops idle
// flows after ~4 minutes without notifying either end, leaving a half-open socket: node-redis still
// believes it is connected, writes the next command into a black hole, and the awaiting request hangs.
// Every route runs through session middleware, so one wedged socket stalls the whole app (including
// the home page) while `/health` — mounted before this middleware — keeps returning 200, which is why
// health polling never showed a gap.
//
// Preventing the drop is the *server's* job and is fixed once for every client by keeping Redis's
// `tcp-keepalive` below the platform's idle timeout; it does not belong in each app's code.
//
// Bounding the damage, however, is only possible here. When the path breaks, the server's keepalive
// probes fail and it closes its side, but that RST/FIN travels the same broken path and never arrives
// — the client alone can notice. Close the socket after this much inactivity rather than waiting on
// TCP keep-alive, which can take ~11 minutes to give up: far longer than the ~240s at which the Azure
// front end abandons the request and returns 504/502. StackExchange.Redis (used by the .NET apps,
// which never exhibited this) enforces command timeouts by default; node-redis defaults to waiting
// forever, so it has to be set explicitly.
const SOCKET_TIMEOUT_MS = 90_000;

// node-redis's *default* reconnect strategy deliberately does NOT reconnect after a SocketTimeoutError
// ("By default, do not reconnect on socket timeout" — @redis/client socket.js), which would leave the
// client permanently closed and every subsequent session lookup failing until the process restarts.
// Setting socketTimeout therefore REQUIRES a custom strategy that does reconnect. Backoff is capped
// with jitter so a Redis outage doesn't turn into a reconnect storm.
function reconnectStrategy(retries: number): number {
  return Math.min(retries * 100, 3_000) + Math.floor(Math.random() * 200);
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
          socket: {
            host,
            port,
            tls: true as const,
            socketTimeout: SOCKET_TIMEOUT_MS,
            reconnectStrategy,
          },
          password: process.env['RedisPassword'],
        })
      : createClient({
          socket: {
            host,
            port,
            socketTimeout: SOCKET_TIMEOUT_MS,
            reconnectStrategy,
          },
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
