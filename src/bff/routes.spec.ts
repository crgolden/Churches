import type { Request, Response, NextFunction } from 'express';

// ── Handler capture ───────────────────────────────────────────────────────────
// The Router mock stores every registered handler so tests can invoke them directly.

const capturedHandlers = new Map<string, ((...args: unknown[]) => unknown)[]>();

vi.mock('express', () => ({
  Router: vi.fn(() => ({
    get: vi.fn((path: string, ...fns: ((...args: unknown[]) => unknown)[]) => {
      capturedHandlers.set(path, fns);
    }),
  })),
}));

// ── Mocks (hoisted before imports) ────────────────────────────────────────────

vi.mock('./oidc', () => ({
  getOidcConfig: vi.fn().mockResolvedValue({ issuer: 'https://identity.example.com' }),
}));

vi.mock('openid-client', () => ({
  buildAuthorizationUrl: vi.fn().mockReturnValue(
    new URL('https://identity.example.com/connect/authorize?x=1'),
  ),
  authorizationCodeGrant: vi.fn(),
  buildEndSessionUrl: vi.fn().mockReturnValue(
    new URL('https://identity.example.com/connect/endsession?y=1'),
  ),
  fetchUserInfo: vi.fn(),
  randomPKCECodeVerifier: vi.fn().mockReturnValue('pkce-verifier'),
  calculatePKCECodeChallenge: vi.fn().mockResolvedValue('pkce-challenge'),
  randomState: vi.fn().mockReturnValue('oauth-state'),
}));

import { getOidcConfig } from './oidc';
import {
  authorizationCodeGrant,
  buildEndSessionUrl,
  fetchUserInfo,
} from 'openid-client';
import { buildBffRouter, requireCsrf } from './routes';

// ── Helpers ───────────────────────────────────────────────────────────────────

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
    headers: { host: 'localhost:4000', ...(overrides.headers ?? {}) },
    protocol: 'https',
    session: makeSession(overrides.session),
    sessionID: overrides.sessionID ?? 'session-id-abc',
    query: overrides.query ?? {},
    originalUrl: overrides.originalUrl ?? '/bff/callback?code=xyz&state=oauth-state',
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

// ── Setup ─────────────────────────────────────────────────────────────────────

beforeAll(() => {
  buildBffRouter();
});

beforeEach(() => {
  vi.clearAllMocks();
});

// ── requireCsrf ───────────────────────────────────────────────────────────────

describe('requireCsrf', () => {
  it('calls next when X-CSRF header is present', () => {
    const req = makeReq({ headers: { 'x-csrf': '1' } });
    const res = makeRes();

    requireCsrf(req, res as unknown as Response, mockNext);

    expect(mockNext).toHaveBeenCalledOnce();
    expect(res.status).not.toHaveBeenCalled();
  });

  it('responds 403 when X-CSRF header is absent', () => {
    const req = makeReq();
    const res = makeRes();

    requireCsrf(req, res as unknown as Response, mockNext);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({ error: 'Missing X-CSRF header' });
    expect(mockNext).not.toHaveBeenCalled();
  });
});

// ── /bff/login ────────────────────────────────────────────────────────────────

describe('/bff/login', () => {
  function handler() {
    const fns = capturedHandlers.get('/login')!;
    return fns[fns.length - 1] as (req: Request, res: Response) => Promise<void>;
  }

  it('saves PKCE state to session and redirects to the authorization URL', async () => {
    const req = makeReq();
    const res = makeRes();

    await handler()(req, res as unknown as Response);

    const session = req.session as unknown as Session;
    expect(session.pkceCodeVerifier).toBe('pkce-verifier');
    expect(session.oauthState).toBe('oauth-state');
    expect(session.save).toHaveBeenCalledOnce();
    expect(res.redirect).toHaveBeenCalledWith(
      'https://identity.example.com/connect/authorize?x=1',
    );
  });

  it('responds 500 when OIDC configuration fails', async () => {
    vi.mocked(getOidcConfig).mockRejectedValueOnce(new Error('discovery failed'));
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const req = makeReq();
    const res = makeRes();

    await handler()(req, res as unknown as Response);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ error: 'Login initiation failed' });
    consoleSpy.mockRestore();
  });
});

