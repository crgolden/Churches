import {
  AngularNodeAppEngine,
  createNodeRequestHandler,
  isMainModule,
  writeResponseToNodeResponse,
} from '@angular/ssr/node';
import express from 'express';
import { join } from 'node:path';
import { applySession } from './bff/session';
import { buildBffRouter } from './bff/routes';
import { csrfForMutating, directoryProxy } from './bff/proxy';
import { logger, requestLogger } from './telemetry/logging';
import { environment } from './environments/environment';

const browserDistFolder = join(import.meta.dirname, '../browser');

const app = express();

// Azure App Service terminates TLS at its edge and forwards plain HTTP internally, so without this,
// Express's own req.secure/req.protocol always resolve to "http" regardless of the real
// X-Forwarded-Proto header. express-session's cookie.secure=true (production) then silently refuses
// to ever emit Set-Cookie (see express-session's onHeaders hook: `cookie.secure && !issecure(req,
// trustProxy)` short-circuits before writing the header) — this broke every login in production, with
// no error thrown, because the redirect to Identity still succeeds; only the session cookie is missing,
// so /bff/callback always finds an empty session ("Invalid or expired session state"). `1` (not `true`)
// trusts exactly one hop, matching Azure App Service's edge — the only proxy that can reach this
// process directly. This is Express's own trust-proxy setting and is independent of Angular SSR's
// separate `trustProxyHeaders` option below.
app.set('trust proxy', 1);

// Angular SSR rejects requests whose Host header is not allow-listed (SSRF protection) and SILENTLY
// falls back to client-side rendering — which would defeat the entire SSR/SEO goal. The allow-list is
// per-environment (see src/environments/*), swapped at build time via fileReplacements.
//
// trustProxyHeaders is required because Azure App Service's edge always injects X-Forwarded-For (and
// other X-Forwarded-* headers) on every request. Angular's default trusted set only covers
// x-forwarded-host/x-forwarded-proto; any other X-Forwarded-* header present without being explicitly
// trusted causes Angular to silently deopt to client-side-only rendering (serveClientSidePage()) — this
// broke SSR/SEO for every production request behind Azure's proxy until this was set. `true` is NOT
// enough here: @angular/ssr normalizes `true` to a fixed 5-header set (x-forwarded-for/host/port/proto/
// prefix) that does NOT include `X-Forwarded-Tlsversion` — a header Azure App Service also sends on
// every request — so `true` alone still deopts every request to CSR (confirmed live: crgolden.com was
// serving every page as CSR-only under `trustProxyHeaders: true`). List every X-Forwarded-* header
// Azure's edge is known to send. Safe here since Azure App Service's edge is the only entity that can
// reach this Node process directly.
const angularApp = new AngularNodeAppEngine({
  allowedHosts: environment.allowedHosts,
  trustProxyHeaders: ['x-forwarded-for', 'x-forwarded-host', 'x-forwarded-port', 'x-forwarded-proto', 'x-forwarded-tlsversion'],
});

// Health endpoint — mounted first so it is anonymous and untraced (the instrumentation.mjs http
// instrumentation ignores /health). The post-deploy smoke job and the Infrastructure dashboard both
// require GET /health → 200 body "Healthy".
app.get('/health', (_req, res) => {
  res.type('text/plain').send('Healthy');
});

// Structured request logging (Serilog request-logging equivalent); skips /health internally.
app.use(requestLogger);

// ── WP2: BFF middleware ───────────────────────────────────────────────────────
// Order matters: session must be established before auth routes or proxy run.

// 1. Session (express-session + connect-redis).
applySession(app);

// 2. /bff/* auth routes (openid-client v6):
//    GET /bff/login     — initiate PKCE authorization-code flow
//    GET /bff/callback  — exchange code, store tokens in session
//    GET /bff/user      — return claims array (CSRF required)
//    GET /bff/logout    — RP-initiated end-session (sid validated)
app.use('/bff', buildBffRouter());

// 3. /directory/api/** proxy:
//    Forwards to DirectoryApiAddress with Authorization: Bearer from session
//    when the user is authenticated (UserOrNone parity with .NET BFF).
//    Mutating requests (POST/PUT/PATCH/DELETE) require the X-CSRF header.
app.use('/directory/api', csrfForMutating, directoryProxy);

// ─────────────────────────────────────────────────────────────────────────────

// GET /sitemap.xml: streams the sitemap from blob static-website hosting (where the Functions
// `SitemapGenerator` timer writes it nightly) under this app's own origin. Crawlers require a
// sitemap to be served from the same host as the URLs it lists — the URLs inside this sitemap are
// all built from ChurchesBaseUrl, so serving it from the storage account's own hostname instead
// causes Google to discard every entry. See ARCHITECTURE.md's SEO section.
app.get('/sitemap.xml', async (_req, res) => {
  const sitemapBlobUrl = process.env['SitemapBlobUrl'];
  if (!sitemapBlobUrl) {
    res.status(502).type('text/plain').send('SitemapBlobUrl is not configured');
    return;
  }

  try {
    const blobResponse = await fetch(sitemapBlobUrl);
    if (!blobResponse.ok) {
      res.status(502).type('text/plain').send('Sitemap upstream fetch failed');
      return;
    }
    const body = await blobResponse.arrayBuffer();
    res.status(200);
    res.type('application/xml');
    res.setHeader('Cache-Control', 'public, max-age=3600');
    res.end(Buffer.from(body));
  } catch (err) {
    logger.error({ err }, 'Failed to fetch sitemap from blob storage');
    res.status(502).type('text/plain').send('Sitemap upstream fetch failed');
  }
});

// Serve static browser assets.
app.use(
  express.static(browserDistFolder, {
    maxAge: '1y',
    index: false,
    redirect: false,
  }),
);

// SSR catch-all: delegate all unhandled requests to Angular.
app.use((req, res, next) => {
  angularApp
    .handle(req)
    .then((response) =>
      response ? writeResponseToNodeResponse(response, res) : next(),
    )
    .catch(next);
});

if (isMainModule(import.meta.url) || process.env['pm_id']) {
  const port = process.env['PORT'] ?? 4000;
  app.listen(port, (error) => {
    if (error) {
      throw error;
    }
    logger.info({ port }, `Node Express server listening on http://localhost:${port}`);
  });
}

export const reqHandler = createNodeRequestHandler(app);
