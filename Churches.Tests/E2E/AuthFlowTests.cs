namespace Churches.Tests.E2E;

using System.Text.Json;
using Churches.Tests.Infrastructure;
using Churches.Tests.Infrastructure.Stores;
using Microsoft.Playwright;

[Collection(E2ECollection.Name)]
[Trait("Category", "E2E")]
public sealed class AuthFlowTests
{
    private readonly ChurchesFixture _fixture;

    public AuthFlowTests(ChurchesFixture fixture) => _fixture = fixture;

    [Fact]
    public async Task ContributePage_WhenUnauthenticated_RedirectsToLoginWithReturnUrl()
    {
        _fixture.ChurchStore.Clear();
        _fixture.ChurchStore.Seed(ChurchStore.FirstBaptistAustin);

        var (ctx, page) = await _fixture.NewAnonymousPageAsync("/contribute/first-baptist-church-austin-tx");
        await using (ctx)
        {
            await page.WaitForURLAsync("**/bff/login**", new PageWaitForURLOptions { Timeout = 10_000 });
            Assert.Contains("returnUrl", page.Url);
        }
    }

    [Fact]
    public async Task BffSession_AfterLogin_ContainsSubAndEmailClaims()
    {
        _fixture.ChurchStore.Clear();
        _fixture.ChurchStore.Seed(ChurchStore.FirstBaptistAustin);

        var (ctx, page) = await _fixture.NewAuthenticatedPageAsync("/");
        await using (ctx)
        {
            var json = await page.EvaluateAsync<JsonElement>(
                "() => fetch('/bff/user', {headers: {'X-CSRF': '1'}}).then(r => r.json())");
            var array = json.EnumerateArray().ToList();
            Assert.Contains(array, e =>
                e.TryGetProperty("type", out var t) && t.GetString() == "sub" &&
                e.TryGetProperty("value", out var v) && v.GetString() == "e2e-user-id");
            Assert.Contains(array, e =>
                e.TryGetProperty("type", out var t) && t.GetString() == "email");
        }
    }

    [Fact]
    public async Task ContributePage_WhenAuthenticated_ShowsForm()
    {
        _fixture.ChurchStore.Clear();
        _fixture.ChurchStore.Seed(ChurchStore.FirstBaptistAustin);

        var (ctx, page) = await _fixture.NewAuthenticatedPageAsync("/contribute/first-baptist-church-austin-tx");
        await using (ctx)
        {
            await Assertions.Expect(page.Locator("h1")).ToContainTextAsync("Suggest a Correction");
        }
    }

    [Fact]
    public async Task BffSession_AsModerator_ContainsModClaim()
    {
        _fixture.ChurchStore.Clear();
        _fixture.ChurchStore.Seed(ChurchStore.FirstBaptistAustin);

        var (ctx, page) = await _fixture.NewAuthenticatedPageAsync("/", isModerator: true);
        await using (ctx)
        {
            var json = await page.EvaluateAsync<JsonElement>(
                "() => fetch('/bff/user', {headers: {'X-CSRF': '1'}}).then(r => r.json())");
            var array = json.EnumerateArray().ToList();
            Assert.Contains(array, e =>
                e.TryGetProperty("type", out var t) && t.GetString() == "churches.mod" &&
                e.TryGetProperty("value", out var v) && v.GetString() == "true");
        }
    }
}
