import { ApplicationConfig, inject, provideAppInitializer, provideZonelessChangeDetection } from '@angular/core';
import { provideRouter, TitleStrategy } from '@angular/router';
import { provideHttpClient, withFetch, withInterceptors } from '@angular/common/http';
import { routes } from './app.routes';
import { appInterceptor } from './app.interceptor';
import { AppTitleStrategy } from './app-title-strategy';
import { AuthService } from '../auth/auth.service';

export const appConfig: ApplicationConfig = {
  providers: [
    provideZonelessChangeDetection(),
    provideRouter(routes),
    provideHttpClient(withFetch(), withInterceptors([appInterceptor])),
    provideAppInitializer(() => inject(AuthService).initialize()),
    { provide: TitleStrategy, useClass: AppTitleStrategy },
  ],
};
