import { DOCUMENT } from '@angular/common';
import { REQUEST, inject } from '@angular/core';

/**
 * Resolves the current request origin.  Must be called during an injection
 * context (e.g. a class field initializer or constructor).
 *
 * Under SSR the origin is taken from the server-side REQUEST token so each
 * rendered page emits the correct absolute URL.  In the browser it falls back
 * to document.location.origin.
 */
export function injectOrigin(): string {
  const request = inject(REQUEST, { optional: true });
  const document = inject(DOCUMENT);
  return request ? new URL(request.url).origin : document.location.origin;
}
