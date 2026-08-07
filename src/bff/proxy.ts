import type { Request, Response as ExpressResponse, NextFunction } from 'express';
import { refreshTokenGrant } from 'openid-client';
import { getOidcConfig } from './oidc';
import { logger } from '../telemetry/logging';

const MUTATING_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

const DROP_REQUEST_HEADERS = new Set([
  'host',
  'connection',
  'transfer-encoding',
  'x-csrf',
]);

const DROP_RESPONSE_HEADERS = new Set([
  'connection',
  'keep-alive',
  'transfer-encoding',
  'content-encoding',
  'content-length',
]);

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
    req.session.save((err: unknown) =>
      err ? reject(err instanceof Error ? err : new Error('Session save failed', { cause: err })) : resolve(),
    ),
  );
}

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

  const relativePath = req.url.replace(/^\/+/, '');
  const targetUrl = new URL(relativePath, `${base}/`);

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
      logger.warn({ err }, '[BFF proxy] Proactive token refresh failed');
    }
  }

  const hasBody = !['GET', 'HEAD'].includes(req.method);
  let bodyBuffer: Uint8Array<ArrayBuffer> | undefined;

  if (hasBody) {
    const chunks: Uint8Array<ArrayBuffer>[] = [];
    for await (const chunk of req as AsyncIterable<unknown>) {
      if (Buffer.isBuffer(chunk)) {
        const view = new Uint8Array(chunk.byteLength);
        view.set(new Uint8Array(chunk.buffer, chunk.byteOffset, chunk.byteLength));
        chunks.push(view);
      } else if (typeof chunk === 'string') {
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
      out['authorization'] = `Bearer ${token}`;
    } else {
      delete out['authorization'];
    }

    return out;
  };

  const doFetch = (): Promise<globalThis.Response> =>
    fetch(targetUrl, {
      method: req.method,
      headers: buildHeaders(),
      body: bodyBuffer,
    });

  let apiResponse = await doFetch();

  if (apiResponse.status === 401 && req.session.refreshToken) {
    try {
      await refreshAndSave(req);
      apiResponse = await doFetch();
    } catch (err) {
      logger.warn({ err }, '[BFF proxy] Token refresh on 401 failed');
    }
  }

  res.status(apiResponse.status);
  apiResponse.headers.forEach((value: string, key: string) => {
    if (!DROP_RESPONSE_HEADERS.has(key.toLowerCase())) {
      res.setHeader(key, value);
    }
  });

  const body = await apiResponse.arrayBuffer();
  res.end(Buffer.from(body));
}
