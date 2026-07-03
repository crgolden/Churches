import { ApplicationConfig, inject, provideAppInitializer, provideZonelessChangeDetection } from '@angular/core';
import { provideRouter, TitleStrategy, withInMemoryScrolling } from '@angular/router';
import { provideHttpClient, withFetch, withInterceptors } from '@angular/common/http';
import { provideClientHydration, withEventReplay } from '@angular/platform-browser';
import { routes } from './app.routes';
import { appInterceptor } from './app.interceptor';
import { ssrAbsoluteUrlInterceptor } from './ssr-absolute-url.interceptor';
import { AppTitleStrategy } from './app-title-strategy';
import { AuthService } from '../auth/auth.service';

export const appConfig: ApplicationConfig = {
  providers: [
    provideZonelessChangeDetection(),
    provideClientHydration(withEventReplay()),
    provideRouter(routes, withInMemoryScrolling({ scrollPositionRestoration: 'top', anchorScrolling: 'enabled' })),
    provideHttpClient(withFetch(), withInterceptors([ssrAbsoluteUrlInterceptor, appInterceptor])),
    provideAppInitializer(() => inject(AuthService).initialize()),
    { provide: TitleStrategy, useClass: AppTitleStrategy },
  ],
};
