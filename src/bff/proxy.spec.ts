import type { Request, Response, NextFunction } from 'express';

// ── Mocks (hoisted before imports) ────────────────────────────────────────────

vi.mock('./oidc', () => ({
  getOidcConfig: vi.fn().mockResolvedValue({ issuer: 'https://identity.example.com' }),
}));

vi.mock('openid-client', () => ({
  refreshTokenGrant: vi.fn(),
}));

import { refreshTokenGrant } from 'openid-client';
import { csrfForMutating, directoryProxy } from './proxy';

// ── Helpers ───────────────────────────────────────────────────────────────────

interface SessionLike {
  accessToken?: string;
  refreshToken?: string;
  tokenExpiresAt?: number;
  save: (cb: (err: unknown) => void) => void;
}

function makeReq(overrides: {
  method?: string;
  headers?: Record<string, string>;
  session?: Partial<SessionLike>;
  originalUrl?: string;
  body?: Buffer;
} = {}): Request {
  const method = overrides.method ?? 'GET';
  const hasBody = !['GET', 'HEAD'].includes(method);
  const bodyChunk = overrides.body ?? (hasBody ? Buffer.from('{}') : undefined);

  const originalUrl = overrides.originalUrl ?? '/directory/api/churches';
  // Mirrors real Express behaviour for middleware mounted via app.use('/directory/api', ...):
  // req.url is the original path with the mount prefix stripped.
  const url = originalUrl.replace(/^\/directory\/api/, '') || '/';

  const req: Record<string, unknown> = {
    method,
    headers: overrides.headers ?? {},
    originalUrl,
    url,
    session: {
      accessToken: undefined,
      refreshToken: undefined,
      tokenExpiresAt: undefined,
      save: vi.fn((cb: (err: unknown) => void) => cb(null)),
      ...overrides.session,
    },
    [Symbol.asyncIterator]: async function* () {
      if (bodyChunk) yield bodyChunk;
    },
  };

  return req as unknown as Request;
}

function makeRes() {
  const res = {
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
    setHeader: vi.fn(),
    end: vi.fn(),
  };
  return res;
}

const mockNext = vi.fn() as unknown as NextFunction;

