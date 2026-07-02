import type { Request, Response as ExpressResponse, NextFunction } from 'express';
import { refreshTokenGrant } from 'openid-client';
import { getOidcConfig } from './oidc';

const MUTATING_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

// Request headers that must NOT be forwarded to the upstream API.
const DROP_REQUEST_HEADERS = new Set([
  'host',
  'connection',
  'transfer-encoding',
  // Strip the BFF-internal CSRF header so it doesn't confuse the API.
  'x-csrf',
]);

// Response headers that must NOT be forwarded to the client.
const DROP_RESPONSE_HEADERS = new Set([
  'connection',
  'keep-alive',
  'transfer-encoding',
]);

// ── CSRF guard ────────────────────────────────────────────────────────────────

/**
 * Rejects mutating proxy requests that lack the static `X-CSRF` header.
 * GET/HEAD are read-only and are passed through without checking.
 */
export function csrfForMutating(
  req: Request,
  res: ExpressResponse,
  next: NextFunction,
): void {
  if (MUTATING_METHODS.has(req.method) && !req.headers['x-csrf']) {
    res.status(403).json({ error: 'Missing X-CSRF header' });
    return;
  }
  next();
}

// ── Token refresh ─────────────────────────────────────────────────────────────

async function refreshAndSave(req: Request): Promise<void> {
  const { refreshToken } = req.session;
  if (!refreshToken) return;

  const config = await getOidcConfig();
  const newTokens = await refreshTokenGrant(config, refreshToken);

  req.session.accessToken = newTokens.access_token;
  if (newTokens.refresh_token) {
    req.session.refreshToken = newTokens.refresh_token;
  }
  req.session.tokenExpiresAt =
    typeof newTokens.expires_in === 'number'
      ? Date.now() + newTokens.expires_in * 1000
      : undefined;

  await new Promise<void>((resolve, reject) =>
    req.session.save((err: unknown) => (err ? reject(err) : resolve())),
  );
}

// ── Proxy ─────────────────────────────────────────────────────────────────────

/**
 * Fetch-based proxy that forwards `/directory/api/**` to `DirectoryApiAddress`.
 *
 * Behaviour (mirrors .NET `MapRemoteBffApiEndpoint` with `UserOrNone`):
 *  - Attaches `Authorization: Bearer <access_token>` when the session holds a
 *    valid token (user is authenticated).
 *  - Proxies anonymously when no session / no token (anonymous browsing).
 *  - Proactively refreshes the access token when it is within 60 s of expiry.
 *  - On a 401 response from the API, attempts one token refresh and retries.
 *
 * The request body is buffered before the first upstream call so that it can
 * be replayed on a 401 retry.  The body is collected as Uint8Array throughout
 * to remain compatible with the DOM-typed `fetch` BodyInit.
 */
export async function directoryProxy(
  req: Request,
  res: ExpressResponse,
  _next: NextFunction,
): Promise<void> {
  const base = (process.env['DirectoryApiAddress'] ?? '').replace(/\/$/, '');

  if (!base) {
    res.status(502).json({ error: 'DirectoryApiAddress is not configured' });
    return;
  }

  const targetUrl = `${base}${req.originalUrl}`;

  // Proactively refresh if the token is within 60 s of expiry.
  const { accessToken, refreshToken, tokenExpiresAt } = req.session;
  if (
    accessToken &&
    refreshToken &&
    tokenExpiresAt !== undefined &&
    Date.now() >= tokenExpiresAt - 60_000
  ) {
    try {
      await refreshAndSave(req);
    } catch (err) {
      console.warn('[BFF proxy] Proactive token refresh failed:', err);
    }
  }

  // Buffer the request body (as Uint8Array) so it can be replayed on a 401
  // retry.  Uint8Array satisfies the DOM fetch BodyInit type.
  const hasBody = !['GET', 'HEAD'].includes(req.method);
  // TypeScript 5.9 made array buffer types generic.  BodyInit requires
  // Uint8Array<ArrayBuffer> (not Uint8Array<ArrayBufferLike>), so we declare
  // explicitly and construct via new Uint8Array(length) which always yields
  // Uint8Array<ArrayBuffer>.
  let bodyBuffer: Uint8Array<ArrayBuffer> | undefined;

  if (hasBody) {
    const chunks: Array<Uint8Array<ArrayBuffer>> = [];
    for await (const chunk of req as AsyncIterable<unknown>) {
      if (Buffer.isBuffer(chunk)) {
        // Copy the slice into a fresh ArrayBuffer to satisfy the generic bound.
        const view = new Uint8Array(chunk.byteLength);
        view.set(new Uint8Array(chunk.buffer, chunk.byteOffset, chunk.byteLength));
        chunks.push(view);
      } else if (typeof chunk === 'string') {
        // TextEncoder always returns Uint8Array<ArrayBuffer>.
        chunks.push(new TextEncoder().encode(chunk));
      }
    }
    let totalLen = 0;
    for (const c of chunks) totalLen += c.byteLength;
    const combined = new Uint8Array(totalLen);
    let pos = 0;
    for (const c of chunks) {
      combined.set(c, pos);
      pos += c.byteLength;
    }
    bodyBuffer = combined;
  }

  // Build upstream headers, injecting the session Bearer token when present.
  const buildHeaders = (): Record<string, string> => {
    const out: Record<string, string> = {};
    for (const [k, v] of Object.entries(req.headers)) {
      if (DROP_REQUEST_HEADERS.has(k.toLowerCase())) continue;
      if (typeof v === 'string') {
        out[k] = v;
      } else if (Array.isArray(v)) {
        out[k] = v.join(', ');
      }
    }

    const token = req.session.accessToken;
    if (token) {
      // UserOrNone — authenticated path.
      out['authorization'] = `Bearer ${token}`;
    } else {
      // UserOrNone — anonymous path: do not forward any stale auth header.
      delete out['authorization'];
    }

    return out;
  };

  // The global `fetch` returns the Web API Response; alias the return type
  // explicitly to avoid confusion with the Express Response parameter.
  const doFetch = (): Promise<globalThis.Response> =>
    fetch(targetUrl, {
      method: req.method,
      headers: buildHeaders(),
      body: bodyBuffer,
    });

  let apiResponse = await doFetch();

  // On 401: attempt one token refresh then retry.
  if (apiResponse.status === 401 && req.session.refreshToken) {
    try {
      await refreshAndSave(req);
      apiResponse = await doFetch();
    } catch (err) {
      console.warn('[BFF proxy] Token refresh on 401 failed:', err);
      // Fall through and forward the 401 to the client.
    }
  }

  // Forward the upstream status and headers.
  res.status(apiResponse.status);
  apiResponse.headers.forEach((value: string, key: string) => {
    if (!DROP_RESPONSE_HEADERS.has(key.toLowerCase())) {
      res.setHeader(key, value);
    }
  });

  // Buffer and forward the response body.
  const body = await apiResponse.arrayBuffer();
  res.end(Buffer.from(body));
}
