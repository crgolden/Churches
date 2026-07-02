import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from './auth.service';

export const modGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  if (auth.hasModerationScope()) {
    return true;
  }
  return inject(Router).createUrlTree(['/']);
};
