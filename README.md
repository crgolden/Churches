# Churches

[![Build and deploy ASP.Net Core app to Azure Web App - crgolden-churches](https://github.com/crgolden/Churches/actions/workflows/main_crgolden-churches.yml/badge.svg)](https://github.com/crgolden/Churches/actions/workflows/main_crgolden-churches.yml)

[![Quality Gate Status](https://sonarcloud.io/api/project_badges/measure?project=crgolden_Churches&metric=alert_status)](https://sonarcloud.io/summary/new_code?id=crgolden_Churches)

The end-user surface of a nationwide U.S. church discovery platform: a single-page application built with **Angular 21** and an **ASP.NET Core 10** [Backend-for-Frontend (BFF)](https://www.duendesoftware.com/products/bff). The BFF holds the OIDC session and proxies every data call to the standalone [Directory](https://github.com/crgolden/Directory) API; the SPA never sees an access token directly.

> **Architecture note:** the church data API (search, crawling, moderation, enrichment) used to live in this repo as `Churches.Api` / `Churches.Domain` / `Churches.Data`. It is now the separate [Directory](https://github.com/crgolden/Directory) repo. This repo is purely the Angular client + BFF, mirroring [Inventory](https://github.com/crgolden/Inventory).

## Sibling Applications

| Repo | Role | How Churches interacts |
|---|---|---|
| [Identity](https://github.com/crgolden/Identity) | OIDC Identity Provider | OIDC client — login / logout / silent refresh via Duende BFF |
| [Directory](https://github.com/crgolden/Directory) | Church directory API | BFF proxies `/directory/api/**` to the Directory API, attaching the user access token (scope `directory`) when present |
| [Infrastructure](https://github.com/crgolden/Infrastructure) | Health monitoring dashboard | Not yet — `ChurchesHealthCheck` is planned; currently covered by Uptime Kuma |

## Architecture

```
┌─────────────────────┐        ┌──────────────────────────┐
│  Angular 21 (SPA)   │◄──────►│  ASP.NET Core 10 (BFF)   │
│  :56432 (dev)       │        │  :7135 (dev)             │
└─────────────────────┘        └──────────┬───────────────┘
                                           │ /directory/api/** (YARP + user token)
                                ┌──────────▼───────────────┐
                                │   Directory API          │
                                │   (crgolden-directory)   │
                                └──────────────────────────┘
```

**Backend (`Churches.Server/`)**
- [Duende BFF](https://docs.duendesoftware.com/identityserver/v7/bff/) handles OIDC login/logout and remote-API token management
- `MapRemoteBffApiEndpoint("/directory/api", DirectoryApiAddress)` proxies to the Directory API via YARP, with token type `UserOrNone` (anonymous search works; authenticated requests carry the user token)
- OIDC scopes requested: `offline_access openid profile email directory`
- All secrets (OIDC client credentials, Elasticsearch credentials) fetched at startup from **Azure Key Vault**
- Data protection keys stored in **Azure Blob Storage**, encrypted with an **Azure Key Vault** key
- Distributed tracing and metrics via **OpenTelemetry** exported to **Azure Monitor**; structured logging via **Serilog** → Elasticsearch (production) / console (development)

**Frontend (`churches.client/`)**
- Angular 21 **zoneless** change detection
- Public church search and detail (anonymous), contributions and moderation tooling (authenticated)
- Dev server proxies `/bff` and `/directory/api` to the BFF via `src/proxy.conf.js`

**Feature areas**

| Route | Auth | Backed by |
|---|---|---|
| Home / search, church detail | anonymous | [Directory API](https://github.com/crgolden/Directory) via BFF (`/directory/api/**`) |
| Contributions (submit correction) | authenticated | Directory API `POST /corrections` (scope `directory`) via BFF with user token |
| Moderation (review, crawl sources, merge) | authenticated + `churches.mod` | Directory API moderation endpoints via BFF with user token |

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | ASP.NET Core 10 (Duende BFF + YARP) |
| Auth | Duende BFF 7 |
| Frontend | Angular 21 |
| Observability | Azure Monitor, OpenTelemetry, Serilog, Elasticsearch |
| Hosting | Azure App Service |
| Secrets | Azure Key Vault |
| Data Protection | Azure Blob Storage + Azure Key Vault |

## Getting Started

### 1. Configure User Secrets

In development, user secrets are used (ID `c7445659-3c3d-4e0e-86ee-d983bd5c741f`). Set the OIDC client credentials, the Directory API address, and the supporting infrastructure URIs:

```jsonc
{
  "OidcAuthority": "https://localhost:7261",
  "DirectoryApiAddress": "https://localhost:7002/",
  "ChurchesClientId": "<dev client id>",
  "ChurchesClientSecret": "<dev client secret>",
  "ElasticsearchNode": "https://<host>:9200"
}
```

**Key Vault secrets required at runtime (production):**

| Secret name | Description |
|-------------|-------------|
| `ChurchesClientId` | OIDC client ID |
| `ChurchesClientSecret` | OIDC client secret |
| `ElasticsearchUsername` | Elasticsearch basic auth username |
| `ElasticsearchPassword` | Elasticsearch basic auth password |

### 2. Run

The full local stack needs the Identity server, the Directory API, the Churches BFF, and the Angular dev server.

**BFF**
```bash
dotnet run --project Churches.Server
# Available at https://localhost:7135
```

**Frontend** (separate terminal)
```bash
cd churches.client
npm install
npm start
# Available at https://localhost:56432
```

The Angular dev server proxies `/bff` and `/directory/api` to `https://localhost:7135` via `src/proxy.conf.js`.

## Project Structure

```
Churches.Server/     # ASP.NET Core 10 BFF — OIDC session, /directory/api proxy, data protection
churches.client/     # Angular 21 SPA — search, church detail, contributions, moderation
Churches.Tests/      # xUnit v3 — unit tests (Moq), E2E tests (Playwright/Chromium), smoke tests
```

## Commands

```bash
# Build (Angular + BFF)
dotnet build

# Backend unit tests (no Azure required)
dotnet build Churches.Tests --configuration Debug
.\Churches.Tests\bin\Debug\net10.0\Churches.Tests.exe -trait "Category=Unit" -showLiveOutput

# Backend E2E tests (Playwright; static-file Kestrel + Playwright API mocks for /bff and /directory/api)
.\Churches.Tests\bin\Debug\net10.0\Churches.Tests.exe -trait "Category=E2E" -showLiveOutput

# Frontend unit tests (Vitest)
cd churches.client && npx vitest run

# Publish web app
dotnet publish Churches.Server -c Release -r win-x86 --self-contained false -o ./publish
```

See [TESTING.md](TESTING.md) for the full E2E / smoke test guide and CI configuration.

## Deployment

The GitHub Actions workflow (`.github/workflows/main_crgolden-churches.yml`) triggers on pushes to `main` and pull requests.

**Build job** — builds the Angular frontend and the BFF, runs backend unit tests with coverage and frontend unit tests (Vitest), runs SonarCloud analysis, and publishes the web app.

**Deploy job** — deploys the web app to **Azure App Service** `crgolden-churches` (Production slot) via Azure OIDC.

This repo deploys only the frontend + BFF; the Directory API and its SQL schema deploy from the [Directory](https://github.com/crgolden/Directory) repo (`crgolden-directory`).
