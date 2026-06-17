namespace Churches.Tests.Smoke;

using Churches.Tests.Infrastructure;
using Microsoft.Playwright;

[Collection(SmokeCollection.Name)]
[Trait("Category", "Smoke")]
public sealed class ApiTests
{
    private readonly ChurchesFixture _fixture;

    public ApiTests(ChurchesFixture fixture) => _fixture = fixture;

    [Fact]
    public async Task SearchEndpoint_WithNoParams_Returns200WithResultShape()
    {
        if (!ChurchesFixture.IsSmoke)
        {
            throw Xunit.Sdk.SkipException.ForSkip("Requires deployed stack — set SmokeBaseUrl to enable.");
        }

        var (ctx, page) = await _fixture.NewAnonymousPageAsync("/");
        await using (ctx)
        {
            var response = await page.APIRequest.GetAsync($"{_fixture.BaseAddress}/directory/api/search");
            Assert.Equal(200, response.Status);
            var json = await response.JsonAsync();
            Assert.NotNull(json);
            Assert.True(json.Value.TryGetProperty("items", out _));
            Assert.True(json.Value.TryGetProperty("totalCount", out _));
        }
    }

    [Fact]
    public async Task SearchEndpoint_WithKeyword_Returns200()
    {
        if (!ChurchesFixture.IsSmoke)
        {
            throw Xunit.Sdk.SkipException.ForSkip("Requires deployed stack — set SmokeBaseUrl to enable.");
        }

        var (ctx, page) = await _fixture.NewAnonymousPageAsync("/");
        await using (ctx)
        {
            var response = await page.APIRequest.GetAsync($"{_fixture.BaseAddress}/directory/api/search?q=Baptist&page=1&pageSize=20");
            Assert.Equal(200, response.Status);
        }
    }

    [Fact]
    public async Task ChurchesEndpoint_WithOutOfRangePageSize_ClampsAndReturns200()
    {
        if (!ChurchesFixture.IsSmoke)
        {
            throw Xunit.Sdk.SkipException.ForSkip("Requires deployed stack — set SmokeBaseUrl to enable.");
        }

        var (ctx, page) = await _fixture.NewAnonymousPageAsync("/");
        await using (ctx)
        {
            var r1 = await page.APIRequest.GetAsync($"{_fixture.BaseAddress}/directory/api/churches?page=0&pageSize=10");
            Assert.Equal(200, r1.Status);

            var r2 = await page.APIRequest.GetAsync($"{_fixture.BaseAddress}/directory/api/churches?page=1&pageSize=999");
            Assert.Equal(200, r2.Status);
            var json = await r2.JsonAsync();
            Assert.True(json!.Value.TryGetProperty("pageSize", out var ps));
            Assert.True(ps.GetInt32() <= 50);
        }
    }

    [Fact]
    public async Task ChurchesEndpoint_WithValidSlug_Returns200()
    {
        if (!ChurchesFixture.IsSmoke)
        {
            throw Xunit.Sdk.SkipException.ForSkip("Requires deployed stack — set SmokeBaseUrl to enable.");
        }

        var (ctx, page) = await _fixture.NewAnonymousPageAsync("/");
        await using (ctx)
        {
            var response = await page.APIRequest.GetAsync($"{_fixture.BaseAddress}/directory/api/churches/first-baptist-church-austin-tx");
            Assert.Equal(200, response.Status);
        }
    }

    [Fact]
    public async Task ChurchesEndpoint_WithInvalidSlug_Returns404()
    {
        if (!ChurchesFixture.IsSmoke)
        {
            throw Xunit.Sdk.SkipException.ForSkip("Requires deployed stack — set SmokeBaseUrl to enable.");
        }

        var (ctx, page) = await _fixture.NewAnonymousPageAsync("/");
        await using (ctx)
        {
            var response = await page.APIRequest.GetAsync($"{_fixture.BaseAddress}/directory/api/churches/this-slug-does-not-exist");
            Assert.Equal(404, response.Status);
        }
    }

    [Fact]
    public async Task CorrectionsEndpoint_WhenUnauthenticated_Returns401()
    {
        if (!ChurchesFixture.IsSmoke)
        {
            throw Xunit.Sdk.SkipException.ForSkip("Requires deployed stack — set SmokeBaseUrl to enable.");
        }

        var (ctx, page) = await _fixture.NewAnonymousPageAsync("/");
        await using (ctx)
        {
            var response = await page.APIRequest.PostAsync(
                $"{_fixture.BaseAddress}/directory/api/corrections",
                new APIRequestContextOptions
                {
                    DataObject = new { churchId = Guid.NewGuid(), field = "street", newValue = "x" }
                });
            Assert.Equal(401, response.Status);
        }
    }

    [Fact]
    public async Task BffLogin_FullLoginLogoutCycle_Succeeds()
    {
        if (!ChurchesFixture.IsSmoke)
        {
            throw Xunit.Sdk.SkipException.ForSkip("Requires deployed stack — set SmokeBaseUrl to enable.");
        }

        var (ctx, page) = await _fixture.NewAnonymousPageAsync("/");
        await using (ctx)
        {
            await _fixture.LoginAsync(page, "/");

            var userResp = await page.APIRequest.GetAsync("/bff/user", new() { Headers = new Dictionary<string, string> { ["X-CSRF"] = "1" } });
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
}
