# Churches — Coverage Truth Tables

Demand-driven MC/DC tables for the `Churches.Api` methods the coverage baseline flags (highest
uncovered-branch first). Vocabulary, the three laws, and the status/home legend live in the workspace
`DESIGN-LANGUAGE.md`; the derivation rules (MC/DC, `tests = 1 + Σ(cases − 1)`, lossless rows, pyramid
escalation, 🔧-seam vs ⬆️-escalate) live in `TESTING-COVERAGE.md`.

Baseline (2026-06-12, `Churches.Api`, unit only, generated code excluded): **30.1% line / 26.2%
branch / 29.2% blended, 38 tests.** The endpoints (`ChurchEndpoints`, `ModerationEndpoints`, ...) sit
at 0% unit and are E2E-covered (Playwright through the BFF) — correct, they are thin routing shells.
The unit gap is the three services. All data access is BCL ADO.NET over an abstract `DbConnection`,
which Moq mocks directly (`DbConnection` → `DbCommand` → `DbDataReader` are all abstract), so **every
service method is unit-reachable through its public API**. Selection order: ChurchService (47),
SearchService (33), ModerationService (18).

**🔧 Cross-repo dedup finding (open):** the `ToSlug` method is now copy-pasted in **four** places —
`ExtractorWorker`, `EnrichmentWorker` (Functions repo) and `ChurchService` (here). Within a repo it is
one definition; across repos a shared slug library would dedupe it. Out of scope for the coverage pass,
noted for a future refactor.

---

## ChurchService — 47 uncovered branches → ~18 tests

`public sealed`, mocked `DbConnection`. **No accessibility seam needed** — `Map`, `BindChurch`,
`ToSlug`, `GenerateUniqueSlugAsync` are all reached through the public CRUD methods. The branch mass is
`Map` (~10 `is DBNull ? null :` reader ternaries) and `BindChurch` (~6 `?? DBNull.Value` /
`HasValue ? :`), which collapse into **null-vs-populated fixture pairs**, not 16 separate tests.

| # | Method | Condition | Expected | Status |
|---|---|---|---|---|
| 1 | `GetPageAsync` | reader yields 0 rows | `([], 0)` | ❌ |
| 2 | `GetPageAsync` | reader yields N rows | `totalCount` from row 0 (`items.Count == 0`), all mapped | ❌ |
| 3 | `GetBySlugAsync` | `!ReadAsync` (no match) | `null` | ❌ |
| 4 | `GetBySlugAsync` | row present, **all nullable cols `DBNull`** | `Church` with `null` Street/Phone/... (covers `Map` false sides) | ❌ |
| 5 | `GetByIdAsync` | `!ReadAsync` | `null` | ❌ |
| 6 | `GetByIdAsync` | row present, **all nullable cols populated** | `Church` fully populated (covers `Map` true sides) | ❌ |
| 7 | `CreateAsync` | slug free first try; church fully populated | insert, `BindChurch` value sides | ❌ |
| 8 | `CreateAsync` | slug collides once then frees; optional fields `null` | `-2` suffix (`while` true→false), `BindChurch` `DBNull` sides | ❌ |
| 9 | `UpdateAsync` | `ExecuteNonQuery > 0` | `true` | ❌ |
| 10 | `UpdateAsync` | `ExecuteNonQuery == 0` | `false` | ❌ |
| 11 | `ExistsAsync` | scalar `> 0` | `true` | ❌ |
| 12 | `ExistsAsync` | scalar `0` | `false` | ❌ |
| 13 | `DeleteAsync` | `ExecuteNonQuery > 0` | `true` | ❌ |
| 14 | `DeleteAsync` | `ExecuteNonQuery == 0` | `false` | ❌ |
| 15 | `RecalculateConfidenceAsync` | `GetByIdAsync` returns `null` | early return, no update | ❌ |
| 16 | `RecalculateConfidenceAsync` | church found, `countResult is int` | score calculated + UPDATE | ❌ |
| 17 | `RecalculateConfidenceAsync` | church found, scalar not `int` | `attributeCount = 0` fallback | ❌ |
| 18 | `EnsureOpenAsync` | conn `Closed` vs already open | `OpenAsync` called once / skipped (asserted via two of the above) | ❌ |

`ToSlug` (5 branch cases) is exercised by rows 7–8 via `GenerateUniqueSlugAsync`; if its full table is
wanted it is identical to the Functions `ToSlug` table.

## SearchService — 33 uncovered branches → ~12 tests

The branch mass is `BuildQuery`, a **pure** `private static` SQL builder with six independent filter
toggles plus `out bool hasDistance`. **🔧 Seam (DONE, 2026-06-12):** `BuildQuery` and `BindParams` →
`internal static` + `InternalsVisibleTo Churches.Tests` (added to `Churches.Api.csproj`). Testing the
generated SQL/params directly per toggle is far cleaner than asserting `CommandText` through a full
`SearchAsync` mock.

