import { HttpStatusCode } from '@angular/common/http';
import type { Request, Response, NextFunction } from 'express';
import { newCount, newHttpsAddress, newText } from '@crgolden/modules/testing';

const oidcFakes = vi.hoisted(() => ({ issuer: `https://${crypto.randomUUID()}.example` }));

vi.mock('./oidc', () => ({
  getOidcConfig: vi.fn().mockResolvedValue({ issuer: oidcFakes.issuer }),
}));

vi.mock('openid-client', () => ({
  refreshTokenGrant: vi.fn(),
}));

vi.mock('../telemetry/logging', () => ({
  logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn() },
}));

import { refreshTokenGrant } from 'openid-client';
import { logger } from '../telemetry/logging';
import { csrfForMutating, directoryProxy } from './proxy';
import {
  AUTHORIZATION_HEADER,
  BEARER_SCHEME,
  bearerAuthorization,
  CONTENT_TYPE_HEADER,
  HopByHopHeaders,
  HttpMethods,
  WWW_AUTHENTICATE_HEADER,
} from './http-headers';
import { COOKIE_HEADER, CSRF_HEADER, CSRF_HEADER_VALUE, MISSING_CSRF_ERROR } from '../shared/bff-contract';
import { DIRECTORY_API_PREFIX, DirectoryApi } from '../shared/directory-api';
import { BffSettingKeys, InvalidSettingError } from './settings';

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
  const method = overrides.method ?? HttpMethods.get;
  const hasBody = !([HttpMethods.get, HttpMethods.head] as string[]).includes(method);
  const bodyChunk = overrides.body ?? (hasBody ? Buffer.from(JSON.stringify({})) : undefined);

  const originalUrl = overrides.originalUrl ?? DirectoryApi.churches;
  const url = originalUrl.slice(DIRECTORY_API_PREFIX.length) || '/';

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
    headers: r.headers ?? new Headers(),
    arrayBuffer: vi.fn().mockResolvedValue(r.body ?? new ArrayBuffer(0)),
  }));
  let call = 0;
  vi.stubGlobal('fetch', vi.fn().mockImplementation(() => Promise.resolve(mocks[call++])));
}

function refreshedTokens(accessToken: string): never {
  return { access_token: accessToken, refresh_token: newText(), expires_in: newCount() } as never;
}

describe('csrfForMutating', () => {
  beforeEach(() => vi.clearAllMocks());

  it('calls next for GET requests without checking X-CSRF', () => {
    const req = makeReq({ method: HttpMethods.get });
    const res = makeRes();
    csrfForMutating(req, res as unknown as Response, mockNext);
    expect(mockNext).toHaveBeenCalledOnce();
    expect(res.status).not.toHaveBeenCalled();
  });

  it('rejects POST requests missing the X-CSRF header with 403', () => {
    const req = makeReq({ method: HttpMethods.post });
    const res = makeRes();
    csrfForMutating(req, res as unknown as Response, mockNext);
    expect(res.status).toHaveBeenCalledWith(HttpStatusCode.Forbidden);
    expect(res.json).toHaveBeenCalledWith({ error: MISSING_CSRF_ERROR });
    expect(mockNext).not.toHaveBeenCalled();
  });

  it('calls next for POST requests that include the X-CSRF header', () => {
    const req = makeReq({ method: HttpMethods.post, headers: { [CSRF_HEADER.toLowerCase()]: CSRF_HEADER_VALUE } });
    const res = makeRes();
    csrfForMutating(req, res as unknown as Response, mockNext);
    expect(mockNext).toHaveBeenCalledOnce();
    expect(res.status).not.toHaveBeenCalled();
  });
});

