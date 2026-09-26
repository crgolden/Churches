import { HttpStatusCode } from '@angular/common/http';
import type { Request, Response, NextFunction } from 'express';
import { newCount, newHostname, newText } from '@crgolden/modules/testing';

const capturedHandlers = new Map<string, ((...args: unknown[]) => unknown)[]>();

function handlersRegisteredFor(path: string): ((...args: unknown[]) => unknown)[] {
  const fns = capturedHandlers.get(path);
  if (fns === undefined) {
    throw new Error(`No handler was registered for ${path}`);
  }
  return fns;
}

const oidcFakes = vi.hoisted(() => {
  const issuer = `https://${crypto.randomUUID()}.example`;
  return {
    issuer,
    authorizationUrl: `${issuer}/${crypto.randomUUID()}`,
    endSessionUrl: `${issuer}/${crypto.randomUUID()}`,
    codeVerifier: crypto.randomUUID(),
    codeChallenge: crypto.randomUUID(),
    oauthState: crypto.randomUUID(),
  };
});

vi.mock('express', () => ({
  Router: vi.fn(() => ({
    get: vi.fn((path: string, ...fns: ((...args: unknown[]) => unknown)[]) => {
      capturedHandlers.set(path, fns);
    }),
  })),
}));

vi.mock('./oidc', () => ({
  getOidcConfig: vi.fn().mockResolvedValue({ issuer: oidcFakes.issuer }),
}));

vi.mock('openid-client', () => ({
  buildAuthorizationUrl: vi.fn().mockReturnValue(new URL(oidcFakes.authorizationUrl)),
  authorizationCodeGrant: vi.fn(),
  buildEndSessionUrl: vi.fn().mockReturnValue(new URL(oidcFakes.endSessionUrl)),
  fetchUserInfo: vi.fn(),
  randomPKCECodeVerifier: vi.fn().mockReturnValue(oidcFakes.codeVerifier),
  calculatePKCECodeChallenge: vi.fn().mockResolvedValue(oidcFakes.codeChallenge),
  randomState: vi.fn().mockReturnValue(oidcFakes.oauthState),
}));

vi.mock('../telemetry/logging', () => ({
  logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn() },
}));

import { getOidcConfig } from './oidc';
import {
  authorizationCodeGrant,
  buildEndSessionUrl,
  fetchUserInfo,
} from 'openid-client';
import { BffErrors, buildBffRouter, ID_TOKEN_HINT_PARAMETER, JwtEncodings, requireCsrf } from './routes';
import {
  BffPaths,
  BffRoutes,
  ClaimTypes,
  CSRF_HEADER,
  CSRF_HEADER_VALUE,
  MISSING_CSRF_ERROR,
  MODERATOR_CLAIM_VALUE,
  SID_QUERY_PARAMETER,
} from '../shared/bff-contract';

interface Session {
  pkceCodeVerifier?: string;
  oauthState?: string;
  accessToken?: string;
  refreshToken?: string;
  idToken?: string;
  tokenExpiresAt?: number;
  claims?: { type: string; value: string }[];
  save: ReturnType<typeof vi.fn>;
  destroy: ReturnType<typeof vi.fn>;
}

interface TokenSet {
  accessToken: string;
  refreshToken: string;
  idToken: string;
}

function newTokenSet(accessToken: string = newText()): TokenSet {
  return { accessToken, refreshToken: newText(), idToken: newText() };
}

function grantResponse(tokens: TokenSet, idClaims: Record<string, unknown>): never {
  return {
    access_token: tokens.accessToken,
    refresh_token: tokens.refreshToken,
    id_token: tokens.idToken,
    expires_in: newCount(),
    claims: () => idClaims,
  } as never;
}

function accessTokenCarrying(claims: Record<string, unknown>): string {
  const payload = Buffer.from(JSON.stringify(claims), JwtEncodings.text).toString(JwtEncodings.segment);
  return `${newText()}.${payload}.${newText()}`;
}

