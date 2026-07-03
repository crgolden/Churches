# Churches

[![Build and deploy Node.js app to Azure Web App - crgolden-churches](https://github.com/crgolden/Churches/actions/workflows/main_crgolden-churches.yml/badge.svg)](https://github.com/crgolden/Churches/actions/workflows/main_crgolden-churches.yml)

[![Quality Gate Status](https://sonarcloud.io/api/project_badges/measure?project=crgolden_Churches&metric=alert_status)](https://sonarcloud.io/summary/new_code?id=crgolden_Churches)

The end-user surface of a nationwide U.S. church discovery platform: an **Angular 21 SSR** application
with a **Node.js Express** Backend-for-Frontend (BFF), served by a single Node process. The BFF holds
the OIDC session and proxies every data call to the standalone [Directory](https://github.com/crgolden/Directory)
API; the browser never sees an access token directly. Anonymous SEO routes are server-side rendered;
authenticated routes are client-side.

> **Architecture note:** the church data API (search, crawling, moderation, enrichment) lives in the
> separate [Directory](https://github.com/crgolden/Directory) repo. This repo is purely the Angular
> SSR client + Node BFF, mirroring [Inventory](https://github.com/crgolden/Inventory).

## Sibling Applications

| Repo | Role | How Churches interacts |
|---|---|---|
| [Identity](https://github.com/crgolden/Identity) | OIDC Identity Provider | OIDC authorization-code flow via `openid-client` in the Node BFF |
| [Directory](https://github.com/crgolden/Directory) | Church directory API | BFF proxies `/directory/api/**` via `http-proxy-middleware`, attaching the user Bearer token (scope `directory`) when present |
| [Infrastructure](https://github.com/crgolden/Infrastructure) | Health monitoring dashboard | Polls `GET /health` (returns `Healthy`) |

## Architecture

```
┌────────────────────────────────────┐
│  Angular 21 SSR + Node.js BFF      │  :4000 (dev SSR) / :4321 (ng serve)
│  Express middleware stack:         │
│    session (connect-redis)         │
│    /bff/* (openid-client)          │
│    /directory/api/** (proxy)       │
│    Angular SSR catch-all           │
└──────────────┬─────────────────────┘
               │ /directory/api/** (Bearer token from session)
    ┌──────────▼───────────────┐
    │   Directory API          │
    │   (crgolden-directory)   │
    └──────────────────────────┘
```

**Backend (`src/server.ts`)**
- `express-session` + `connect-redis` for session persistence
- `openid-client` v6 — authorization-code + RP-initiated logout (`/bff/login`, `/bff/logout`, `/bff/user`)
- `http-proxy-middleware` — `/directory/api/**` proxied with `Authorization: Bearer` from session
- CSRF guard: `X-CSRF: 1` required on BFF and proxied mutating calls
- OIDC scopes: `offline_access openid profile email directory`
- Secrets (`ChurchesClientId`, `ChurchesClientSecret`, Redis password) via Azure Key Vault using Managed Identity
- Observability: OTLP traces/metrics → Grafana Alloy only (Azure Monitor/Application Insights removed); structured logs → Elasticsearch (`pino-elasticsearch`)
- Health endpoint: `GET /health` → `Healthy`

**Frontend (`src/`)**
- Angular 21 **zoneless** change detection
- SSR render modes: anonymous routes (`/`, `/churches`, `/churches/:slug`) → `RenderMode.Server`;
  authenticated routes (`/contribute`, `/admin/moderation`) → `RenderMode.Client`
- Per-page SEO: `<title>`, `<meta description>`, canonical, Open Graph, JSON-LD (detail pages) — see `src/shared/seo.service.ts`
- Public church search and detail (anonymous), contributions and moderation tooling (authenticated)
- Map view: Leaflet (dynamic import, browser-only)

**Feature areas**

| Route | Auth | Backed by |
|---|---|---|
| Home / search, church detail | anonymous | Directory API via BFF (`/directory/api/**`) |
| Contributions (submit correction) | authenticated | Directory API `POST /corrections` (scope `directory`) via BFF with user token |
| Moderation (review, crawl sources, merge) | authenticated + `churches.mod` claim | Directory API moderation endpoints via BFF with user token |

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Node.js 22 / Express 5 |
| Auth / BFF | `openid-client` v6 + `express-session` + `connect-redis` |
| Frontend | Angular 21 SSR (`@angular/ssr`) |
| Observability | OpenTelemetry → Grafana Alloy (OTLP), `pino` → Elasticsearch |
| Hosting | Azure App Service (Linux, Node 22) |
| Secrets | Azure Key Vault (Managed Identity) |

## Getting Started

The full local stack needs the Identity server and the Directory API running, plus the local config:

**Environment variables (set in your shell):**

```
OidcAuthority=https://localhost:7261
DirectoryApiAddress=https://localhost:7002
ChurchesClientId=<dev client id>
ChurchesClientSecret=<dev client secret>
SessionSecret=<at-least-32-chars-dev-secret>
```

Session storage defaults to an in-memory store (fine for local dev — sessions just don't survive a
restart). To use a local Redis instance instead (e.g. if you already run one for Manuals/
Infrastructure), export `RedisHost=localhost` and `RedisPort=6379` (the code's own default of `6380`
assumes Azure's TLS port, not a local non-TLS Redis) — `session.ts` picks Redis automatically once
`RedisHost` is set. Don't combine `RedisHost` with `SessionStore=memory`: the latter always forces the
in-memory store regardless of `RedisHost`, so setting both together silently ignores `RedisHost`.

**Key Vault secrets required at runtime (production):**

| Secret name | Description |
|-------------|-------------|
| `ChurchesClientId` | OIDC client ID |
| `ChurchesClientSecret` | OIDC client secret |
| `ElasticsearchUsername` | Elasticsearch basic auth username |
| `ElasticsearchPassword` | Elasticsearch basic auth password |
| `RedisPassword` | Redis TLS password |
| `SessionSecret` | Cookie signing secret (≥ 32 chars) |

## Key pieces

- `src/server.ts` — Express entry: `/health`, request logging, session, `/bff/*`, `/directory/api` proxy, Angular SSR catch-all.
- `src/bff/*` — `openid-client` auth, session (Redis / in-memory), Directory proxy, CSRF.
- `src/environments/*` — per-environment config (notably SSR `allowedHosts`), swapped via `fileReplacements`.
- `instrumentation.mjs` — OpenTelemetry sidecar (OTLP→Alloy); `src/telemetry/logging.ts` — pino→Elasticsearch.

## Commands

```powershell
npm install
npm start            # ng serve — SPA/component dev (no SSR/BFF), http://localhost:4200
npm run build        # SSR production build → dist/churches.client/{server,browser}
npm run build:ci     # SSR build with the ci environment (allowedHosts=localhost)
npm run serve:ssr    # run the full SSR + BFF: node --import ./instrumentation.mjs dist/churches.client/server/server.mjs
npm run lint         # ESLint
npx vitest run       # unit tests (Vitest); add --coverage for LCOV
npm run e2e          # build:ci + Playwright E2E vs the real Node server + mock Directory/OIDC (self-builds)
npm run e2e:smoke    # Playwright smoke tests against a deployed stack (SmokeBaseUrl)
.\Invoke-SmokeTests.ps1 -BaseUrl https://crgolden-churches.azurewebsites.net
```

See [TESTING.md](TESTING.md) for the full E2E / smoke test guide and CI configuration.

## Project Structure

```
src/
  server.ts        # Express app: session, BFF routes, SSR catch-all
  bff/              # openid-client auth, session, Directory proxy, CSRF
  app/              # Angular application
  environments/     # per-environment config (allowedHosts, etc.)
  telemetry/        # pino → Elasticsearch logging
e2e/                # TypeScript Playwright E2E + smoke tests
instrumentation.mjs # OpenTelemetry Node SDK init (loaded via --import)
```

## Deployment

The GitHub Actions workflow (`.github/workflows/main_crgolden-churches.yml`) triggers on pushes to
`main` and pull requests.

**Build job** — `npm ci` → lint → `npm run build:ci` (SSR, ci config) → Vitest coverage →
Playwright E2E → SonarCloud (JS LCOV) → `npm run build` (production) → `npm prune --omit=dev` →
upload deployment artifact.

**Deploy job** — deploys the Node bundle to **Linux Azure App Service** `crgolden-churches`
(Production slot) via Azure OIDC. Startup command:
`node --import ./instrumentation.mjs dist/churches.client/server/server.mjs`

**Smoke job** — `npm run e2e:smoke` against the deployed `webapp-url` (post-deploy, `main` only).

This repo deploys only the frontend + Node BFF; the Directory API and its SQL schema deploy from the
[Directory](https://github.com/crgolden/Directory) repo (`crgolden-directory`).