describe('directoryProxy', () => {
  const savedEnv: Record<string, string | undefined> = {};

  beforeEach(() => {
    savedEnv[BffSettingKeys.DirectoryApiAddress] = process.env[BffSettingKeys.DirectoryApiAddress];
    delete process.env[BffSettingKeys.DirectoryApiAddress];
    vi.clearAllMocks();
  });

  afterEach(() => {
    if (savedEnv[BffSettingKeys.DirectoryApiAddress] === undefined) {
      delete process.env[BffSettingKeys.DirectoryApiAddress];
    } else {
      process.env[BffSettingKeys.DirectoryApiAddress] = savedEnv[BffSettingKeys.DirectoryApiAddress];
    }
    vi.unstubAllGlobals();
  });

  it('throws rather than answering when DirectoryApiAddress is not configured', async () => {
    const req = makeReq();
    const res = makeRes();

    await expect(directoryProxy(req, res as unknown as Response, mockNext)).rejects.toThrow(
      new InvalidSettingError(BffSettingKeys.DirectoryApiAddress),
    );
    expect(res.status).not.toHaveBeenCalled();
  });

  it('fetches anonymously (no Authorization header) when session has no token', async () => {
    process.env[BffSettingKeys.DirectoryApiAddress] = newHttpsAddress();
    stubFetch([{ status: HttpStatusCode.Ok }]);
    const req = makeReq({ session: { accessToken: undefined } });
    const res = makeRes();

    await directoryProxy(req, res as unknown as Response, mockNext);

    const [, fetchOptions] = (vi.mocked(fetch) as ReturnType<typeof vi.fn>).mock.calls[0] as [string, RequestInit];
    expect((fetchOptions.headers as Record<string, string>)[AUTHORIZATION_HEADER]).toBeUndefined();
    expect(res.status).toHaveBeenCalledWith(HttpStatusCode.Ok);
  });

  it('withholds the reader session cookie from Directory while still forwarding other headers', async () => {
    process.env[BffSettingKeys.DirectoryApiAddress] = newHttpsAddress();
    stubFetch([{ status: HttpStatusCode.Ok }]);
    const forwardedHeaderName = newText();
    const forwardedHeaderValue = newText();
    const req = makeReq({
      headers: { [COOKIE_HEADER.toLowerCase()]: `${newText()}=${newText()}`, [forwardedHeaderName]: forwardedHeaderValue },
    });
    const res = makeRes();

    await directoryProxy(req, res as unknown as Response, mockNext);

    const [, fetchOptions] = (vi.mocked(fetch) as ReturnType<typeof vi.fn>).mock.calls[0] as [string, RequestInit];
    const forwarded = fetchOptions.headers as Record<string, string>;
    expect(forwarded[COOKIE_HEADER.toLowerCase()]).toBeUndefined();
    expect(forwarded[forwardedHeaderName]).toBe(forwardedHeaderValue);
  });

  it('attaches Bearer token when session holds an access token', async () => {
    process.env[BffSettingKeys.DirectoryApiAddress] = newHttpsAddress();
    stubFetch([{ status: HttpStatusCode.Ok }]);
    const accessToken = newText();
    const req = makeReq({ session: { accessToken } });
    const res = makeRes();

    await directoryProxy(req, res as unknown as Response, mockNext);

    const [, fetchOptions] = (vi.mocked(fetch) as ReturnType<typeof vi.fn>).mock.calls[0] as [string, RequestInit];
    expect((fetchOptions.headers as Record<string, string>)[AUTHORIZATION_HEADER]).toBe(bearerAuthorization(accessToken));
  });

  it('proactively refreshes a token that is about to expire', async () => {
    process.env[BffSettingKeys.DirectoryApiAddress] = newHttpsAddress();
    stubFetch([{ status: HttpStatusCode.Ok }]);
    const refreshToken = newText();
    const refreshedAccessToken = newText();
    vi.mocked(refreshTokenGrant).mockResolvedValue(refreshedTokens(refreshedAccessToken));

    const req = makeReq({
      session: {
        accessToken: newText(),
        refreshToken,
        tokenExpiresAt: Date.now() + 1,
        save: vi.fn((cb: (err: unknown) => void) => cb(null)),
      },
    });
    const res = makeRes();

    await directoryProxy(req, res as unknown as Response, mockNext);

    expect(refreshTokenGrant).toHaveBeenCalledWith(
      expect.objectContaining({ issuer: oidcFakes.issuer }),
      refreshToken,
    );
    expect((req.session as unknown as SessionLike).accessToken).toBe(refreshedAccessToken);
  });

  it('retries with a refreshed token on a bearer-token 401 (WWW-Authenticate present)', async () => {
    process.env[BffSettingKeys.DirectoryApiAddress] = newHttpsAddress();
    const upstreamResponses = [
      { status: HttpStatusCode.Unauthorized, headers: new Headers({ [WWW_AUTHENTICATE_HEADER]: BEARER_SCHEME }) },
      { status: HttpStatusCode.Ok },
    ];
    stubFetch(upstreamResponses);
    vi.mocked(refreshTokenGrant).mockResolvedValue(refreshedTokens(newText()));

    const req = makeReq({
      session: {
        accessToken: newText(),
        refreshToken: newText(),
        save: vi.fn((cb: (err: unknown) => void) => cb(null)),
      },
    });
    const res = makeRes();

    await directoryProxy(req, res as unknown as Response, mockNext);

    expect(vi.mocked(fetch)).toHaveBeenCalledTimes(upstreamResponses.length);
    expect(res.status).toHaveBeenCalledWith(HttpStatusCode.Ok);
  });

  it('forwards the 401 without retry when no refresh token is available', async () => {
    process.env[BffSettingKeys.DirectoryApiAddress] = newHttpsAddress();
    stubFetch([{ status: HttpStatusCode.Unauthorized, headers: new Headers({ [WWW_AUTHENTICATE_HEADER]: BEARER_SCHEME }) }]);

    const req = makeReq({
      session: { accessToken: newText(), refreshToken: undefined },
    });
    const res = makeRes();

    await directoryProxy(req, res as unknown as Response, mockNext);

    expect(vi.mocked(fetch)).toHaveBeenCalledOnce();
    expect(res.status).toHaveBeenCalledWith(HttpStatusCode.Unauthorized);
    expect(refreshTokenGrant).not.toHaveBeenCalled();
  });

  it('does not retry a domain-level 401 lacking WWW-Authenticate (a moderation route refusing its subject)', async () => {
    process.env[BffSettingKeys.DirectoryApiAddress] = newHttpsAddress();
    stubFetch([{ status: HttpStatusCode.Unauthorized }]);

    const req = makeReq({
      method: HttpMethods.post,
      headers: { [CSRF_HEADER]: CSRF_HEADER_VALUE },
      session: { accessToken: newText(), refreshToken: newText() },
    });
    const res = makeRes();

    await directoryProxy(req, res as unknown as Response, mockNext);

    expect(vi.mocked(fetch)).toHaveBeenCalledOnce();
    expect(res.status).toHaveBeenCalledWith(HttpStatusCode.Unauthorized);
    expect(refreshTokenGrant).not.toHaveBeenCalled();
  });

  it('forwards non-dropped response headers and strips hop-by-hop headers', async () => {
    process.env[BffSettingKeys.DirectoryApiAddress] = newHttpsAddress();
    const contentType = newText();
    const customHeaderName = newText();
    const customHeaderValue = newText();
    const responseHeaders = new Headers({
      [CONTENT_TYPE_HEADER]: contentType,
      [HopByHopHeaders.connection]: HopByHopHeaders.keepAlive,
      [customHeaderName]: customHeaderValue,
    });
    stubFetch([{ status: HttpStatusCode.Ok, headers: responseHeaders }]);

    const req = makeReq();
    const res = makeRes();

    await directoryProxy(req, res as unknown as Response, mockNext);

    expect(res.setHeader).toHaveBeenCalledWith(CONTENT_TYPE_HEADER.toLowerCase(), contentType);
    expect(res.setHeader).toHaveBeenCalledWith(customHeaderName, customHeaderValue);
    expect(res.setHeader).not.toHaveBeenCalledWith(HopByHopHeaders.connection, expect.anything());
  });

  it('strips Content-Encoding and Content-Length since fetch() already decompressed the body', async () => {
    process.env[BffSettingKeys.DirectoryApiAddress] = newHttpsAddress();
    const contentType = newText();
    const responseHeaders = new Headers({
      [CONTENT_TYPE_HEADER]: contentType,
      [HopByHopHeaders.contentEncoding]: newText(),
      [HopByHopHeaders.contentLength]: String(newCount()),
    });
    stubFetch([{ status: HttpStatusCode.Ok, headers: responseHeaders }]);

    const req = makeReq();
    const res = makeRes();

    await directoryProxy(req, res as unknown as Response, mockNext);

    expect(res.setHeader).toHaveBeenCalledWith(CONTENT_TYPE_HEADER.toLowerCase(), contentType);
    expect(res.setHeader).not.toHaveBeenCalledWith(HopByHopHeaders.contentEncoding, expect.anything());
    expect(res.setHeader).not.toHaveBeenCalledWith(HopByHopHeaders.contentLength, expect.anything());
  });

  it('removes stale Authorization from forwarded headers when no session token', async () => {
    process.env[BffSettingKeys.DirectoryApiAddress] = newHttpsAddress();
    stubFetch([{ status: HttpStatusCode.Ok }]);

    const req = makeReq({
      headers: { [AUTHORIZATION_HEADER]: bearerAuthorization(newText()) },
      session: { accessToken: undefined },
    });
    const res = makeRes();

    await directoryProxy(req, res as unknown as Response, mockNext);

    const [, fetchOptions] = (vi.mocked(fetch) as ReturnType<typeof vi.fn>).mock.calls[0] as [string, RequestInit];
    expect((fetchOptions.headers as Record<string, string>)[AUTHORIZATION_HEADER]).toBeUndefined();
  });

  it('joins multi-value request headers into a comma-separated string', async () => {
    process.env[BffSettingKeys.DirectoryApiAddress] = newHttpsAddress();
    stubFetch([{ status: HttpStatusCode.Ok }]);

    const multiValueHeaderName = newText();
    const firstValue = crypto.randomUUID();
    const secondValue = crypto.randomUUID();
    const req = makeReq({
      headers: { [multiValueHeaderName]: [firstValue, secondValue] as unknown as string },
    });
    const res = makeRes();

    await directoryProxy(req, res as unknown as Response, mockNext);

    const [, fetchOptions] = (vi.mocked(fetch) as ReturnType<typeof vi.fn>).mock.calls[0] as [string, RequestInit];
    expect((fetchOptions.headers as Record<string, string>)[multiValueHeaderName]).toBe(`${firstValue}, ${secondValue}`);
  });

  it('forwards the 401 and warns when the token refresh during retry fails', async () => {
    process.env[BffSettingKeys.DirectoryApiAddress] = newHttpsAddress();
    stubFetch([{ status: HttpStatusCode.Unauthorized, headers: new Headers({ [WWW_AUTHENTICATE_HEADER]: BEARER_SCHEME }) }]);
    const refreshError = new Error(newText());
    vi.mocked(refreshTokenGrant).mockRejectedValueOnce(refreshError);

    const req = makeReq({
      session: {
        accessToken: newText(),
        refreshToken: newText(),
        save: vi.fn((cb: (err: unknown) => void) => cb(null)),
      },
    });
    const res = makeRes();

    await directoryProxy(req, res as unknown as Response, mockNext);

    expect(logger.warn).toHaveBeenCalledWith({ err: refreshError }, expect.any(String));
    expect(res.status).toHaveBeenCalledWith(HttpStatusCode.Unauthorized);
  });

  it('buffers a POST body from string chunks and forwards it', async () => {
    process.env[BffSettingKeys.DirectoryApiAddress] = newHttpsAddress();
    stubFetch([{ status: HttpStatusCode.Created }]);

    const req = makeReq({
      method: HttpMethods.post,
      headers: { [CSRF_HEADER.toLowerCase()]: CSRF_HEADER_VALUE },
      session: { accessToken: newText() },
      body: undefined,
    });

    const streamingReq = req as unknown as { [Symbol.asyncIterator]: () => AsyncGenerator<string> };
    const bodyText = JSON.stringify({ [newText()]: newText() });
    streamingReq[Symbol.asyncIterator] = async function* () {
      yield bodyText;
    };

    const res = makeRes();

    await directoryProxy(req, res as unknown as Response, mockNext);

    expect(res.status).toHaveBeenCalledWith(HttpStatusCode.Created);
    const [, fetchOptions] = (vi.mocked(fetch) as ReturnType<typeof vi.fn>).mock.calls[0] as [string, RequestInit];
    expect(fetchOptions.body).toBeInstanceOf(Uint8Array);
  });
});