function pendingSignIn(): Partial<Session> {
  return { pkceCodeVerifier: oidcFakes.codeVerifier, oauthState: oidcFakes.oauthState };
}

function makeSession(overrides: Partial<Session> = {}): Session {
  return {
    save: vi.fn((cb: (err: unknown) => void) => cb(null)),
    destroy: vi.fn((cb: (err: unknown) => void) => cb(null)),
    ...overrides,
  };
}

function makeReq(overrides: {
  headers?: Record<string, string>;
  session?: Partial<Session>;
  query?: Record<string, string>;
  originalUrl?: string;
  sessionID?: string;
} = {}): Request {
  return {
    headers: { host: newHostname(), ...(overrides.headers ?? {}) },
    protocol: newText(),
    session: makeSession(overrides.session),
    sessionID: overrides.sessionID ?? newText(),
    query: overrides.query ?? {},
    originalUrl: overrides.originalUrl ?? `${BffPaths.callback}?${new URLSearchParams({ state: oidcFakes.oauthState }).toString()}`,
  } as unknown as Request;
}

function makeRes() {
  return {
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
    redirect: vi.fn(),
    end: vi.fn(),
  };
}

const mockNext = vi.fn() as unknown as NextFunction;

beforeAll(() => {
  buildBffRouter();
});

beforeEach(() => {
  vi.clearAllMocks();
});

describe('requireCsrf', () => {
  it('calls next when X-CSRF header is present', () => {
    const req = makeReq({ headers: { [CSRF_HEADER.toLowerCase()]: CSRF_HEADER_VALUE } });
    const res = makeRes();

    requireCsrf(req, res as unknown as Response, mockNext);

    expect(mockNext).toHaveBeenCalledOnce();
    expect(res.status).not.toHaveBeenCalled();
  });

  it('responds 403 when X-CSRF header is absent', () => {
    const req = makeReq();
    const res = makeRes();

    requireCsrf(req, res as unknown as Response, mockNext);

    expect(res.status).toHaveBeenCalledWith(HttpStatusCode.Forbidden);
    expect(res.json).toHaveBeenCalledWith({ error: MISSING_CSRF_ERROR });
    expect(mockNext).not.toHaveBeenCalled();
  });
});

describe(BffPaths.login, () => {
  function handler() {
    const fns = handlersRegisteredFor(BffRoutes.login);
    return fns[fns.length - 1] as (req: Request, res: Response) => Promise<void>;
  }

  it('saves PKCE state to session and redirects to the authorization URL', async () => {
    const req = makeReq();
    const res = makeRes();

    await handler()(req, res as unknown as Response);

    const session = req.session as unknown as Session;
    expect(session.pkceCodeVerifier).toBe(oidcFakes.codeVerifier);
    expect(session.oauthState).toBe(oidcFakes.oauthState);
    expect(session.save).toHaveBeenCalledOnce();
    expect(res.redirect).toHaveBeenCalledWith(new URL(oidcFakes.authorizationUrl).href);
  });

  it('responds 500 when OIDC configuration fails', async () => {
    vi.mocked(getOidcConfig).mockRejectedValueOnce(new Error(newText()));
    const req = makeReq();
    const res = makeRes();

    await handler()(req, res as unknown as Response);

    expect(res.status).toHaveBeenCalledWith(HttpStatusCode.InternalServerError);
    expect(res.json).toHaveBeenCalledWith({ error: BffErrors.loginFailed });
  });
});

