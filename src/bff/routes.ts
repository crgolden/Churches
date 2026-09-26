import { Router, type Request, type Response, type NextFunction } from 'express';
import {
  buildAuthorizationUrl,
  authorizationCodeGrant,
  buildEndSessionUrl,
  fetchUserInfo,
  randomPKCECodeVerifier,
  calculatePKCECodeChallenge,
  randomState,
} from 'openid-client';
import { getOidcConfig } from './oidc';
import { logger } from '../telemetry/logging';
import {
  BffPaths,
  BffRoutes,
  ClaimTypes,
  CSRF_HEADER,
  MISSING_CSRF_ERROR,
  SID_QUERY_PARAMETER,
} from '../shared/bff-contract';

const SCOPES = 'offline_access openid profile email directory';

export const BffErrors = {
  loginFailed: 'Login initiation failed',
  invalidSessionState: 'Invalid or expired session state',
  missingSub: 'Missing sub claim in ID token',
  callbackFailed: 'Callback processing failed',
  invalidSessionIdentifier: 'Invalid session identifier',
} as const;

export const ID_TOKEN_HINT_PARAMETER = 'id_token_hint';

export const JwtEncodings = {
  segment: 'base64url',
  text: 'utf8',
} as const;

const ACCESS_TOKEN_CLAIM_ALLOWLIST = [ClaimTypes.moderator] as const;

function accessTokenClaims(accessToken: string | undefined): Record<string, unknown> {
  const payload = accessToken?.split('.')[1];
  if (!payload) {
    return {};
  }

  try {
    const decoded = JSON.parse(Buffer.from(payload, JwtEncodings.segment).toString(JwtEncodings.text)) as Record<string, unknown>;
    const picked: Record<string, unknown> = {};
    for (const claim of ACCESS_TOKEN_CLAIM_ALLOWLIST) {
      if (decoded[claim] !== undefined) {
        picked[claim] = decoded[claim];
      }
    }
    return picked;
  } catch {
    return {};
  }
}

function stringifyClaimValue(value: unknown): string {
  if (typeof value === 'string') return value;
  if (
    typeof value === 'number' ||
    typeof value === 'boolean' ||
    typeof value === 'bigint'
  ) {
    return String(value);
  }
  return JSON.stringify(value);
}

function getOrigin(req: Request): string {
  const proto =
    (req.headers['x-forwarded-proto'] as string | undefined) ?? req.protocol;
  const host =
    (req.headers['x-forwarded-host'] as string | undefined) ??
    (req.headers.host) ??
    'localhost';
  return `${proto}://${host}`;
}

function saveSession(req: Request): Promise<void> {
  return new Promise((resolve, reject) =>
    req.session.save((err) =>
      err ? reject(err instanceof Error ? err : new Error('Session save failed', { cause: err })) : resolve(),
    ),
  );
}

function destroySession(req: Request): Promise<void> {
  return new Promise((resolve, reject) =>
    req.session.destroy((err) =>
      err ? reject(err instanceof Error ? err : new Error('Session destroy failed', { cause: err })) : resolve(),
    ),
  );
}

function providerSessionId(req: Request): string | null {
  return req.session.claims?.find((claim) => claim.type === ClaimTypes.sid)?.value ?? null;
}

function buildLogoutUrl(providerSid: string | null): string {
  return providerSid === null
    ? BffPaths.logout
    : `${BffPaths.logout}?${SID_QUERY_PARAMETER}=${encodeURIComponent(providerSid)}`;
}

export function requireCsrf(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  if (!req.headers[CSRF_HEADER.toLowerCase()]) {
    res.status(403).json({ error: MISSING_CSRF_ERROR });
    return;
  }
  next();
}

