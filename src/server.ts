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

// Angular SSR rejects requests whose Host header is not allow-listed (SSRF protection) and SILENTLY
// falls back to client-side rendering — which would defeat the entire SSR/SEO goal. The allow-list is
// per-environment (see src/environments/*), swapped at build time via fileReplacements.
const angularApp = new AngularNodeAppEngine({ allowedHosts: environment.allowedHosts });

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
  const port = process.env['PORT'] || 4000;
  app.listen(port, (error) => {
    if (error) {
      throw error;
    }
    logger.info({ port }, `Node Express server listening on http://localhost:${port}`);
  });
}

export const reqHandler = createNodeRequestHandler(app);
