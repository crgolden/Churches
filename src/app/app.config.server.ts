import { mergeApplicationConfig, ApplicationConfig } from '@angular/core';
import { provideServerRendering, withRoutes } from '@angular/ssr';
import { appConfig } from './app.config';
import { serverRoutes } from './app.routes.server';
import { noSessionFetchWhileDiscoveringRoutes } from '../auth/session-fetch.server';

const serverConfig: ApplicationConfig = {
  providers: [provideServerRendering(withRoutes(serverRoutes)), noSessionFetchWhileDiscoveringRoutes],
};

export const config = mergeApplicationConfig(appConfig, serverConfig);