export function buildBffRouter(): Router {
  const router = Router();

  router.get(BffRoutes.login, async (req: Request, res: Response) => {
    try {
      const config = await getOidcConfig();
      const codeVerifier = randomPKCECodeVerifier();
      const codeChallenge = await calculatePKCECodeChallenge(codeVerifier);
      const state = randomState();

      req.session.pkceCodeVerifier = codeVerifier;
      req.session.oauthState = state;
      await saveSession(req);

      const redirectUrl = buildAuthorizationUrl(config, {
        redirect_uri: `${getOrigin(req)}${BffPaths.callback}`,
        scope: SCOPES,
        code_challenge: codeChallenge,
        code_challenge_method: 'S256',
        state,
      });

      res.redirect(redirectUrl.href);
    } catch (err) {
      logger.error({ err }, '[BFF /login]');
      res.status(500).json({ error: BffErrors.loginFailed });
    }
  });

  router.get(BffRoutes.callback, async (req: Request, res: Response) => {
    try {
      const config = await getOidcConfig();
      const { pkceCodeVerifier, oauthState } = req.session;

      if (!pkceCodeVerifier || !oauthState) {
        res.status(400).json({ error: BffErrors.invalidSessionState });
        return;
      }

      const currentUrl = new URL(
        `${getOrigin(req)}${req.originalUrl}`,
      );

      const tokens = await authorizationCodeGrant(config, currentUrl, {
        pkceCodeVerifier,
        expectedState: oauthState,
      });

      const idClaims = tokens.claims();
      const idSubject = idClaims?.[ClaimTypes.subject];
      const sub = typeof idSubject === 'string' ? idSubject : null;

      if (!sub) {
        res.status(500).json({ error: BffErrors.missingSub });
        return;
      }

      const userInfo = await fetchUserInfo(config, tokens.access_token, sub);

      const merged: Record<string, unknown> = {
        ...(idClaims ?? {}),
        ...userInfo,
        ...accessTokenClaims(tokens.access_token),
      };

      const claims: { type: string; value: string }[] = [];
      for (const [key, raw] of Object.entries(merged)) {
        if (raw === undefined || raw === null) continue;
        if (Array.isArray(raw)) {
          for (const item of raw) {
            claims.push({ type: key, value: stringifyClaimValue(item) });
          }
        } else {
          claims.push({ type: key, value: stringifyClaimValue(raw) });
        }
      }

      req.session.accessToken = tokens.access_token;
      req.session.refreshToken = tokens.refresh_token;
      req.session.idToken = tokens.id_token;
      req.session.tokenExpiresAt =
        typeof tokens.expires_in === 'number'
          ? Date.now() + tokens.expires_in * 1000
          : undefined;
      req.session.claims = claims;

      delete req.session.pkceCodeVerifier;
      delete req.session.oauthState;
      await saveSession(req);

      res.redirect('/');
    } catch (err) {
      logger.error({ err }, '[BFF /callback]');
      res.status(500).json({ error: BffErrors.callbackFailed });
    }
  });

  router.get(BffRoutes.user, requireCsrf, (req: Request, res: Response) => {
    if (!req.session.claims) {
      res.json(null);
      return;
    }

    const claims = [
      ...req.session.claims,
      {
        type: ClaimTypes.logoutUrl,
        value: buildLogoutUrl(providerSessionId(req)),
      },
    ];

    res.json(claims);
  });

  router.get(BffRoutes.logout, async (req: Request, res: Response) => {
    const providerSid = providerSessionId(req);
    if (providerSid !== null && req.query[SID_QUERY_PARAMETER] !== providerSid) {
      res.status(400).json({ error: BffErrors.invalidSessionIdentifier });
      return;
    }

    try {
      const config = await getOidcConfig();
      const idToken = req.session.idToken;

      await destroySession(req);

      const origin = getOrigin(req);
      const params: Record<string, string> = {
        post_logout_redirect_uri: `${origin}/`,
      };

      if (idToken) {
        params[ID_TOKEN_HINT_PARAMETER] = idToken;
      }

      const endSessionUrl = buildEndSessionUrl(config, params);
      res.redirect(endSessionUrl.href);
    } catch (err) {
      logger.error({ err }, '[BFF /logout]');
      res.redirect('/');
    }
  });

  return router;
}