// ── /bff/callback ─────────────────────────────────────────────────────────────

describe('/bff/callback', () => {
  function handler() {
    const fns = capturedHandlers.get('/callback')!;
    return fns[fns.length - 1] as (req: Request, res: Response) => Promise<void>;
  }

  it('responds 400 when PKCE verifier or OAuth state is missing from the session', async () => {
    const req = makeReq({ session: { pkceCodeVerifier: undefined, oauthState: undefined } });
    const res = makeRes();

    await handler()(req, res as unknown as Response);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: 'Invalid or expired session state' });
  });

  it('responds 500 when the ID token has no sub claim', async () => {
    vi.mocked(authorizationCodeGrant).mockResolvedValueOnce({
      access_token: 'access',
      refresh_token: 'refresh',
      id_token: 'id',
      expires_in: 3600,
      claims: () => ({ iss: 'https://identity.example.com' }), // no sub
    } as never);
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const req = makeReq({
      session: { pkceCodeVerifier: 'pkce-verifier', oauthState: 'oauth-state' },
    });
    const res = makeRes();

    await handler()(req, res as unknown as Response);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ error: 'Missing sub claim in ID token' });
    consoleSpy.mockRestore();
  });

  it('stores tokens in session and redirects to "/" on success', async () => {
    vi.mocked(authorizationCodeGrant).mockResolvedValueOnce({
      access_token: 'access-tok',
      refresh_token: 'refresh-tok',
      id_token: 'id-tok',
      expires_in: 3600,
      claims: () => ({ sub: 'user-123', email: 'user@example.com' }),
    } as never);
    vi.mocked(fetchUserInfo).mockResolvedValueOnce({ sub: 'user-123', name: 'Alice' });

    const req = makeReq({
      session: { pkceCodeVerifier: 'pkce-verifier', oauthState: 'oauth-state' },
    });
    const res = makeRes();

    await handler()(req, res as unknown as Response);

    const session = req.session as unknown as Session;
    expect(session.accessToken).toBe('access-tok');
    expect(session.refreshToken).toBe('refresh-tok');
    expect(session.idToken).toBe('id-tok');
    expect(session.pkceCodeVerifier).toBeUndefined();
    expect(session.oauthState).toBeUndefined();
    expect(session.save).toHaveBeenCalledOnce();
    expect(res.redirect).toHaveBeenCalledWith('/');
  });

  it('responds 500 when authorizationCodeGrant throws', async () => {
    vi.mocked(authorizationCodeGrant).mockRejectedValueOnce(new Error('code exchange failed'));
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const req = makeReq({
      session: { pkceCodeVerifier: 'pkce-verifier', oauthState: 'oauth-state' },
    });
    const res = makeRes();

    await handler()(req, res as unknown as Response);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ error: 'Callback processing failed' });
    consoleSpy.mockRestore();
  });

  it('flattens array claim values into one entry per element', async () => {
    vi.mocked(authorizationCodeGrant).mockResolvedValueOnce({
      access_token: 'access-tok',
      refresh_token: 'refresh-tok',
      id_token: 'id-tok',
      expires_in: 3600,
      claims: () => ({ sub: 'user-123', role: ['admin', 'user'] }),
    } as never);
    vi.mocked(fetchUserInfo).mockResolvedValueOnce({ sub: 'user-123' });

    const req = makeReq({
      session: { pkceCodeVerifier: 'pkce-verifier', oauthState: 'oauth-state' },
    });
    const res = makeRes();

    await handler()(req, res as unknown as Response);

    const session = req.session as unknown as Session;
    const roleClaims = (session.claims ?? []).filter(c => c.type === 'role');
    expect(roleClaims).toEqual([
      { type: 'role', value: 'admin' },
      { type: 'role', value: 'user' },
    ]);
  });
});

