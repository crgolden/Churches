import { HttpInterceptorFn } from '@angular/common/http';
import { inject, PLATFORM_ID, REQUEST } from '@angular/core';
import { isPlatformServer } from '@angular/common';
import { COOKIE_HEADER, CSRF_HEADER, CSRF_HEADER_VALUE, REQUEST_ID_HEADER } from '../shared/bff-contract';

export const appInterceptor: HttpInterceptorFn = (req, next) => {
  let headers = req.headers.set(CSRF_HEADER, CSRF_HEADER_VALUE).set(REQUEST_ID_HEADER, crypto.randomUUID());
  if (isPlatformServer(inject(PLATFORM_ID))) {
    const request = inject(REQUEST, { optional: true });
    const incomingCookie = request?.headers.get(COOKIE_HEADER);
    if (incomingCookie && request && sameOrigin(req.url, request.url)) {
      headers = headers.set(COOKIE_HEADER, incomingCookie);
    }
  }

  return next(req.clone({ withCredentials: true, headers }));
};

function sameOrigin(requestedUrl: string, renderedUrl: string): boolean {
  if (isRelative(requestedUrl)) {
    return true;
  }

  const renderedOrigin = new URL(renderedUrl).origin;
  return requestedUrl === renderedOrigin || requestedUrl.startsWith(`${renderedOrigin}/`);
}

function isRelative(url: string): boolean {
  return !url.startsWith('//') && !/^[a-z][a-z0-9+.-]*:/i.test(url);
}
