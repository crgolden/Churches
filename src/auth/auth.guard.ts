import { inject } from '@angular/core';
import { CanActivateFn } from '@angular/router';
import { AuthService } from './auth.service';
import { BffPaths, RETURN_URL_QUERY_PARAMETER } from '../shared/bff-contract';

export const authGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  if (auth.isAuthenticated()) {
    return true;
  }
  window.location.href = `${BffPaths.login}?${RETURN_URL_QUERY_PARAMETER}=${encodeURIComponent(window.location.pathname + window.location.search)}`;
  return false;
};