// ── /bff/user ─────────────────────────────────────────────────────────────────

describe('/bff/user', () => {
  // handlers[0] = requireCsrf (the exported function), handlers[1] = the user handler
  function handler() {
    const fns = capturedHandlers.get('/user')!;
    return fns[1] as (req: Request, res: Response) => void;
  }

  it('responds 401 when no claims are stored in the session', () => {
    const req = makeReq({ session: { claims: undefined } });
    const res = makeRes();

    handler()(req, res as unknown as Response);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.end).toHaveBeenCalledOnce();
  });

  it('returns claims array including bff:logout_url when authenticated', () => {
    const req = makeReq({
      sessionID: 'test-session-id',
      session: { claims: [{ type: 'sub', value: 'user-123' }] },
    });
    const res = makeRes();

    handler()(req, res as unknown as Response);

    expect(res.json).toHaveBeenCalledWith(
      expect.arrayContaining([
        { type: 'sub', value: 'user-123' },
        { type: 'bff:logout_url', value: '/bff/logout?sid=test-session-id' },
      ]),
    );
  });
});

// ── /bff/logout ───────────────────────────────────────────────────────────────

describe('/bff/logout', () => {
  function handler() {
    const fns = capturedHandlers.get('/logout')!;
    return fns[fns.length - 1] as (req: Request, res: Response) => Promise<void>;
  }

  it('responds 400 when the sid query parameter is absent', async () => {
    const req = makeReq({ sessionID: 'session-id-abc', query: {} });
    const res = makeRes();

    await handler()(req, res as unknown as Response);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: 'Invalid session identifier' });
  });

  it('responds 400 when sid does not match the current sessionID', async () => {
    const req = makeReq({
      sessionID: 'real-session-id',
      query: { sid: 'wrong-session-id' },
    });
    const res = makeRes();

    await handler()(req, res as unknown as Response);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: 'Invalid session identifier' });
  });

  it('destroys the session and redirects with id_token_hint when an ID token is stored', async () => {
    vi.mocked(buildEndSessionUrl).mockReturnValueOnce(
      new URL('https://identity.example.com/connect/endsession?hint=id-tok'),
    );

    const req = makeReq({
      sessionID: 'valid-session-id',
      query: { sid: 'valid-session-id' },
      session: { idToken: 'id-tok' },
    });
    const res = makeRes();

    await handler()(req, res as unknown as Response);

    expect((req.session as unknown as Session).destroy).toHaveBeenCalledOnce();
    expect(buildEndSessionUrl).toHaveBeenCalledWith(
      expect.objectContaining({ issuer: 'https://identity.example.com' }),
      expect.objectContaining({ id_token_hint: 'id-tok' }),
    );
    expect(res.redirect).toHaveBeenCalledWith(
      'https://identity.example.com/connect/endsession?hint=id-tok',
    );
  });

  it('falls back to redirect("/") when OIDC configuration throws during logout', async () => {
    vi.mocked(getOidcConfig).mockRejectedValueOnce(new Error('oidc down'));
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    const req = makeReq({
      sessionID: 'valid-session-id',
      query: { sid: 'valid-session-id' },
      session: { idToken: undefined },
    });
    const res = makeRes();

    await handler()(req, res as unknown as Response);

    expect(res.redirect).toHaveBeenCalledWith('/');
    consoleSpy.mockRestore();
  });

  it('redirects without id_token_hint when no ID token is in the session', async () => {
    vi.mocked(buildEndSessionUrl).mockReturnValueOnce(
      new URL('https://identity.example.com/connect/endsession?no-hint'),
    );

    const req = makeReq({
      sessionID: 'valid-session-id',
      query: { sid: 'valid-session-id' },
      session: { idToken: undefined },
    });
    const res = makeRes();

    await handler()(req, res as unknown as Response);

    const [, params] = vi.mocked(buildEndSessionUrl).mock.calls[0] as [unknown, Record<string, string>];
    expect(params['id_token_hint']).toBeUndefined();
    expect(res.redirect).toHaveBeenCalledOnce();
  });
});
