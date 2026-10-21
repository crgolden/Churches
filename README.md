# Churches

[![Build and deploy Node.js app to Azure Web App - crgolden-churches](https://github.com/crgolden/Churches/actions/workflows/main_crgolden-churches.yml/badge.svg)](https://github.com/crgolden/Churches/actions/workflows/main_crgolden-churches.yml)

[![Quality gate](https://sonarcloud.io/api/project_badges/quality_gate?project=crgolden_Churches)](https://sonarcloud.io/summary/new_code?id=crgolden_Churches)

The web front end of a nationwide U.S. church-discovery service: search churches by name, place, worship
style and service times, read a church's details on a map, suggest corrections, and, for moderators, review
them. It is an **Angular 22 SSR** application and a **Node.js Express** Backend-for-Frontend (BFF) in one
process. The BFF holds the OIDC session and proxies every data call to the church Directory API, so the
browser never sees an access token. Anonymous pages render on the server for search engines; signed-in pages
render in the browser.

How the parts fit together (the middleware order, sign-in and proxy flows, routes, SEO and hosting):
[ARCHITECTURE.md](ARCHITECTURE.md). The visual design rules: [DESIGN.md](DESIGN.md). Every test tier and how to
run it: [TESTING.md](TESTING.md).

## Technologies

| Layer | Technology |
|---|---|
| Runtime | Node.js 24 (`.nvmrc`), Express 5 |
| Front end | Angular 22 with `@angular/ssr`, zoneless; Tailwind CSS v4; Leaflet maps |
| Auth and session | `openid-client` v6 (Authorization Code + PKCE), `express-session` with Redis (`connect-redis`) or in memory |
| Shared packages | `@crgolden/modules` from GitHub Packages (design primitives, design gates, the synthetic walker, BDD result publishing) |
| Observability | OpenTelemetry over OTLP; `pino` logs to Elasticsearch |
| Tests | Vitest (jsdom and browser mode), Playwright with `playwright-bdd` |
| Hosting | Azure App Service (Linux) |

## Prerequisites

- Node.js 24.
- A GitHub personal access token with the `read:packages` scope. `.npmrc` maps the `@crgolden` scope to
  GitHub Packages, which asks for a token even for a public package. Put it in your user `~/.npmrc`, never
  in this repo:

  ```
  //npm.pkg.github.com/:_authToken=<token>
  ```

- To run the tests: nothing else. The E2E tier starts its own mock Directory API and mocks sign-in, using
  ports 4000 and 4001.
- To run a working copy: a church Directory API to proxy to, and, to sign in, an OIDC provider with a
  confidential client for this app (redirect `<origin>/bff/callback`, scopes
  `offline_access openid profile email directory`). Redis is optional locally (`SessionStore=memory`).

## Clone and install

```powershell
git clone https://github.com/crgolden/Churches.git
cd Churches
npm ci
```

## Configuration

Every setting is an environment variable; `src/bff/settings.ts` validates them at startup, and a missing
required one stops the process. Locally, put them in `.env.local` (gitignored); `npm start` and
`npm run serve:ssr` load it.

```
PORT=4000
OidcAuthority=<your OIDC provider's authority URL>
ChurchesClientId=<client id>
ChurchesClientSecret=<client secret>
DirectoryApiAddress=<Directory API base URL>
SitemapBlobBaseUrl=<base URL of the blob container holding the sitemaps>
SessionSecret=<at least 32 characters>
SessionStore=memory
```

| Setting | Required | Purpose |
|---|---|---|
| `PORT`, `SessionSecret` | always | the listening port; the cookie signing secret |
| `OidcAuthority`, `ChurchesClientId`, `ChurchesClientSecret` | always | the OIDC client |
| `DirectoryApiAddress` | always | where `/directory/api/**` is proxied |
| `SitemapBlobBaseUrl` | always | where `/sitemap-index.xml` and `/sitemaps/*` are fetched from |
| `SessionStore` | no | `memory` keeps sessions in process (lost on restart) and wins over any Redis setting; unset uses Redis |
| `RedisHost`, `RedisPort`, `RedisPassword` and `RedisSocketTimeoutMs`, `RedisPingIntervalMs`, `RedisReconnectStepMs`, `RedisReconnectMaxDelayMs`, `RedisReconnectJitterMs` | unless `SessionStore=memory` | the session store; the five tunables are positive integers, the ping interval shorter than the socket timeout |
| `AlloyEndpoint`, `ElasticsearchNode`, `ElasticsearchUsername`, `ElasticsearchPassword` | under `NODE_ENV=production` | traces, metrics and logs; elsewhere optional |

In production each secret is an App Service setting holding a Key Vault reference, which the platform
resolves at startup through the app's managed identity; the app makes no vault calls of its own.

## Run locally

```powershell
npm run build:ci
npm run serve:ssr     # http://localhost:4000: SSR, the BFF and the Directory proxy
```

Use the `ci` build to serve locally: the production configuration only accepts the production hosts, so
`localhost` is answered with a one-line `Header "host" ... is not allowed` page. `serve:ssr` runs the built
`dist/`, so rebuild after a change. For template and style work, `npm start` runs `ng serve` on port 56432,
server-rendering through `src/server.ts`; set `ASPNETCORE_URLS=http://localhost:4000` so its proxy sends `/bff`
and `/directory/api` to the running `serve:ssr`.

## Tests

```powershell
npx vitest run           # unit and browser-unit tiers
npm run e2e              # build:ci, then the Integration and E2E tiers against the mock
```

Free ports 4000 and 4001 before `npm run e2e`. [TESTING.md](TESTING.md) covers every tier, the mock, the
synthetic walker that exercises the deployed app on a schedule, and the local SonarCloud scan.

## Gate

`gate.ps1` is the maintainers' gate. It loads a private toolkit from a folder beside this repo, so in a
plain clone it stops at once. To gate your own change, run the checks CI runs, in this order:

```powershell
npm ci
npm run lint
npm run typecheck:e2e
npm run typecheck:spec
npm run lint:css
npm run audit
npm run playwright:install
npm run test:coverage
npm run e2e
npm run lint:utilities
npm run build
```

Every command must exit 0. `lint:utilities` reads the built CSS, so it runs after `e2e`. `lint:css` installs
its linter from `tools/stylelint/`, which has its own `package.json` and lockfile so the linter's dependencies
stay out of the app's. CI additionally runs a SonarCloud analysis and fails on any open issue.

## Project structure

| Path | What it holds |
|---|---|
| `src/server.ts` | the Express app: health, logging, session, `/bff`, the Directory proxy, sitemaps, the SSR catch-all |
| `src/bff/` | OIDC sign-in, the session store, the Directory proxy, CSRF, sitemap serving, settings validation |
| `src/app/` | the application shell: routes, render modes, the HTTP interceptor |
| `src/churches/` | search, results, the church detail page with moderator curation, the correction form, the maps |
| `src/admin/` | the moderation queue |
| `src/auth/` | the client-side session and the guards |
| `src/shared/`, `src/environments/`, `src/telemetry/`, `src/testing/` | shared components and SEO, per-configuration values, logging, unit-test helpers |
| `e2e/`, `integration/` | the Playwright journeys, the mock Directory API and the synthetic walker; the server-rendered HTML checks |
| `instrumentation.mjs` | OpenTelemetry, loaded before the app with `--import` |
| `tools/stylelint/` | the stylesheet linter, installed on its own |

## Deployment

`.github/workflows/main_crgolden-churches.yml` runs the checks above on every push and pull request. On `main` it
builds the production configuration, prunes dev dependencies, and deploys to Azure App Service over OIDC
federated credentials. `synthetic.yml` walks the deployed app on a schedule.

| Repository secret or variable | Used by |
|---|---|
| `PACKAGES_READ_TOKEN` (secret) | `npm ci` from GitHub Packages, in both workflows |
| `SONAR_TOKEN` (secret); `SONAR_PROJECT_KEY`, `SONAR_ORGANIZATION` (variables) | the SonarCloud steps |
| `TEST_RESULTS_PGPASSWORD` (secret); `TEST_RESULTS_PGHOST`, `TEST_RESULTS_PGDATABASE`, `TEST_RESULTS_PGUSER`, `TEST_RESULTS_PGSSLMODE`, `TEST_RESULTS_APP` (variables) | publishing the E2E scenario results to a PostgreSQL results store |
| `AZUREAPPSERVICE_CLIENTID_*`, `AZUREAPPSERVICE_TENANTID_*`, `AZUREAPPSERVICE_SUBSCRIPTIONID_*` | the deploy job |
| `WALKER_BASE_URL` (variable); `PASSKEY_CREDENTIAL1`, `PASSKEY_CREDENTIAL2` (secrets) | the synthetic walker |
