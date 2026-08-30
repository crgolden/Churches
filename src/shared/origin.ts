import { DOCUMENT } from '@angular/common';
import { REQUEST, inject } from '@angular/core';

export function injectOrigin(): string {
  const request = inject(REQUEST, { optional: true });
  const document = inject(DOCUMENT);
  return request ? new URL(request.url).origin : document.location.origin;
}
