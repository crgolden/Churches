export const AUTHORIZATION_HEADER = 'authorization';

export const WWW_AUTHENTICATE_HEADER = 'www-authenticate';

export const CONTENT_TYPE_HEADER = 'Content-Type';

export const HttpMethods = {
  get: 'GET',
  head: 'HEAD',
  post: 'POST',
  put: 'PUT',
  patch: 'PATCH',
  delete: 'DELETE',
} as const;

export const HopByHopHeaders = {
  host: 'host',
  connection: 'connection',
  keepAlive: 'keep-alive',
  transferEncoding: 'transfer-encoding',
  contentEncoding: 'content-encoding',
  contentLength: 'content-length',
} as const;

export const BEARER_SCHEME = 'Bearer';

export function bearerAuthorization(token: string): string {
  return `${BEARER_SCHEME} ${token}`;
}
