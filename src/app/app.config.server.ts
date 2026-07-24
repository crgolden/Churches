import { mergeApplicationConfig, ApplicationConfig } from '@angular/core';
import { provideServerRendering, withRoutes } from '@angular/ssr';
import { appConfig } from './app.config';
import { serverRoutes } from './app.routes.server';

// appConfig (shared, app.config.ts) already registers the router via provideRouter(routes, ...) and
// provideClientHydration(...). Re-registering the router here with withEnabledBlockingInitialNavigation()
// is a leftover pre-hydration-era pattern -- Angular explicitly disallows combining hydration with
// blocking initial navigation (throws NG05001: "found both hydration and enabledBlocking initial
// navigation in the same application"). provideClientHydration() + provideServerRendering() already
// guarantee the component tree is fully rendered before HTML serialization, so the second registration
// was both redundant and actively broken.
const serverConfig: ApplicationConfig = {
  providers: [provideServerRendering(withRoutes(serverRoutes))],
};

export const config = mergeApplicationConfig(appConfig, serverConfig);