describe(BffPaths.callback, () => {
  function handler() {
    const fns = handlersRegisteredFor(BffRoutes.callback);
    return fns[fns.length - 1] as (req: Request, res: Response) => Promise<void>;
  }

  it('responds 400 when PKCE verifier or OAuth state is missing from the session', async () => {
    const req = makeReq({ session: { pkceCodeVerifier: undefined, oauthState: undefined } });
    const res = makeRes();

    await handler()(req, res as unknown as Response);

    expect(res.status).toHaveBeenCalledWith(HttpStatusCode.BadRequest);
    expect(res.json).toHaveBeenCalledWith({ error: BffErrors.invalidSessionState });
  });

  it('responds 500 when the ID token has no sub claim', async () => {
    vi.mocked(authorizationCodeGrant).mockResolvedValueOnce(grantResponse(newTokenSet(), { [newText()]: newText() }));
    const req = makeReq({ session: pendingSignIn() });
    const res = makeRes();

    await handler()(req, res as unknown as Response);

    expect(res.status).toHaveBeenCalledWith(HttpStatusCode.InternalServerError);
    expect(res.json).toHaveBeenCalledWith({ error: BffErrors.missingSub });
  });

  it('stores tokens in session and redirects to "/" on success', async () => {
    const tokens = newTokenSet();
    const subject = newText();
    vi.mocked(authorizationCodeGrant).mockResolvedValueOnce(grantResponse(tokens, { [ClaimTypes.subject]: subject }));
    vi.mocked(fetchUserInfo).mockResolvedValueOnce({ [ClaimTypes.subject]: subject, [ClaimTypes.name]: newText() });

    const req = makeReq({ session: pendingSignIn() });
    const res = makeRes();

    await handler()(req, res as unknown as Response);

    const session = req.session as unknown as Session;
    expect(session.accessToken).toBe(tokens.accessToken);
    expect(session.refreshToken).toBe(tokens.refreshToken);
    expect(session.idToken).toBe(tokens.idToken);
    expect(session.pkceCodeVerifier).toBeUndefined();
    expect(session.oauthState).toBeUndefined();
    expect(session.save).toHaveBeenCalledOnce();
    expect(res.redirect).toHaveBeenCalledWith('/');
  });

  it('responds 500 when authorizationCodeGrant throws', async () => {
    vi.mocked(authorizationCodeGrant).mockRejectedValueOnce(new Error(newText()));
    const req = makeReq({ session: pendingSignIn() });
    const res = makeRes();

    await handler()(req, res as unknown as Response);

    expect(res.status).toHaveBeenCalledWith(HttpStatusCode.InternalServerError);
    expect(res.json).toHaveBeenCalledWith({ error: BffErrors.callbackFailed });
  });

  it('flattens array claim values into one entry per element', async () => {
    const subject = newText();
    const arrayClaimType = newText();
    const arrayClaimValues = [newText(), newText()];
    vi.mocked(authorizationCodeGrant).mockResolvedValueOnce(
      grantResponse(newTokenSet(), { [ClaimTypes.subject]: subject, [arrayClaimType]: arrayClaimValues }),
    );
    vi.mocked(fetchUserInfo).mockResolvedValueOnce({ [ClaimTypes.subject]: subject });

    const req = makeReq({ session: pendingSignIn() });
    const res = makeRes();

    await handler()(req, res as unknown as Response);

    const session = req.session as unknown as Session;
    const flattened = (session.claims ?? []).filter(c => c.type === arrayClaimType);
    expect(flattened).toEqual(arrayClaimValues.map(value => ({ type: arrayClaimType, value })));
  });

  it('takes churches.mod from the access token, so it does not depend on the profile identity resource', async () => {
    const subject = newText();
    const accessToken = accessTokenCarrying({ [ClaimTypes.moderator]: MODERATOR_CLAIM_VALUE });
    vi.mocked(authorizationCodeGrant).mockResolvedValueOnce(
      grantResponse(newTokenSet(accessToken), { [ClaimTypes.subject]: subject }),
    );
    vi.mocked(fetchUserInfo).mockResolvedValueOnce({ [ClaimTypes.subject]: subject });

    const req = makeReq({ session: pendingSignIn() });
    const res = makeRes();

    await handler()(req, res as unknown as Response);

    const session = req.session as unknown as Session;
    expect(session.claims).toContainEqual({ type: ClaimTypes.moderator, value: MODERATOR_CLAIM_VALUE });
  });

  it('copies only the allowlisted access-token claims into the session', async () => {
    const subject = newText();
    const unlistedClaimType = newText();
    const accessToken = accessTokenCarrying({
      [ClaimTypes.moderator]: MODERATOR_CLAIM_VALUE,
      [unlistedClaimType]: newText(),
    });
    vi.mocked(authorizationCodeGrant).mockResolvedValueOnce(
      grantResponse(newTokenSet(accessToken), { [ClaimTypes.subject]: subject }),
    );
    vi.mocked(fetchUserInfo).mockResolvedValueOnce({ [ClaimTypes.subject]: subject });

    const req = makeReq({ session: pendingSignIn() });
    const res = makeRes();

    await handler()(req, res as unknown as Response);

    const types = ((req.session as unknown as Session).claims ?? []).map(c => c.type);
    expect(types).not.toContain(unlistedClaimType);
  });

  it('still stores the other claims when the access token is not a decodable JWT', async () => {
    const subject = newText();
    vi.mocked(authorizationCodeGrant).mockResolvedValueOnce(
      grantResponse(newTokenSet(newText()), { [ClaimTypes.subject]: subject }),
    );
    vi.mocked(fetchUserInfo).mockResolvedValueOnce({ [ClaimTypes.subject]: subject });

    const req = makeReq({ session: pendingSignIn() });
    const res = makeRes();

    await handler()(req, res as unknown as Response);

    const session = req.session as unknown as Session;
    expect(session.claims).toContainEqual({ type: ClaimTypes.subject, value: subject });
  });
});

