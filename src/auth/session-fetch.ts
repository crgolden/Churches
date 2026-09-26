import { InjectionToken } from '@angular/core';

export const FETCHES_SESSION_ON_STARTUP = new InjectionToken<boolean>('FETCHES_SESSION_ON_STARTUP', {
  providedIn: 'root',
  factory: () => true,
});
