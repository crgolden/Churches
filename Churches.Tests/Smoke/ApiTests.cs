namespace Churches.Tests.Smoke;

using Churches.Tests.Infrastructure;
using Microsoft.Playwright;

// Smoke tests for the DEPLOYED Churches app. They assert only what the Churches app itself owns:
// serving the Angular SPA, the /health endpoint, the BFF auth (OIDC) cycle, and the BFF's
// /directory/api proxy behavior (antiforgery enforcement, by-user token injection, routing).
// Directory's own contract — search result shape, pagination clamping, slug lookup — belongs to the
// Directory test suite; asserting it here would couple Churches to Directory's data and blur which
// app is actually broken when a test fails.
[Collection(SmokeCollection.Name)]
[Trait("Category", "Smoke")]
public sealed class ApiTests
{
    private readonly ChurchesFixture _fixture;

    public ApiTests(ChurchesFixture fixture) => _fixture = fixture;

    [Fact]
    public async Task Health_Returns200Healthy()
    {
        SkipIfNotSmoke();

        var (ctx, page) = await _fixture.NewAnonymousPageAsync("/");
        await using (ctx)
        {
            var response = await page.APIRequest.GetAsync($"{_fixture.BaseAddress}/health");
            Assert.Equal(200, response.Status);
            Assert.Equal("Healthy", (await response.TextAsync()).Trim());
        }
    }

    [Fact]
    public async Task Spa_Root_BootstrapsAngularApp()
    {
        SkipIfNotSmoke();

        var (ctx, page) = await _fixture.NewAnonymousPageAsync("/");
        await using (ctx)
        {
            // Rendered children under <app-root> prove the SPA shell was served and Angular bootstrapped.
            var content = page.Locator("app-root > *");
            await content.First.WaitForAsync(new LocatorWaitForOptions { State = WaitForSelectorState.Attached });
            Assert.True(await content.CountAsync() > 0);
        }
    }

    [Fact]
    public async Task BffProxy_WithoutCsrfHeader_Returns401()
    {
        SkipIfNotSmoke();

        var (ctx, page) = await _fixture.NewAnonymousPageAsync("/");
        await using (ctx)
        {
            // The BFF must reject proxied calls that lack the antiforgery header — its core CSRF defense,
            // and the reason the Angular interceptor adds X-CSRF to every request.
            var response = await page.APIRequest.GetAsync($"{_fixture.BaseAddress}/directory/api/search");
            Assert.Equal(401, response.Status);
        }
    }

    [Fact]
    public async Task BffProxy_WithCsrfHeader_ReachesDirectory_Returns200()
    {
        SkipIfNotSmoke();

        var (ctx, page) = await _fixture.NewAnonymousPageAsync("/");
        await using (ctx)
        {
            // An anonymous (UserOrNone) request flows through the BFF proxy to the configured Directory
            // API and back. Status only — Directory's payload is the Directory suite's concern.
            var response = await page.APIRequest.GetAsync(
                $"{_fixture.BaseAddress}/directory/api/search",
                new() { Headers = new Dictionary<string, string> { ["X-CSRF"] = "1" } });
            Assert.Equal(200, response.Status);
        }
    }

    [Fact]
    public async Task BffProxy_ProtectedEndpoint_WhenUnauthenticated_Returns401()
    {
        SkipIfNotSmoke();

        var (ctx, page) = await _fixture.NewAnonymousPageAsync("/");
        await using (ctx)
        {
            // CSRF header present but no logged-in user: the BFF injects no token, so Directory's
            // scope-protected endpoint rejects it. Proves token injection is by-user, not a static
            // credential, and that protected routes stay protected anonymously.
            var response = await page.APIRequest.PostAsync(
                $"{_fixture.BaseAddress}/directory/api/corrections",
                new APIRequestContextOptions
                {
                    Headers = new Dictionary<string, string> { ["X-CSRF"] = "1" },
                    DataObject = new { churchId = Guid.NewGuid(), field = "street", newValue = "x" }
                });
            Assert.Equal(401, response.Status);
        }
    }

    [Fact]
    public async Task BffLogin_FullLoginLogoutCycle_Succeeds()
    {
        SkipIfNotSmoke();

        var (ctx, page) = await _fixture.NewAnonymousPageAsync("/");
        await using (ctx)
        {
            await _fixture.LoginAsync(page, "/");

            var userResp = await page.APIRequest.GetAsync(
                "/bff/user",
                new() { Headers = new Dictionary<string, string> { ["X-CSRF"] = "1" } });
            Assert.Equal(200, userResp.Status);

            var json = await userResp.JsonAsync();
            Assert.NotNull(json);
            var claims = json.Value.EnumerateArray().ToList();
            var logoutClaim = claims.FirstOrDefault(e =>
                e.TryGetProperty("type", out var t) && t.GetString() == "bff:logout_url");
            Assert.NotEqual(default, logoutClaim);

            var logoutUrl = logoutClaim.GetProperty("value").GetString();
            Assert.NotNull(logoutUrl);
            await page.GotoAsync(logoutUrl);
            await page.WaitForURLAsync("**/Account/Logout**");
        }
    }

    private static void SkipIfNotSmoke()
    {
        if (!ChurchesFixture.IsSmoke)
        {
            throw Xunit.Sdk.SkipException.ForSkip("Requires deployed stack — set SmokeBaseUrl to enable.");
        }
    }
}