describe(BffPaths.user, () => {
  function handler() {
    const fns = handlersRegisteredFor(BffRoutes.user);
    return fns[1] as (req: Request, res: Response) => void;
  }

  it('answers an anonymous visitor with 200 and a null body, so the browser logs no failed request', () => {
    const req = makeReq({ session: { claims: undefined } });
    const res = makeRes();

    handler()(req, res as unknown as Response);

    expect(res.status).not.toHaveBeenCalled();
    expect(res.json).toHaveBeenCalledExactlyOnceWith(null);
  });

  it('builds bff:logout_url from the provider sid claim, never the express session id', () => {
    const expressSessionId = newText();
    const providerSessionId = newText();
    const req = makeReq({
      sessionID: expressSessionId,
      session: {
        claims: [
          { type: ClaimTypes.subject, value: newText() },
          { type: ClaimTypes.sid, value: providerSessionId },
        ],
      },
    });
    const res = makeRes();

    handler()(req, res as unknown as Response);

    expect(res.json).toHaveBeenCalledWith(
      expect.arrayContaining([
        { type: ClaimTypes.logoutUrl, value: `${BffPaths.logout}?${SID_QUERY_PARAMETER}=${providerSessionId}` },
      ]),
    );
    const [emitted] = vi.mocked(res.json).mock.calls[0] as [{ type: string; value: string }[]];
    expect(JSON.stringify(emitted)).not.toContain(expressSessionId);
  });

  it('omits the sid parameter entirely when the provider issued no sid claim', () => {
    const req = makeReq({ session: { claims: [{ type: ClaimTypes.subject, value: newText() }] } });
    const res = makeRes();

    handler()(req, res as unknown as Response);

    expect(res.json).toHaveBeenCalledWith(
      expect.arrayContaining([{ type: ClaimTypes.logoutUrl, value: BffPaths.logout }]),
    );
  });
});

