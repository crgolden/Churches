import { HttpStatusCode } from '@angular/common/http';

export function statusCodeOf(response: { readonly status: number }): HttpStatusCode {
  return response.status;
}
