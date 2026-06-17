namespace Churches.Tests.Infrastructure;

using System.Text.Json;
using Churches.Tests.Infrastructure.Stores;
using Microsoft.Playwright;

public sealed partial class ChurchesFixture : IAsyncLifetime
{
    private static readonly bool Headless =
        !string.Equals(Environment.GetEnvironmentVariable("PLAYWRIGHT_HEADED"), "1", StringComparison.OrdinalIgnoreCase);

    private static readonly string? AdminEmail = Environment.GetEnvironmentVariable("AdminEmail");
    private static readonly string? AdminPassword = Environment.GetEnvironmentVariable("AdminPassword");
    private static readonly string? SmokeBaseUrl = Environment.GetEnvironmentVariable("SmokeBaseUrl");

    private static readonly JsonSerializerOptions CamelCase = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase
    };

    private IPlaywright? _playwright;
    private IBrowser? _browser;
    private string? _storageStatePath;

    public ChurchesFixture()
    {
        Factory = SmokeBaseUrl is null ? new ChurchesWebApplicationFactory() : null;
        ChurchStore = new ChurchStore();
        CorrectionStore = new CorrectionStore();
        BaseAddress = string.Empty;
    }

    public static bool IsSmoke => SmokeBaseUrl is not null;

    public ChurchesWebApplicationFactory? Factory { get; }

    public ChurchStore ChurchStore { get; }

    public CorrectionStore CorrectionStore { get; }

    public string BaseAddress { get; private set; }

    public async ValueTask InitializeAsync()
    {
        Stage("InitializeAsync enter");
        if (SmokeBaseUrl is not null)
        {
            BaseAddress = SmokeBaseUrl.TrimEnd('/');
            Stage($"smoke mode base={BaseAddress}");
        }
        else
        {
            Stage("Factory.StartAsync() enter");
            await Factory!.StartAsync();
            BaseAddress = Factory.ServerAddress;
            Stage($"Factory.StartAsync() done base={BaseAddress}");
        }

        Stage("playwright install chromium enter");
        var exitCode = Microsoft.Playwright.Program.Main(["install", "chromium"]);
        Stage($"playwright install exit={exitCode}");
        if (exitCode != 0)
        {
            throw new InvalidOperationException($"Playwright install failed with exit code {exitCode}.");
        }

        Stage("Playwright.CreateAsync enter");
        _playwright = await Playwright.CreateAsync();
        Stage("Chromium.LaunchAsync enter");
        _browser = await _playwright.Chromium.LaunchAsync(new BrowserTypeLaunchOptions
        {
            Headless = Headless
        });
        Stage("Chromium.LaunchAsync done");

        if (SmokeBaseUrl is not null)
        {
            if (AdminEmail is null || AdminPassword is null)
            {
                throw new InvalidOperationException("AdminEmail and AdminPassword must be set when SmokeBaseUrl is configured.");
            }

            Stage("LoginAsync enter");
            await LoginAsync();
            Stage("LoginAsync done");
        }

        Stage("warmup enter");
        ChurchStore.Seed(ChurchStore.FirstBaptistAustin);
        var warmup = await NewAnonymousPageAsync("/");
        await using (warmup.Context)
        {
            await warmup.Page.WaitForSelectorAsync("h1", new PageWaitForSelectorOptions { Timeout = 60_000 });
        }

        Stage("warmup done");
        Stage("InitializeAsync exit");
    }

    public async Task<(IAsyncDisposable Context, IPage Page)> NewAnonymousPageAsync(string path = "/")
    {
        if (_browser is null)
        {
            throw new InvalidOperationException("Browser is not initialized. Ensure InitializeAsync has been awaited.");
        }

        var (session, page) = await PlaywrightArtifactRecorder.CreateSessionAsync(_browser, "Churches", IsSmoke ? "Smoke" : "E2E", new BrowserNewContextOptions
        {
            BaseURL = BaseAddress,
            IgnoreHTTPSErrors = true
        });

        page.SetDefaultTimeout(60_000);
        page.Request += (_, req) => Stage($"REQ {req.Method} {req.Url}");
        page.Response += (_, resp) => Stage($"RESP {resp.Status} {resp.Url}");
        page.RequestFailed += (_, req) => Stage($"FAIL {req.Method} {req.Url} err={req.Failure}");

        if (!IsSmoke)
        {
            await page.RouteAsync("**/bff/user", async route =>
            {
                await route.FulfillAsync(new RouteFulfillOptions { Status = 401 });
            });

            await page.RouteAsync("**/bff/login**", async route =>
            {
                await route.FulfillAsync(new RouteFulfillOptions
                {
                    Status = 200,
                    ContentType = "text/html",
                    Body = "<html><body><p>Login page (mock)</p></body></html>"
                });
            });

            await WireApiRoutesAsync(page);
        }

        await page.GotoAsync(path, new PageGotoOptions
        {
            WaitUntil = WaitUntilState.DOMContentLoaded,
            Timeout = 60_000
        });

        return (session, page);
    }

    public async Task<(IAsyncDisposable Context, IPage Page)> NewAuthenticatedPageAsync(string path = "/", bool isModerator = false)
    {
        if (_browser is null)
        {
            throw new InvalidOperationException("Browser is not initialized. Ensure InitializeAsync has been awaited.");
        }

        var (session, page) = await PlaywrightArtifactRecorder.CreateSessionAsync(_browser, "Churches", IsSmoke ? "Smoke" : "E2E", new BrowserNewContextOptions
        {
            BaseURL = BaseAddress,
            IgnoreHTTPSErrors = true,
            StorageStatePath = _storageStatePath
        });

        page.SetDefaultTimeout(60_000);
        page.Request += (_, req) => Stage($"REQ {req.Method} {req.Url}");
        page.Response += (_, resp) => Stage($"RESP {resp.Status} {resp.Url}");
        page.RequestFailed += (_, req) => Stage($"FAIL {req.Method} {req.Url} err={req.Failure}");

        if (!IsSmoke)
        {
            var claims = new List<object>
            {
                new { type = "sub", value = "e2e-user-id" },
                new { type = "email", value = "e2e@test.invalid" },
                new { type = "name", value = "e2e@test.invalid" },
                new { type = "bff:logout_url", value = "/bff/logout?sid=e2e" },
                new { type = "bff:session_expires_in", value = "3600" },
            };
            if (isModerator)
            {
                claims.Add(new { type = "churches.mod", value = "true" });
            }

            var claimsJson = JsonSerializer.Serialize(claims);
            await page.RouteAsync("**/bff/user", async route =>
            {
                await route.FulfillAsync(new RouteFulfillOptions
                {
                    Status = 200,
                    ContentType = "application/json",
                    Body = claimsJson
                });
            });

            await page.RouteAsync("**/bff/logout**", async route =>
            {
                await route.FulfillAsync(new RouteFulfillOptions
                {
                    Status = 200,
                    ContentType = "text/html",
                    Body = "<html><body><p>Logged out (mock)</p></body></html>"
                });
            });

            await WireApiRoutesAsync(page);
        }

        await page.GotoAsync(path, new PageGotoOptions
        {
            WaitUntil = WaitUntilState.DOMContentLoaded,
            Timeout = 60_000
        });

        return (session, page);
    }

    public async ValueTask DisposeAsync()
    {
        if (_browser is not null)
        {
            await _browser.DisposeAsync();
        }

        _playwright?.Dispose();
        if (Factory is not null)
        {
            await Factory.DisposeAsync();
        }

        if (_storageStatePath is not null && File.Exists(_storageStatePath))
        {
            File.Delete(_storageStatePath);
        }
    }

    public async Task LoginAsync(IPage page, string returnPath = "/")
    {
        await page.GotoAsync($"{BaseAddress}/bff/login?returnUrl={Uri.EscapeDataString(returnPath)}");
        await page.WaitForURLAsync("**/Account/Login**");
        await page.FillAsync("input[name='Input.Email']", AdminEmail!);
        await page.FillAsync("input[name='Input.Password']", AdminPassword!);
        await page.ClickAsync("button#login-submit");
        await page.WaitForURLAsync($"{BaseAddress}/**");
    }

    private static object ChurchToJson(ChurchRecord c) => new
    {
        id = c.Id,
        canonicalName = c.CanonicalName,
        slug = c.Slug,
        latitude = c.Latitude,
        longitude = c.Longitude,
        street = c.Street,
        city = c.City,
        state = c.State,
        zip = c.Zip,
        phoneNumber = c.PhoneNumber,
        website = c.Website,
        emailAddress = c.EmailAddress,
        denominationId = c.DenominationId,
        worshipStyle = c.WorshipStyle,
        primaryLanguage = c.PrimaryLanguage,
        acceptsLGBTQ = c.AcceptsLGBTQ,
        wheelchairAccessible = c.WheelchairAccessible,
        hasNursery = c.HasNursery,
        hasYouthProgram = c.HasYouthProgram,
        confidenceScore = c.ConfidenceScore,
        lastVerifiedAt = c.LastVerifiedAt,
        createdAt = c.CreatedAt,
        updatedAt = c.UpdatedAt,
        isActive = c.IsActive,
    };

    private static object CorrectionToJson(CorrectionRecord c) => new
    {
        id = c.Id,
        churchId = c.ChurchId,
        userId = c.UserId,
        field = c.Field,
        oldValue = c.OldValue,
        newValue = c.NewValue,
        status = c.Status,
        reviewedBy = c.ReviewedBy,
        reviewedAt = c.ReviewedAt,
        createdAt = c.CreatedAt,
        churchName = c.ChurchName,
    };

    private static void Stage(string msg) =>
        Console.WriteLine($"[{DateTime.UtcNow:HH:mm:ss.fff}] ChurchesFixture: {msg}");

    private async Task WireApiRoutesAsync(IPage page)
    {
        await page.RouteAsync("**/directory/api/**", async route =>
        {
            try
            {
                await DispatchApiRouteAsync(route);
            }
            catch
            {
                await route.FulfillAsync(new RouteFulfillOptions { Status = 500 });
            }
        });
    }

    private async Task DispatchApiRouteAsync(IRoute route)
    {
        var request = route.Request;
        var method = request.Method.ToUpperInvariant();
        var uri = new Uri(request.Url);
        var path = uri.AbsolutePath;

        var apiIndex = path.IndexOf("/directory/api/", StringComparison.OrdinalIgnoreCase);
        if (apiIndex < 0)
        {
            await route.FulfillAsync(new RouteFulfillOptions { Status = 404 });
            return;
        }

        var apiPrefixLength = apiIndex + "/directory/api".Length;
        var apiPath = path[apiPrefixLength..];

        if (apiPath.Equals("/search", StringComparison.OrdinalIgnoreCase) ||
            apiPath.StartsWith("/search?", StringComparison.OrdinalIgnoreCase))
        {
            await HandleSearchAsync(route, uri);
        }
        else if (apiPath.Equals("/churches", StringComparison.OrdinalIgnoreCase) ||
                 apiPath.StartsWith("/churches?", StringComparison.OrdinalIgnoreCase))
        {
            await HandleChurchListAsync(route, uri);
        }
        else if (apiPath.StartsWith("/churches/", StringComparison.OrdinalIgnoreCase))
        {
            var slug = apiPath["/churches/".Length..];
            await HandleChurchBySlugAsync(route, slug);
        }
        else if (apiPath.Equals("/corrections", StringComparison.OrdinalIgnoreCase) ||
                 apiPath.StartsWith("/corrections?", StringComparison.OrdinalIgnoreCase))
        {
            await HandleCorrectionsCollectionAsync(route, method, uri, request);
        }
        else if (apiPath.StartsWith("/corrections/", StringComparison.OrdinalIgnoreCase))
        {
            await HandleCorrectionActionAsync(route, method, apiPath);
        }
        else
        {
            await route.FulfillAsync(new RouteFulfillOptions { Status = 404 });
        }
    }

    private async Task HandleSearchAsync(IRoute route, Uri uri)
    {
        var query = Microsoft.AspNetCore.WebUtilities.QueryHelpers.ParseQuery(uri.Query);
        query.TryGetValue("q", out var q);
        query.TryGetValue("state", out var state);
        int? worshipStyle = query.TryGetValue("worshipStyle", out var ws) && int.TryParse(ws, out var wsVal) ? wsVal : null;
        bool? wheelchair = query.TryGetValue("wheelchairAccessible", out var wa) && bool.TryParse(wa, out var waVal) ? waVal : null;
        var page = query.TryGetValue("page", out var pg) && int.TryParse(pg, out var pgVal) ? Math.Max(1, pgVal) : 1;
        var pageSize = query.TryGetValue("pageSize", out var ps) && int.TryParse(ps, out var psVal) ? Math.Clamp(psVal, 1, 50) : 20;

        var (items, total) = ChurchStore.Search(q.ToString() is { Length: > 0 } qv ? qv : null, state.ToString() is { Length: > 0 } sv ? sv : null, worshipStyle, wheelchair, page, pageSize);

        var response = new
        {
            items = items.Select(r => new
            {
                church = ChurchToJson(r.Church),
                distanceMiles = r.DistanceMiles
            }),
            totalCount = total,
            page,
            pageSize
        };

        await route.FulfillAsync(new RouteFulfillOptions
        {
            Status = 200,
            ContentType = "application/json",
            Body = JsonSerializer.Serialize(response, CamelCase)
        });
    }

    private async Task HandleChurchListAsync(IRoute route, Uri uri)
    {
        var query = Microsoft.AspNetCore.WebUtilities.QueryHelpers.ParseQuery(uri.Query);
        var page = query.TryGetValue("page", out var pg) && int.TryParse(pg, out var pgVal) ? Math.Max(1, pgVal) : 1;
        var pageSize = query.TryGetValue("pageSize", out var ps) && int.TryParse(ps, out var psVal) ? Math.Clamp(psVal, 1, 50) : 20;

        var (items, total) = ChurchStore.GetPage(page, pageSize);
        var response = new
        {
            items = items.Select(ChurchToJson),
            totalCount = total,
            page,
            pageSize
        };

        await route.FulfillAsync(new RouteFulfillOptions
        {
            Status = 200,
            ContentType = "application/json",
            Body = JsonSerializer.Serialize(response, CamelCase)
        });
    }

    private async Task HandleChurchBySlugAsync(IRoute route, string slug)
    {
        var church = ChurchStore.GetBySlug(slug);
        if (church is null)
        {
            await route.FulfillAsync(new RouteFulfillOptions { Status = 404 });
            return;
        }

        await route.FulfillAsync(new RouteFulfillOptions
        {
            Status = 200,
            ContentType = "application/json",
            Body = JsonSerializer.Serialize(ChurchToJson(church), CamelCase)
        });
    }

    private async Task HandleCorrectionsCollectionAsync(IRoute route, string method, Uri uri, IRequest request)
    {
        switch (method)
        {
            case "GET":
            {
                var query = Microsoft.AspNetCore.WebUtilities.QueryHelpers.ParseQuery(uri.Query);
                var page = query.TryGetValue("page", out var pg) && int.TryParse(pg, out var pgVal) ? Math.Max(1, pgVal) : 1;
                var pageSize = query.TryGetValue("pageSize", out var ps) && int.TryParse(ps, out var psVal) ? Math.Clamp(psVal, 1, 50) : 20;
                var (items, total) = CorrectionStore.GetPending(page, pageSize);
                var response = new
                {
                    items = items.Select(CorrectionToJson),
                    totalCount = total,
                    page,
                    pageSize
                };
                await route.FulfillAsync(new RouteFulfillOptions
                {
                    Status = 200,
                    ContentType = "application/json",
                    Body = JsonSerializer.Serialize(response, CamelCase)
                });
                break;
            }

            case "POST":
            {
                var body = request.PostData ?? "{}";
                using var doc = System.Text.Json.JsonDocument.Parse(body);
                var root = doc.RootElement;
                var churchIdStr = root.TryGetProperty("churchId", out var cid) ? cid.GetString() : null;
                if (churchIdStr is null || !Guid.TryParse(churchIdStr, out var churchId))
                {
                    await route.FulfillAsync(new RouteFulfillOptions { Status = 400 });
                    return;
                }

                var church = ChurchStore.GetBySlug(string.Empty) is null
                    ? null
                    : ChurchStore.GetPage(1, 100).Items.FirstOrDefault(c => c.Id == churchId);
                if (church is null)
                {
                    church = ChurchStore.GetPage(1, 100).Items.FirstOrDefault(c => c.Id == churchId);
                }

                if (church is null)
                {
                    await route.FulfillAsync(new RouteFulfillOptions { Status = 404 });
                    return;
                }

                var field = root.TryGetProperty("field", out var f) ? f.GetString() : null;
                var oldValue = root.TryGetProperty("oldValue", out var ov) && ov.ValueKind != System.Text.Json.JsonValueKind.Null ? ov.GetString() : null;
                var newValue = root.TryGetProperty("newValue", out var nv) ? nv.GetString() : null;
                if (string.IsNullOrEmpty(field) || string.IsNullOrEmpty(newValue))
                {
                    await route.FulfillAsync(new RouteFulfillOptions { Status = 400 });
                    return;
                }

                var correction = CorrectionStore.Submit(churchId, "e2e-user-id", field, oldValue, newValue, church.CanonicalName);
                await route.FulfillAsync(new RouteFulfillOptions
                {
                    Status = 201,
                    ContentType = "application/json",
                    Body = JsonSerializer.Serialize(CorrectionToJson(correction), CamelCase)
                });
                break;
            }

            default:
                await route.FulfillAsync(new RouteFulfillOptions { Status = 405 });
                break;
        }
    }

    private async Task HandleCorrectionActionAsync(IRoute route, string method, string apiPath)
    {
        var parts = apiPath.Split('/', StringSplitOptions.RemoveEmptyEntries);
        if (parts.Length < 2 || !Guid.TryParse(parts[1], out var id))
        {
            await route.FulfillAsync(new RouteFulfillOptions { Status = 400 });
            return;
        }

        if (parts.Length >= 3)
        {
            var action = parts[2].ToLowerInvariant();
            if (method == "PATCH")
            {
                var updated = false;
                if (action == "approve")
                {
                    updated = CorrectionStore.Approve(id);
                }
                else if (action == "reject")
                {
                    updated = CorrectionStore.Reject(id);
                }

                await route.FulfillAsync(new RouteFulfillOptions { Status = updated ? 204 : 404 });
                return;
            }
        }

        await route.FulfillAsync(new RouteFulfillOptions { Status = 405 });
    }

    private async Task LoginAsync()
    {
        _storageStatePath = Path.GetTempFileName();

        await using var context = await _browser!.NewContextAsync(new BrowserNewContextOptions
        {
            BaseURL = BaseAddress,
            IgnoreHTTPSErrors = true
        });
        var page = await context.NewPageAsync();
        page.SetDefaultTimeout(60_000);

        await LoginAsync(page);

        await context.StorageStateAsync(new() { Path = _storageStatePath });
    }
}