describe(BffPaths.logout, () => {
  function handler() {
    const fns = handlersRegisteredFor(BffRoutes.logout);
    return fns[fns.length - 1] as (req: Request, res: Response) => Promise<void>;
  }

  it('responds 400 when the sid query parameter is absent and the session carries a sid claim', async () => {
    const req = makeReq({
      query: {},
      session: { claims: [{ type: ClaimTypes.sid, value: newText() }] },
    });
    const res = makeRes();

    await handler()(req, res as unknown as Response);

    expect(res.status).toHaveBeenCalledWith(HttpStatusCode.BadRequest);
    expect(res.json).toHaveBeenCalledWith({ error: BffErrors.invalidSessionIdentifier });
  });

  it('responds 400 when sid does not match the provider sid claim', async () => {
    const providerSessionId = newText();
    const mismatchedSessionId = newText();
    const req = makeReq({
      query: { [SID_QUERY_PARAMETER]: mismatchedSessionId },
      session: { claims: [{ type: ClaimTypes.sid, value: providerSessionId }] },
    });
    const res = makeRes();

    await handler()(req, res as unknown as Response);

    expect(res.status).toHaveBeenCalledWith(HttpStatusCode.BadRequest);
    expect(res.json).toHaveBeenCalledWith({ error: BffErrors.invalidSessionIdentifier });
  });

  it('responds 400 when sid carries the express session id rather than the provider sid', async () => {
    const expressSessionId = newText();
    const req = makeReq({
      sessionID: expressSessionId,
      query: { [SID_QUERY_PARAMETER]: expressSessionId },
      session: { claims: [{ type: ClaimTypes.sid, value: newText() }] },
    });
    const res = makeRes();

    await handler()(req, res as unknown as Response);

    expect(res.status).toHaveBeenCalledWith(HttpStatusCode.BadRequest);
    expect(res.json).toHaveBeenCalledWith({ error: BffErrors.invalidSessionIdentifier });
  });

  it('destroys the session and redirects with id_token_hint when an ID token is stored', async () => {
    const providerSessionId = newText();
    const idToken = newText();
    const endSessionUrl = new URL(`${oidcFakes.issuer}/${newText()}`);
    vi.mocked(buildEndSessionUrl).mockReturnValueOnce(endSessionUrl);

    const req = makeReq({
      query: { [SID_QUERY_PARAMETER]: providerSessionId },
      session: { idToken, claims: [{ type: ClaimTypes.sid, value: providerSessionId }] },
    });
    const res = makeRes();

    await handler()(req, res as unknown as Response);

    expect((req.session as unknown as Session).destroy).toHaveBeenCalledOnce();
    expect(buildEndSessionUrl).toHaveBeenCalledWith(
      expect.objectContaining({ issuer: oidcFakes.issuer }),
      expect.objectContaining({ [ID_TOKEN_HINT_PARAMETER]: idToken }),
    );
    expect(res.redirect).toHaveBeenCalledWith(endSessionUrl.href);
  });

  it('falls back to redirect("/") when OIDC configuration throws during logout', async () => {
    const providerSessionId = newText();
    vi.mocked(getOidcConfig).mockRejectedValueOnce(new Error(newText()));

    const req = makeReq({
      query: { [SID_QUERY_PARAMETER]: providerSessionId },
      session: { idToken: undefined, claims: [{ type: ClaimTypes.sid, value: providerSessionId }] },
    });
    const res = makeRes();

    await handler()(req, res as unknown as Response);

    expect(res.redirect).toHaveBeenCalledWith('/');
  });

  it('redirects without id_token_hint when no ID token is in the session', async () => {
    const providerSessionId = newText();
    vi.mocked(buildEndSessionUrl).mockReturnValueOnce(new URL(`${oidcFakes.issuer}/${newText()}`));

    const req = makeReq({
      query: { [SID_QUERY_PARAMETER]: providerSessionId },
      session: { idToken: undefined, claims: [{ type: ClaimTypes.sid, value: providerSessionId }] },
    });
    const res = makeRes();

    await handler()(req, res as unknown as Response);

    const [, params] = vi.mocked(buildEndSessionUrl).mock.calls[0] as [unknown, Record<string, string>];
    expect(params[ID_TOKEN_HINT_PARAMETER]).toBeUndefined();
    expect(res.redirect).toHaveBeenCalledOnce();
  });
});
