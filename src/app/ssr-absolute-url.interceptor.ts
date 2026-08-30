import { inject } from '@angular/core';
import { HttpInterceptorFn } from '@angular/common/http';
import { REQUEST } from '@angular/core';

export const ssrAbsoluteUrlInterceptor: HttpInterceptorFn = (req, next) => {
  const request = inject(REQUEST, { optional: true });

  if (!request || req.url.startsWith('http')) {
    return next(req);
  }

  const origin = new URL(request.url).origin;

  const path = req.url.startsWith('/') ? req.url : `/${req.url}`;
  return next(req.clone({ url: `${origin}${path}` }));
};
