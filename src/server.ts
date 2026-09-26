import {
  AngularNodeAppEngine,
  createNodeRequestHandler,
  isMainModule,
  writeResponseToNodeResponse,
} from '@angular/ssr/node';
import { startOnceRetryingFailures } from '@crgolden/modules/server-startup';
import express, { type Express } from 'express';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { join } from 'node:path';
import { applySession } from './bff/session';
import { BffSettingKeys, assertRequiredBffSettings, requiredIntegerSetting } from './bff/settings';
import { buildBffRouter } from './bff/routes';
import { BFF_PREFIX } from './shared/bff-contract';
import { csrfForMutating, directoryProxy } from './bff/proxy';
import { sitemapIndexHandler, sitemapChunkHandler } from './bff/sitemap';
import { HEALTH_PATH, logger, requestLogger } from './telemetry/logging';
import { nameSpansByRoute } from './telemetry/span-route-name';
import { environment } from './environments/environment';

const browserDistFolder = join(import.meta.dirname, '../browser');

export const STARTUP_FAILED_LOG = '[Server] Startup failed';

async function createApp(): Promise<Express> {
  assertRequiredBffSettings();

  const app = express();

  app.set('trust proxy', 1);

  const angularApp = new AngularNodeAppEngine({
    allowedHosts: environment.allowedHosts,
    trustProxyHeaders: ['x-forwarded-for', 'x-forwarded-host', 'x-forwarded-port', 'x-forwarded-proto', 'x-forwarded-tlsversion'],
  });

  app.get(HEALTH_PATH, (_req, res) => {
    res.type('text/plain').send('Healthy');
  });

  app.use(nameSpansByRoute);

  app.use(requestLogger);

  const sessionReady = applySession(app);

  app.use(BFF_PREFIX, buildBffRouter());

  app.use('/directory/api', csrfForMutating, directoryProxy);

  app.get('/sitemap-index.xml', sitemapIndexHandler);
  app.get('/sitemaps/:file', sitemapChunkHandler);

  app.use(
    express.static(browserDistFolder, {
      maxAge: '1y',
      index: false,
      redirect: false,
    }),
  );

  app.use((req, res, next) => {
    if (req.session?.claims) {
      res.setHeader('Cache-Control', 'no-store');
    }

    angularApp
      .handle(req)
      .then((response) =>
        response ? writeResponseToNodeResponse(response, res) : next(),
      )
      .catch(next);
  });

  await sessionReady;
  return app;
}

const startApp = startOnceRetryingFailures(createApp);

if (isMainModule(import.meta.url) || process.env['pm_id']) {
  const app = await startApp();
  const port = requiredIntegerSetting(BffSettingKeys.Port);
  app.listen(port, (error) => {
    if (error) {
      throw error;
    }
    logger.info({ port }, `Node Express server listening on http://localhost:${port}`);
  });
}

export const reqHandler = createNodeRequestHandler(
  (req: IncomingMessage, res: ServerResponse, next?: (error?: unknown) => void) =>
    startApp()
      .then((app) => {
        app(req, res);
      })
      .catch((error: unknown) => {
        if (next) {
          next(error);
          return;
        }
        logger.error({ err: error }, STARTUP_FAILED_LOG);
        res.statusCode = 500;
        res.end();
      }),
);
