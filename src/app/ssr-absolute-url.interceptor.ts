import { inject } from '@angular/core';
import { HttpInterceptorFn } from '@angular/common/http';
import { REQUEST } from '@angular/core';

/**
 * SSR-only interceptor: rewrites relative API URLs to absolute so that
 * server-side HttpClient can resolve them.  In the browser, REQUEST is null
 * (not provided) so the interceptor is a no-op.
 */
export const ssrAbsoluteUrlInterceptor: HttpInterceptorFn = (req, next) => {
  const request = inject(REQUEST, { optional: true });

  // No-op in the browser (REQUEST not provided) or when already absolute.
  if (!request || req.url.startsWith('http')) {
    return next(req);
  }

  const origin = new URL(request.url).origin;

  // Ensure exactly one '/' between origin and the request path.  Without this
  // guard, a path that is missing its leading slash produces a double-host URL
  // (e.g. "https://host:4000directory/api/...") and one that already has it
  // would only work by accident.
  const path = req.url.startsWith('/') ? req.url : `/${req.url}`;
  return next(req.clone({ url: `${origin}${path}` }));
};
