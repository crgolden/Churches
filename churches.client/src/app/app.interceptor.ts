import { HttpInterceptorFn } from '@angular/common/http';

export const appInterceptor: HttpInterceptorFn = (req, next) => {
  const headers = req.headers.set('X-CSRF', '1').set('X-Request-ID', crypto.randomUUID());
  return next(req.clone({ withCredentials: true, headers }));
};
