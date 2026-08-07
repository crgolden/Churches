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

const SCOPES = 'offline_access openid profile email directory';

const CALLBACK_PATH =
  process.env['OidcCallbackPath'] ?? '/bff/callback';

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

/**
 * Rejects requests that lack the static `X-CSRF` header.
 * Apply to every BFF endpoint that is called via XHR/fetch (not browser nav).
 */
export function requireCsrf(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  if (!req.headers['x-csrf']) {
    res.status(403).json({ error: 'Missing X-CSRF header' });
    return;
  }
  next();
}

export function buildBffRouter(): Router {
  const router = Router();

  router.get('/login', async (req: Request, res: Response) => {
    try {
      const config = await getOidcConfig();
      const codeVerifier = randomPKCECodeVerifier();
      const codeChallenge = await calculatePKCECodeChallenge(codeVerifier);
      const state = randomState();

      req.session.pkceCodeVerifier = codeVerifier;
      req.session.oauthState = state;
      await saveSession(req);

      const redirectUrl = buildAuthorizationUrl(config, {
        redirect_uri: `${getOrigin(req)}${CALLBACK_PATH}`,
        scope: SCOPES,
        code_challenge: codeChallenge,
        code_challenge_method: 'S256',
        state,
      });

      res.redirect(redirectUrl.href);
    } catch (err) {
      logger.error({ err }, '[BFF /login]');
      res.status(500).json({ error: 'Login initiation failed' });
    }
  });

  router.get('/callback', async (req: Request, res: Response) => {
    try {
      const config = await getOidcConfig();
      const { pkceCodeVerifier, oauthState } = req.session;

      if (!pkceCodeVerifier || !oauthState) {
        res.status(400).json({ error: 'Invalid or expired session state' });
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
      const sub =
        idClaims && typeof idClaims.sub === 'string'
          ? idClaims.sub
          : null;

      if (!sub) {
        res.status(500).json({ error: 'Missing sub claim in ID token' });
        return;
      }

      const userInfo = await fetchUserInfo(config, tokens.access_token, sub);

      const merged: Record<string, unknown> = {
        ...(idClaims ?? {}),
        ...userInfo,
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
      res.status(500).json({ error: 'Callback processing failed' });
    }
  });

  router.get('/user', requireCsrf, (req: Request, res: Response) => {
    if (!req.session.claims) {
      res.status(401).end();
      return;
    }

    const claims = [
      ...req.session.claims,
      {
        type: 'bff:logout_url',
        value: `/bff/logout?sid=${req.sessionID}`,
      },
    ];

    res.json(claims);
  });

  router.get('/logout', async (req: Request, res: Response) => {
    const sid = req.query['sid'];
    if (!sid || sid !== req.sessionID) {
      res.status(400).json({ error: 'Invalid session identifier' });
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
        params['id_token_hint'] = idToken;
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
