import {
  ApplicationConfig,
  inject,
  provideAppInitializer,
  provideZonelessChangeDetection,
} from '@angular/core';
import { provideRouter, TitleStrategy, withInMemoryScrolling } from '@angular/router';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import {
  provideClientHydration,
  withEventReplay,
  withHttpTransferCacheOptions,
  withNoIncrementalHydration,
} from '@angular/platform-browser';
import { routes } from './app.routes';
import { appInterceptor } from './app.interceptor';
import { AppTitleStrategy } from './app-title-strategy';
import { provideBrowserScrollRestorationWhenLeavingTheDocument } from '@crgolden/modules/angular';
import { AuthService } from '../auth/auth.service';

export const appConfig: ApplicationConfig = {
  providers: [
    provideZonelessChangeDetection(),
    provideClientHydration(
      withEventReplay(),
      withNoIncrementalHydration(),
      withHttpTransferCacheOptions({ includeRequestsWithCredentials: true, includeRequestsWithAuthHeaders: true }),
    ),
    provideRouter(
      routes,
      withInMemoryScrolling({ scrollPositionRestoration: 'enabled', anchorScrolling: 'enabled' }),
    ),
    provideBrowserScrollRestorationWhenLeavingTheDocument(),
    provideHttpClient(withInterceptors([appInterceptor])),
    provideAppInitializer(() => inject(AuthService).initialize()),
    { provide: TitleStrategy, useClass: AppTitleStrategy },
  ],
};
