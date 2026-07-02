import { mergeApplicationConfig, ApplicationConfig } from '@angular/core';
import { provideRouter, withEnabledBlockingInitialNavigation } from '@angular/router';
import { provideServerRendering, withRoutes } from '@angular/ssr';
import { appConfig } from './app.config';
import { serverRoutes } from './app.routes.server';
import { routes } from './app.routes';

const serverConfig: ApplicationConfig = {
  providers: [
    // Re-register the router on the server with blocking initial navigation so
    // that the component tree is fully rendered before HTML serialization.
    provideRouter(routes, withEnabledBlockingInitialNavigation()),
    provideServerRendering(withRoutes(serverRoutes)),
  ],
};

export const config = mergeApplicationConfig(appConfig, serverConfig);
