// environment.ts — production defaults (used by the default `production` build configuration).
// Hosts allowed for SSR (Angular rejects non-allow-listed Host headers and silently falls back to
// CSR, which would defeat SSR/SEO). Public production hosts only.
export const environment = {
  production: true,
  allowedHosts: ['crgolden.com', '*.crgolden.com', '*.azurewebsites.net'],
};