### `BuildQuery(SearchQuery, out bool hasDistance)` — pure, Home: Unit — 7 tests

Each filter is an independent on/off decision; one row per toggle plus the all-off baseline.

| # | Query | SQL assertion | Branch | Status |
|---|---|---|---|---|
| 1 | empty (all filters off) | `CAST(NULL ... DistanceMiles`, no `AND` clauses, `ORDER BY ... CanonicalName` | every `if` false, `hasDistance` false | ❌ |
| 2 | `Q` set | contains `FREETEXT` | `!IsNullOrWhiteSpace(q.Q)` true | ❌ |
| 3 | `State` set | contains `c.[State] = @State` | `!IsNullOrWhiteSpace(q.State)` true | ❌ |
| 4 | `DenominationId` set | contains `DenominationId =` | `HasValue` true | ❌ |
| 5 | `WorshipStyle` set | contains `WorshipStyle =` | `HasValue` true | ❌ |
| 6 | `WheelchairAccessible` set | contains `WheelchairAccessible =` | `HasValue` true | ❌ |
| 7 | `Lat` + `Lng` set | `fn_HaversineDistance` select + radius filter + distance `ORDER BY`; `hasDistance == true` | `Lat: not null, Lng: not null` true (3 uses) | ❌ |

### `BindParams(DbCommand, SearchQuery)` + `SearchAsync(...)` — Home: Unit — 5 tests

`BindParams` mirrors the same toggles; the only new decision is `RadiusMiles ?? 25.0`. `SearchAsync`
adds conn-state, the read loop, and the AND `hasDistance && reader[24] is not DBNull` (3 cases).

| # | Condition | Expected | Branch | Status |
|---|---|---|---|---|
| 1 | `Lat/Lng` set, `RadiusMiles` null | `@RadiusMiles = 25.0` bound | `?? 25.0` right side | ❌ |
| 2 | `Lat/Lng` set, `RadiusMiles` provided | provided value bound | `?? 25.0` left side | ❌ |
| 3 | conn `Closed`, 0 rows | `OpenAsync`, `([], 0)` | `State == Closed` true | ❌ |
| 4 | `hasDistance`, row with non-null distance | `SearchResult.Distance` set | AND both true | ❌ |
| 5 | `hasDistance` but `reader[24]` `DBNull`; and a no-distance query | `Distance == null` | AND second false / first false | ❌ |

`Map` (same DBNull mapper) is covered by rows 4–5 fixtures.

## ModerationService — 18 uncovered branches → ~10 tests

`public sealed`, mocked `DbConnection` + `ServiceBusClient`. No seam needed. Notable rows: the
`status.HasValue` query toggle, the `MergeAsync` transaction (commit vs rollback+rethrow), and the
`MapCorrection` DBNull ternaries.

| # | Method | Condition | Expected | Branch | Status |
|---|---|---|---|---|---|
| 1 | `GetCorrectionsAsync` | `status.HasValue`, N rows | `WHERE [Status]` + `@Status` param, mapped | `HasValue` true, `items.Count == 0` | ❌ |
| 2 | `GetCorrectionsAsync` | `status` null, 0 rows | no `WHERE`, `([], 0)` | `HasValue` false | ❌ |
| 3 | `GetCorrectionByIdAsync` | `!ReadAsync` | `null` | not found | ❌ |
| 4 | `GetCorrectionByIdAsync` | row, nullable cols `DBNull` | mapped, `null` OldValue/ReviewedBy/... (`MapCorrection` false sides) | ❌ |
| 5 | `GetCorrectionByIdAsync` | row, nullable cols populated | mapped fully (`MapCorrection` true sides) | ❌ |
| 6 | `SubmitCorrectionAsync` | always | `SendMessageAsync` with JSON payload + `MessageId == id`, returns `id` | ❌ |
| 7 | `ReviewCorrectionAsync` | `ExecuteNonQuery > 0` | `true` | ❌ |
| 8 | `ReviewCorrectionAsync` | `ExecuteNonQuery == 0` | `false` | ❌ |
| 9 | `MergeAsync` | all commands succeed | 6 repoints + soft-delete + audit, `CommitAsync` | try path | ❌ |
| 10 | `MergeAsync` | a command throws | `RollbackAsync` + rethrow | catch path | ❌ |

---

## Churches.Api roll-up

| Service | Uncovered branches | Tests | 🔧 seams made |
|---|---|---|---|
| ChurchService | 47 | 18 | none (public API + mocked `DbConnection`) |
| SearchService | 33 | 12 | `BuildQuery`, `BindParams` → internal |
| ModerationService | 18 | 10 | none |
| **Total** | **98** | **40** | one `InternalsVisibleTo` line |

**98 uncovered branches → 40 tests.** The reader-mapper `is DBNull ? null :` mass and the `BindChurch`
coalesce mass collapse into null-vs-populated fixture pairs; the `BuildQuery` filter toggles are one
`[Theory]` row each. Endpoints stay E2E (0% unit is correct for thin routing shells). Nothing escalated.