function stubFetch(responses: { status: number; headers?: Headers; body?: ArrayBuffer }[]) {
  const mocks = responses.map(r => ({
    status: r.status,
    headers: r.headers ?? new Headers({ 'content-type': 'application/json' }),
    arrayBuffer: vi.fn().mockResolvedValue(r.body ?? new ArrayBuffer(0)),
  }));
  let call = 0;
  vi.stubGlobal('fetch', vi.fn().mockImplementation(() => Promise.resolve(mocks[call++])));
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('csrfForMutating', () => {
  beforeEach(() => vi.clearAllMocks());

  it('calls next for GET requests without checking X-CSRF', () => {
    const req = makeReq({ method: 'GET' });
    const res = makeRes();
    csrfForMutating(req, res as unknown as Response, mockNext);
    expect(mockNext).toHaveBeenCalledOnce();
    expect(res.status).not.toHaveBeenCalled();
  });

  it('rejects POST requests missing the X-CSRF header with 403', () => {
    const req = makeReq({ method: 'POST' });
    const res = makeRes();
    csrfForMutating(req, res as unknown as Response, mockNext);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({ error: 'Missing X-CSRF header' });
    expect(mockNext).not.toHaveBeenCalled();
  });

  it('calls next for POST requests that include the X-CSRF header', () => {
    const req = makeReq({ method: 'POST', headers: { 'x-csrf': '1' } });
    const res = makeRes();
    csrfForMutating(req, res as unknown as Response, mockNext);
    expect(mockNext).toHaveBeenCalledOnce();
    expect(res.status).not.toHaveBeenCalled();
  });
});

describe('directoryProxy', () => {
  const savedEnv: Record<string, string | undefined> = {};

  beforeEach(() => {
    savedEnv['DirectoryApiAddress'] = process.env['DirectoryApiAddress'];
    delete process.env['DirectoryApiAddress'];
    vi.clearAllMocks();
  });

  afterEach(() => {
    if (savedEnv['DirectoryApiAddress'] === undefined) {
      delete process.env['DirectoryApiAddress'];
    } else {
      process.env['DirectoryApiAddress'] = savedEnv['DirectoryApiAddress'];
    }
    vi.unstubAllGlobals();
  });

  it('returns 502 when DirectoryApiAddress is not configured', async () => {
    const req = makeReq();
    const res = makeRes();
    await directoryProxy(req, res as unknown as Response, mockNext);
    expect(res.status).toHaveBeenCalledWith(502);
    expect(res.json).toHaveBeenCalledWith({ error: 'DirectoryApiAddress is not configured' });
  });

  it('fetches anonymously (no Authorization header) when session has no token', async () => {
    process.env['DirectoryApiAddress'] = 'https://directory.example.com';
    stubFetch([{ status: 200 }]);
    const req = makeReq({ session: { accessToken: undefined } });
    const res = makeRes();

    await directoryProxy(req, res as unknown as Response, mockNext);

    const [, fetchOptions] = (vi.mocked(fetch) as ReturnType<typeof vi.fn>).mock.calls[0] as [string, RequestInit];
    expect((fetchOptions.headers as Record<string, string>)['authorization']).toBeUndefined();
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it('attaches Bearer token when session holds an access token', async () => {
    process.env['DirectoryApiAddress'] = 'https://directory.example.com';
    stubFetch([{ status: 200 }]);
    const req = makeReq({ session: { accessToken: 'valid-token' } });
    const res = makeRes();

    await directoryProxy(req, res as unknown as Response, mockNext);

    const [, fetchOptions] = (vi.mocked(fetch) as ReturnType<typeof vi.fn>).mock.calls[0] as [string, RequestInit];
    expect((fetchOptions.headers as Record<string, string>)['authorization']).toBe('Bearer valid-token');
  });

  it('proactively refreshes token when within 60 s of expiry', async () => {
    process.env['DirectoryApiAddress'] = 'https://directory.example.com';
    stubFetch([{ status: 200 }]);

    vi.mocked(refreshTokenGrant).mockResolvedValue({
      access_token: 'refreshed-token',
      refresh_token: 'new-refresh',
      expires_in: 3600,
    } as never);

    const req = makeReq({
      session: {
        accessToken: 'old-token',
        refreshToken: 'refresh-tok',
        tokenExpiresAt: Date.now() + 30_000,
        save: vi.fn((cb: (err: unknown) => void) => cb(null)),
      },
    });
    const res = makeRes();

    await directoryProxy(req, res as unknown as Response, mockNext);

    expect(refreshTokenGrant).toHaveBeenCalledWith(
      expect.objectContaining({ issuer: 'https://identity.example.com' }),
      'refresh-tok',
    );
    expect((req.session as unknown as SessionLike).accessToken).toBe('refreshed-token');
  });

  it('retries with a refreshed token on a 401 upstream response', async () => {
    process.env['DirectoryApiAddress'] = 'https://directory.example.com';
    stubFetch([{ status: 401 }, { status: 200 }]);

    vi.mocked(refreshTokenGrant).mockResolvedValue({
      access_token: 'after-retry-token',
      refresh_token: 'new-refresh',
      expires_in: 3600,
    } as never);

    const req = makeReq({
      session: {
        accessToken: 'expired-token',
        refreshToken: 'can-refresh',
        save: vi.fn((cb: (err: unknown) => void) => cb(null)),
      },
    });
    const res = makeRes();

    await directoryProxy(req, res as unknown as Response, mockNext);

    expect(vi.mocked(fetch)).toHaveBeenCalledTimes(2);
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it('forwards the 401 without retry when no refresh token is available', async () => {
    process.env['DirectoryApiAddress'] = 'https://directory.example.com';
    stubFetch([{ status: 401 }]);

    const req = makeReq({
      session: { accessToken: 'expired-token', refreshToken: undefined },
    });
    const res = makeRes();

    await directoryProxy(req, res as unknown as Response, mockNext);

    expect(vi.mocked(fetch)).toHaveBeenCalledTimes(1);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(refreshTokenGrant).not.toHaveBeenCalled();
  });

  it('forwards non-dropped response headers and strips hop-by-hop headers', async () => {
    process.env['DirectoryApiAddress'] = 'https://directory.example.com';
    const responseHeaders = new Headers({
      'content-type': 'application/json',
      'connection': 'keep-alive',
      'x-custom-header': 'custom-value',
    });
    stubFetch([{ status: 200, headers: responseHeaders }]);

    const req = makeReq();
    const res = makeRes();

    await directoryProxy(req, res as unknown as Response, mockNext);

    expect(res.setHeader).toHaveBeenCalledWith('content-type', 'application/json');
    expect(res.setHeader).toHaveBeenCalledWith('x-custom-header', 'custom-value');
    expect(res.setHeader).not.toHaveBeenCalledWith('connection', expect.anything());
  });

  it('strips Content-Encoding and Content-Length since fetch() already decompressed the body', async () => {
    // Regression test: fetch() transparently decompresses gzip/br/deflate bodies, so
    // apiResponse.arrayBuffer() returns plain bytes. Forwarding the upstream
    // Content-Encoding/Content-Length made clients try to decompress an already-decompressed
    // body ("incorrect header check" gzip errors against the real deployed Directory API).
    process.env['DirectoryApiAddress'] = 'https://directory.example.com';
    const responseHeaders = new Headers({
      'content-type': 'application/json',
      'content-encoding': 'gzip',
      'content-length': '12345',
    });
    stubFetch([{ status: 200, headers: responseHeaders }]);

    const req = makeReq();
    const res = makeRes();

    await directoryProxy(req, res as unknown as Response, mockNext);

    expect(res.setHeader).toHaveBeenCalledWith('content-type', 'application/json');
    expect(res.setHeader).not.toHaveBeenCalledWith('content-encoding', expect.anything());
    expect(res.setHeader).not.toHaveBeenCalledWith('content-length', expect.anything());
  });

  it('removes stale Authorization from forwarded headers when no session token', async () => {
    process.env['DirectoryApiAddress'] = 'https://directory.example.com';
    stubFetch([{ status: 200 }]);

    const req = makeReq({
      headers: { authorization: 'Bearer stale-token' },
      session: { accessToken: undefined },
    });
    const res = makeRes();

    await directoryProxy(req, res as unknown as Response, mockNext);

    const [, fetchOptions] = (vi.mocked(fetch) as ReturnType<typeof vi.fn>).mock.calls[0] as [string, RequestInit];
    expect((fetchOptions.headers as Record<string, string>)['authorization']).toBeUndefined();
  });

  it('joins multi-value request headers into a comma-separated string', async () => {
    process.env['DirectoryApiAddress'] = 'https://directory.example.com';
    stubFetch([{ status: 200 }]);

    // Express allows array-valued headers; the proxy joins them.
    const req = makeReq({
      headers: { accept: ['application/json', 'text/plain'] as unknown as string },
    });
    const res = makeRes();

    await directoryProxy(req, res as unknown as Response, mockNext);

    const [, fetchOptions] = (vi.mocked(fetch) as ReturnType<typeof vi.fn>).mock.calls[0] as [string, RequestInit];
    expect((fetchOptions.headers as Record<string, string>)['accept']).toBe(
      'application/json, text/plain',
    );
  });

  it('forwards the 401 and warns when the token refresh during retry fails', async () => {
    process.env['DirectoryApiAddress'] = 'https://directory.example.com';
    stubFetch([{ status: 401 }]);
    vi.mocked(refreshTokenGrant).mockRejectedValueOnce(new Error('refresh failed'));
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined);

    const req = makeReq({
      session: {
        accessToken: 'expired-token',
        refreshToken: 'can-refresh',
        save: vi.fn((cb: (err: unknown) => void) => cb(null)),
      },
    });
    const res = makeRes();

    await directoryProxy(req, res as unknown as Response, mockNext);

    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('Token refresh on 401 failed'),
      expect.any(Error),
    );
    expect(res.status).toHaveBeenCalledWith(401);
    warnSpy.mockRestore();
  });

  it('buffers a POST body from string chunks and forwards it', async () => {
    process.env['DirectoryApiAddress'] = 'https://directory.example.com';
    stubFetch([{ status: 201 }]);

    const req = makeReq({
      method: 'POST',
      headers: { 'x-csrf': '1', 'content-type': 'application/json' },
      session: { accessToken: 'token' },
      // Override the default Buffer yield with string chunks.
      body: undefined,
    });

    // Replace the async iterator with one yielding a string chunk.
    (req as Record<string, unknown>)[Symbol.asyncIterator] = async function* () {
      yield '{"test":true}';
    };

    const res = makeRes();

    await directoryProxy(req, res as unknown as Response, mockNext);

    expect(res.status).toHaveBeenCalledWith(201);
    const [, fetchOptions] = (vi.mocked(fetch) as ReturnType<typeof vi.fn>).mock.calls[0] as [string, RequestInit];
    expect(fetchOptions.body).toBeInstanceOf(Uint8Array);
  });
});
