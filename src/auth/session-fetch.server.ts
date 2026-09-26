import { inject, Provider } from '@angular/core';
import { IS_DISCOVERING_ROUTES } from '@angular/ssr';
import { FETCHES_SESSION_ON_STARTUP } from './session-fetch';

export const noSessionFetchWhileDiscoveringRoutes: Provider = {
  provide: FETCHES_SESSION_ON_STARTUP,
  useFactory: () => !inject(IS_DISCOVERING_ROUTES),
};
