// environment.ci.ts — swapped in by the `ci` build configuration. E2E tests drive the Node SSR
// server over localhost, so localhost must be an allowed host for SSR to render under test.
export const environment = {
  production: true,
  allowedHosts: ['localhost'],
};
